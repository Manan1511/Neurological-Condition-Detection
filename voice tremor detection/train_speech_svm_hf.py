import numpy as np
import librosa
import joblib
import soundfile as sf
from datasets import load_dataset
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score

# --- CONFIGURATION ---
MODEL_FILE = 'speech_svm_model.pkl'
SCALER_FILE = 'speech_scaler.pkl'
TARGET_SAMPLING_RATE = 16000
MAX_SAMPLES = 800  # Increased for better accuracy

def inject_tremor(audio, sr):
    """
    Synthetically adds Parkinson's-style tremor (3-12Hz) to healthy audio.
    """
    tremor_freq = np.random.uniform(3.0, 10.0)  # Tremor speed
    am_depth = np.random.uniform(0.2, 0.6)      # Amplitude wobble

    t = np.linspace(0, len(audio)/sr, len(audio))
    
    # Amplitude Modulation (Shimmer effect)
    am_envelope = 1.0 + (am_depth * np.sin(2 * np.pi * tremor_freq * t))
    audio_am = audio * am_envelope
    return audio_am

def extract_features(audio_array, sample_rate):
    if len(audio_array) == 0: return None
    
    # 1. MFCC
    mfcc = np.mean(librosa.feature.mfcc(y=audio_array, sr=sample_rate, n_mfcc=13))
    
    # 2. Pitch (F0)
    try:
        f0, _, _ = librosa.pyin(audio_array, fmin=75, fmax=300, sr=sample_rate)
    except:
        return None
        
    f0 = f0[~np.isnan(f0)]
    if len(f0) < 5: return None 
    
    # 3. Jitter
    periods = 1.0 / f0
    jitter = np.mean(np.abs(np.diff(periods))) / np.mean(periods) * 100 
    
    # 4. Shimmer
    rms = librosa.feature.rms(y=audio_array)[0]
    min_len = min(len(rms), len(f0))
    rms = rms[:min_len]
    shimmer = np.mean(np.abs(np.diff(rms))) / np.mean(rms) * 100 

    # 5. HNR
    harmonic = librosa.effects.harmonic(audio_array)
    noise = audio_array - harmonic
    hnr = 10 * np.log10(np.sum(harmonic**2) / (np.sum(noise**2) + 1e-10))

    return [jitter, shimmer, hnr, mfcc]

def prepare_synthetic_dataset():
    print("⬇️  Loading Healthy Data (LibriSpeech)...")
    ds = load_dataset("librispeech_asr", "clean", split="train.100", streaming=True, trust_remote_code=True)
    
    features = []
    labels = []
    
    count = 0
    print("⚙️  Generating Synthetic Dataset...")
    
    for sample in ds:
        if count >= MAX_SAMPLES: break
        
        audio = sample['audio']['array']
        sr = sample['audio']['sampling_rate']
        
        # 1. Resample to 16k
        if sr != TARGET_SAMPLING_RATE:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SAMPLING_RATE)
            
        # 2. TRIM SILENCE (Crucial Fix)
        audio, _ = librosa.effects.trim(audio, top_db=20)
        
        # Skip if audio became too short after trimming
        if len(audio) < 1000: continue

        # --- CLASS 0: HEALTHY ---
        feats_healthy = extract_features(audio, TARGET_SAMPLING_RATE)
        if feats_healthy:
            features.append(feats_healthy)
            labels.append(0) 

        # --- CLASS 1: SICK (Synthetic) ---
        audio_sick = inject_tremor(audio, TARGET_SAMPLING_RATE)
        feats_sick = extract_features(audio_sick, TARGET_SAMPLING_RATE)
        if feats_sick:
            features.append(feats_sick)
            labels.append(1)
            
        count += 1
        print(f"   Processed {count}/{MAX_SAMPLES} pairs...", end='\r')

    return np.array(features), np.array(labels)

def train_svm():
    X, y = prepare_synthetic_dataset()
    print(f"\n\nDataset Ready: {len(X)} samples.")
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("🧠 Training SVM...")
    svm = SVC(kernel='rbf', C=10.0, probability=True, random_state=42)
    svm.fit(X_train_scaled, y_train)
    
    preds = svm.predict(X_test_scaled)
    acc = accuracy_score(y_test, preds)
    print(f"\n✅ Model Accuracy: {acc*100:.2f}%")
    
    # Save to current folder
    joblib.dump(svm, MODEL_FILE)
    joblib.dump(scaler, SCALER_FILE)
    print("Files saved. Now run 'copy_voice_model.py' to update the API.")

if __name__ == "__main__":
    train_svm()