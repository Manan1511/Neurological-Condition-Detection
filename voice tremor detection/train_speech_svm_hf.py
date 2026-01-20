import numpy as np
import pandas as pd
import librosa
import joblib
from datasets import load_dataset, Audio
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score

# --- CONFIGURATION ---
MODEL_FILE = 'speech_svm_model.pkl'
SCALER_FILE = 'speech_scaler.pkl'
TARGET_SAMPLING_RATE = 16000 # Standardize all audio to 16kHz
MAX_SAMPLES_PER_CLASS = 150  # Limit samples to speed up training

def extract_features(audio_array, sample_rate):
    """
    Extracts Jitter, Shimmer, HNR, and MFCC from raw audio.
    """
    if len(audio_array) == 0: return None
    
    # 1. MFCC (Timbre/Spectral Envelope)
    mfcc = np.mean(librosa.feature.mfcc(y=audio_array, sr=sample_rate, n_mfcc=13))
    
    # 2. Pitch (F0) Extraction for Jitter/Shimmer
    # We use pyin for robust pitch tracking
    f0, voiced_flag, voiced_probs = librosa.pyin(audio_array, fmin=75, fmax=300, sr=sample_rate)
    f0 = f0[~np.isnan(f0)] # Remove NaNs

    if len(f0) < 2: 
        return None # Not enough tonal audio to analyze
    
    # 3. Jitter (Frequency Instability)
    periods = 1.0 / f0
    jitter = np.mean(np.abs(np.diff(periods))) / np.mean(periods) * 100 # %
    
    # 4. Shimmer (Amplitude Instability)
    # Calculate RMS amplitude per frame
    hop_length = 512
    rms = librosa.feature.rms(y=audio_array, frame_length=1024, hop_length=hop_length)[0]
    
    # Resize RMS to match F0 length (roughly) for calculation
    target_len = min(len(rms), len(f0))
    rms = rms[:target_len]
    
    if len(rms) < 2: return None
    
    shimmer = np.mean(np.abs(np.diff(rms))) / np.mean(rms) * 100 # %
    
    # 5. HNR (Harmonics to Noise Ratio)
    harmonic = librosa.effects.harmonic(audio_array)
    energy_total = np.sum(audio_array ** 2)
    energy_harmonic = np.sum(harmonic ** 2)
    noise_energy = energy_total - energy_harmonic
    if noise_energy <= 0: noise_energy = 0.00001
    hnr = 10 * np.log10(energy_harmonic / noise_energy)

    return [jitter, shimmer, hnr, mfcc]

def prepare_dataset():
    print("⬇️  Loading Datasets from Hugging Face...")
    
    data_features = []
    data_labels = [] # 0 = Healthy, 1 = Pathological

    # --- A. LOAD HEALTHY DATA (LibriSpeech) ---
    print("   Fetching Healthy samples (LibriSpeech)...")
    # Streaming mode (streaming=True) lets us grab just a few files without downloading 50GB
    ds_healthy = load_dataset("librispeech_asr", "clean", split="train.100", streaming=True, trust_remote_code=True)
    
    count = 0
    for sample in ds_healthy:
        if count >= MAX_SAMPLES_PER_CLASS: break
        
        # Resample to target rate
        audio = sample['audio']['array']
        sr = sample['audio']['sampling_rate']
        if sr != TARGET_SAMPLING_RATE:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SAMPLING_RATE)
            
        feats = extract_features(audio, TARGET_SAMPLING_RATE)
        if feats:
            data_features.append(feats)
            data_labels.append(0) # Label 0 = Healthy
            count += 1
            print(f"   [Healthy] Processed {count}/{MAX_SAMPLES_PER_CLASS}", end='\r')
    
    print("")

    # --- B. LOAD PATHOLOGICAL DATA (TORGO - Dysarthric Speech) ---
    print("   Fetching Pathological samples (TORGO Dysarthric)...")
    # Using a specific slice of TORGO available on HF
    # Note: If this specific dataset ID is unavailable, 'birgermoell/synthetic_dysathria' is a good backup
    try:
        ds_pathology = load_dataset("resproj007/torgo_dysarthric_male", split="train", streaming=True)
    except:
        print("⚠️  TORGO dataset busy/unavailable. Switching to Synthetic Dysarthria backup...")
        ds_pathology = load_dataset("birgermoell/synthetic_dysathria", split="train", streaming=True)

    count = 0
    for sample in ds_pathology:
        if count >= MAX_SAMPLES_PER_CLASS: break
        
        audio = sample['audio']['array']
        sr = sample['audio']['sampling_rate']
        
        # Ensure audio is mono
        if len(audio.shape) > 1: 
            audio = np.mean(audio, axis=1)

        if sr != TARGET_SAMPLING_RATE:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SAMPLING_RATE)

        feats = extract_features(audio, TARGET_SAMPLING_RATE)
        if feats:
            data_features.append(feats)
            data_labels.append(1) # Label 1 = Pathological (Tremor/Dysarthria)
            count += 1
            print(f"   [Pathology] Processed {count}/{MAX_SAMPLES_PER_CLASS}", end='\r')

    print("\n✅ Dataset creation complete.")
    return np.array(data_features), np.array(data_labels)

def train_svm():
    X, y = prepare_dataset()
    
    print(f"\nTraining on {len(X)} samples...")
    
    # 1. Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 2. Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # 3. Train SVM
    # RBF kernel is best for non-linear boundaries in voice data
    svm = SVC(kernel='rbf', C=10, gamma='scale', probability=True, random_state=42)
    svm.fit(X_train_scaled, y_train)
    
    # 4. Evaluate
    preds = svm.predict(X_test_scaled)
    acc = accuracy_score(y_test, preds)
    
    print(f"\n--- RESULTS ---")
    print(f"Model Accuracy: {acc*100:.2f}%")
    print(classification_report(y_test, preds, target_names=['Healthy', 'Pathological']))
    
    # 5. Save
    joblib.dump(svm, MODEL_FILE)
    joblib.dump(scaler, SCALER_FILE)
    print(f"✅ Model saved to {MODEL_FILE}")
    print(f"✅ Scaler saved to {SCALER_FILE}")

if __name__ == "__main__":
    train_svm()