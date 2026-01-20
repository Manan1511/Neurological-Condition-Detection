import sounddevice as sd
import numpy as np
import librosa
import joblib
import time

# --- CONFIGURATION ---
MODEL_FILE = 'speech_svm_model.pkl'
SCALER_FILE = 'speech_scaler.pkl'
SAMPLE_RATE = 16000 # Must match the training rate (16kHz)
DURATION = 5 # Seconds to record

def extract_features(audio_array, sample_rate):
    """
    Extracts the exact same 4 features used in training.
    """
    # 1. MFCC (Timbre)
    mfcc = np.mean(librosa.feature.mfcc(y=audio_array, sr=sample_rate, n_mfcc=13))
    
    # 2. Pitch (F0) for Jitter
    f0, voiced_flag, voiced_probs = librosa.pyin(audio_array, fmin=75, fmax=300, sr=sample_rate)
    f0 = f0[~np.isnan(f0)] # Remove NaNs

    if len(f0) < 2: return None # Not enough tonal audio
    
    # 3. Jitter (Frequency Instability)
    periods = 1.0 / f0
    jitter = np.mean(np.abs(np.diff(periods))) / np.mean(periods) * 100 
    
    # 4. Shimmer (Amplitude Instability)
    hop_length = 512
    rms = librosa.feature.rms(y=audio_array, frame_length=1024, hop_length=hop_length)[0]
    
    # Resize RMS to match F0 length roughly
    target_len = min(len(rms), len(f0))
    rms = rms[:target_len]
    
    if len(rms) < 2: return None
    shimmer = np.mean(np.abs(np.diff(rms))) / np.mean(rms) * 100 
    
    # 5. HNR (Harmonics to Noise Ratio)
    harmonic = librosa.effects.harmonic(audio_array)
    energy_total = np.sum(audio_array ** 2)
    energy_harmonic = np.sum(harmonic ** 2)
    noise_energy = energy_total - energy_harmonic
    if noise_energy <= 0: noise_energy = 0.00001
    hnr = 10 * np.log10(energy_harmonic / noise_energy)

    # Return in the EXACT order as training: [Jitter, Shimmer, HNR, MFCC]
    return [jitter, shimmer, hnr, mfcc]

def analyze_voice():
    print("\n--- LIVE VOICE TREMOR DETECTOR ---")
    
    # 1. Load Brain
    try:
        model = joblib.load(MODEL_FILE)
        scaler = joblib.load(SCALER_FILE)
        print("✅ Model loaded successfully.")
    except FileNotFoundError:
        print(f"❌ Error: Could not find '{MODEL_FILE}'. Make sure it is in this folder!")
        return

    while True:
        input("\nPress Enter to start recording (or Ctrl+C to quit)...")
        print(f"🎤 Recording for {DURATION} seconds... (Say 'Ahhhhhh')")
        
        # 2. Record
        audio = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1)
        sd.wait()
        print("Analyzing...")

        # Flatten audio (remove channel dimension)
        audio = audio.flatten()
        
        # Trim silence (so we analyze voice, not empty room noise)
        audio, _ = librosa.effects.trim(audio, top_db=20)

        # 3. Extract Features
        features = extract_features(audio, SAMPLE_RATE)

        if features is None:
            print("❌ Could not detect a clear voice. Please speak louder or hold the note longer.")
            continue

        # 4. Predict
        # Reshape for model (1 sample, 4 features)
        feat_array = np.array([features])
        
        # Scale inputs (Crucial!)
        feat_scaled = scaler.transform(feat_array)
        
        prediction = model.predict(feat_scaled)[0]
        probs = model.predict_proba(feat_scaled)[0]
        confidence = np.max(probs) * 100

        # 5. Result
        jitter, shimmer, hnr, mfcc = features
        print("-" * 40)
        print(f"📊 MEASUREMENTS:")
        print(f"   Jitter (Pitch Shake):  {jitter:.2f}%  (Normal < 1.0%)")
        print(f"   Shimmer (Vol Shake):   {shimmer:.2f}%  (Normal < 3.0%)")
        print(f"   HNR (Breathiness):     {hnr:.1f} dB    (Normal > 20 dB)")
        print("-" * 40)
        
        if prediction == 0:
            print(f"✅ RESULT: HEALTHY / STEADY ({confidence:.1f}% confidence)")
        else:
            print(f"⚠️ RESULT: TREMOR DETECTED ({confidence:.1f}% confidence)")

if __name__ == "__main__":
    try:
        analyze_voice()
    except KeyboardInterrupt:
        print("\nExiting...")