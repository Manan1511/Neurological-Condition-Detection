import pandas as pd
import numpy as np
from scipy.fft import fft, fftfreq
import joblib
import librosa
import soundfile as sf
from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

MODEL_FILE = 'parkinson_tremor_model.pkl'
SAMPLING_RATE = 50 # Hz

# Load Model
model = None
if os.path.exists(MODEL_FILE):
    try:
        model = joblib.load(MODEL_FILE)
        print(f"✅ Model loaded from {MODEL_FILE}")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
else:
    print(f"❌ Model file {MODEL_FILE} not found!")

# --- FEATURE EXTRACTION (PORTED FROM live_detector.py) ---
def get_features(df_window):
    # 1. Prepare Signals
    acc_mag = np.sqrt(df_window['AccelX']**2 + df_window['AccelY']**2 + df_window['AccelZ']**2)
    acc_mag = acc_mag - np.mean(acc_mag) 
    fsr_signal = df_window['FSR'].values if 'FSR' in df_window.columns else np.zeros(len(acc_mag))

    # 2. Frequency Domain
    N = len(acc_mag)
    if N == 0: return [0]*6

    yf = fft(acc_mag.values)
    xf = fftfreq(N, 1 / SAMPLING_RATE)
    
    positive_freqs = xf[:N//2]
    positive_mags = 2.0/N * np.abs(yf[0:N//2])
    
    # Features
    if len(positive_mags) > 0:
        dom_freq_index = np.argmax(positive_mags)
        dom_freq = positive_freqs[dom_freq_index]
    else:
        dom_freq = 0
    
    tremor_band_mask = (positive_freqs >= 3.5) & (positive_freqs <= 7.5)
    tremor_energy = np.sum(positive_mags[tremor_band_mask])
    
    voluntary_band_mask = (positive_freqs > 0.1) & (positive_freqs < 3.0)
    voluntary_energy = np.sum(positive_mags[voluntary_band_mask])

    # 3. Time Domain
    acc_std = np.std(acc_mag)
    fsr_mean = np.mean(fsr_signal)
    fsr_std = np.std(fsr_signal)

    # Return as list of values in specific order
    return [dom_freq, tremor_energy, voluntary_energy, acc_std, fsr_mean, fsr_std]

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "running", "model_loaded": model is not None})

@app.route('/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.json
    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid input, expected list of objects"}), 400

    # Convert JSON to DataFrame
    # Expected keys: AccelX, AccelY, AccelZ, FSR
    try:
        df = pd.DataFrame(data)
        
        # Ensure columns exist (fill 0 if missing, e.g. FSR)
        required_cols = ['AccelX', 'AccelY', 'AccelZ']
        for col in required_cols:
            if col not in df.columns:
                return jsonify({"error": f"Missing column {col}"}), 400
        
        if 'FSR' not in df.columns:
            df['FSR'] = 0

        # Extract features
        features = get_features(df)
        
        # Predict
        prediction = model.predict([features])[0]
        
        # --- LOGIC GATE (Ported) ---
        real_freq = features[0]
        final_prediction = int(prediction)
        
        # Rule: Parkinson's is strictly 3.0 - 7.0 Hz
        if final_prediction == 1: # Tremor
            if real_freq > 7.0:
                final_prediction = 2 # Voluntary
            elif real_freq < 3.0:
                final_prediction = 2 # Voluntary

        labels = {0: "Rest", 1: "Tremor", 2: "Voluntary"}
        
        return jsonify({
            "class": final_prediction,
            "label": labels.get(final_prediction, "Unknown"),
            "features": {
                "dom_freq": real_freq,
                "tremor_energy": features[1]
            }
        })

    except Exception as e:
        print(f"Processing Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- VOICE TREMOR ANALYSIS ---
SPEECH_MODEL_FILE = 'speech_svm_model.pkl'
SPEECH_SCALER_FILE = 'speech_scaler.pkl'

speech_model = None
speech_scaler = None

try:
    if os.path.exists(SPEECH_MODEL_FILE):
        speech_model = joblib.load(SPEECH_MODEL_FILE)
        speech_scaler = joblib.load(SPEECH_SCALER_FILE)
        print("✅ Voice Model loaded successfully.")
    else:
        print(f"❌ Voice Model {SPEECH_MODEL_FILE} not found!")
except Exception as e:
    print(f"❌ Error loading Voice Model: {e}")

def extract_voice_features(audio, sample_rate):
    """
    Extracts 4 features: Jitter, Shimmer, HNR, MFCC.
    Matches live_voice_analysis.py logic.
    """
    try:
        # 1. MFCC
        mfcc = np.mean(librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13))
        
        # 2. Pitch (F0)
        f0, _, _ = librosa.pyin(audio, fmin=75, fmax=300, sr=sample_rate)
        f0 = f0[~np.isnan(f0)]
        
        if len(f0) < 2: return None

        # 3. Jitter
        periods = 1.0 / f0
        jitter = np.mean(np.abs(np.diff(periods))) / np.mean(periods) * 100 

        # 4. Shimmer
        hop_length = 512
        rms = librosa.feature.rms(y=audio, frame_length=1024, hop_length=hop_length)[0]
        
        # Resize RMS
        target_len = min(len(rms), len(f0))
        rms = rms[:target_len]
        
        if len(rms) < 2: return None
        shimmer = np.mean(np.abs(np.diff(rms))) / np.mean(rms) * 100 
        
        # 5. HNR
        harmonic = librosa.effects.harmonic(audio)
        energy_total = np.sum(audio ** 2)
        energy_harmonic = np.sum(harmonic ** 2)
        noise_energy = energy_total - energy_harmonic
        if noise_energy <= 0: noise_energy = 0.00001
        hnr = 10 * np.log10(energy_harmonic / noise_energy)
        
        return [jitter, shimmer, hnr, mfcc]

    except Exception as e:
        print(f"Error extracting voice features: {e}")
        return None

@app.route('/predict_audio', methods=['POST'])
def predict_audio():
    if not speech_model:
        return jsonify({'error': 'Voice model not loaded'}), 500

    try:
        data = request.json
        # Expecting 'audio' as list of floats, 'rate' as int
        if 'audio' not in data or 'rate' not in data:
            return jsonify({'error': 'Missing audio data or sample rate'}), 400
        
        audio_array = np.array(data['audio'], dtype=np.float32)
        rate = data['rate']
        
        # Trim silence like in training
        audio_array, _ = librosa.effects.trim(audio_array, top_db=20)
        
        features = extract_voice_features(audio_array, rate)
        
        if features is None:
            return jsonify({'error': 'Could not extract features (too short/silent?)'}), 400
            
        # Predict
        feat_array = np.array([features])
        feat_scaled = speech_scaler.transform(feat_array)
        prediction = speech_model.predict(feat_scaled)[0]
        probs = speech_model.predict_proba(feat_scaled)[0]
        confidence = np.max(probs) * 100
        
        label = "Tremor" if prediction == 1 else "Healthy"
        
        result = {
            'label': label,
            'confidence': round(confidence, 1),
            'features': {
                'jitter': round(features[0], 2),
                'shimmer': round(features[1], 2),
                'hnr': round(features[2], 1),
                'mfcc': round(features[3], 2)
            }
        }
        
        return jsonify(result)

    except Exception as e:
        print("Prediction Error:", e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("✅ Server running on port 5000")
    app.run(port=5000, debug=True)
