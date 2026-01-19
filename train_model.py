import pandas as pd
import numpy as np
from scipy.fft import fft, fftfreq
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

# --- CONFIGURATION ---
INPUT_FILE = 'training_data.csv'
MODEL_FILE = 'parkinson_tremor_model.pkl'
WINDOW_SIZE = 100  # 100 samples @ 50Hz = 2 seconds of data
STEP_SIZE = 50     # 50% overlap (slide window every 1 second)
SAMPLING_RATE = 50 # Hz

def get_features_from_window(window):
    """
    Input: A DataFrame chunk (approx 100 rows)
    Output: A single dictionary (row) of features
    """
    # 1. Prepare Signals
    # Combine Accel X, Y, Z into one "Magnitude" vector to ignore hand orientation
    acc_mag = np.sqrt(window['AccelX']**2 + window['AccelY']**2 + window['AccelZ']**2)
    acc_mag = acc_mag - np.mean(acc_mag) # Remove gravity (DC offset)
    
    fsr_signal = window['FSR'].values

    # 2. Frequency Domain Analysis (FFT) on Acceleration
    N = len(acc_mag)
    yf = fft(acc_mag.values)
    xf = fftfreq(N, 1 / SAMPLING_RATE)
    
    # Take only positive frequencies
    positive_freqs = xf[:N//2]
    positive_mags = 2.0/N * np.abs(yf[0:N//2])
    
    # Feature: Dominant Frequency (The strongest beat)
    dom_freq_index = np.argmax(positive_mags)
    dom_freq = positive_freqs[dom_freq_index]
    
    # Feature: Energy specifically in Parkinson's range (4-7 Hz)
    # We slightly widen the range (4-7) to account for noise
    tremor_band_mask = (positive_freqs >= 3.5) & (positive_freqs <= 7.5)
    tremor_energy = np.sum(positive_mags[tremor_band_mask])
    
    # Feature: Energy in "Voluntary" range (usually < 3 Hz)
    voluntary_band_mask = (positive_freqs > 0.1) & (positive_freqs < 3.0)
    voluntary_energy = np.sum(positive_mags[voluntary_band_mask])

    # 3. Time Domain Features (Statistical)
    acc_std = np.std(acc_mag)      # How violent is the shake?
    fsr_mean = np.mean(fsr_signal) # Are they gripping something?
    fsr_std = np.std(fsr_signal)   # Is the grip changing?

    return {
        'dom_freq': dom_freq,
        'tremor_energy': tremor_energy,
        'voluntary_energy': voluntary_energy,
        'acc_std': acc_std,
        'fsr_mean': fsr_mean,
        'fsr_std': fsr_std
    }

def train():
    print("1. Loading Data...")
    try:
        df = pd.read_csv(INPUT_FILE)
    except FileNotFoundError:
        print("❌ Error: 'training_data.csv' not found. Run the logger first!")
        return

    print(f"   Loaded {len(df)} rows of raw data.")

    # 2. Slice Data into Windows
    print("2. Processing Windows & Extracting Features...")
    X = [] # Features
    y = [] # Labels

    # Slide a window across the dataframe
    for start in range(0, len(df) - WINDOW_SIZE, STEP_SIZE):
        end = start + WINDOW_SIZE
        window = df.iloc[start:end]
        
        # Check Labels: If a window crosses two activities (e.g. half Rest, half Tremor), skip it.
        labels = window['Label'].unique()
        if len(labels) > 1:
            continue 
            
        features = get_features_from_window(window)
        
        X.append(list(features.values()))
        y.append(labels[0])

    feature_names = list(features.keys())
    
    if len(X) == 0:
        print("❌ Error: Not enough data to create windows. Record more data!")
        return

    print(f"   Created {len(X)} training samples (windows).")

    # 3. Train Model
    print("3. Training Random Forest...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_train, y_train)

    # 4. Evaluate
    print("\n--- RESULTS ---")
    predictions = rf.predict(X_test)
    print(f"Accuracy: {rf.score(X_test, y_test)*100:.2f}%")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, predictions))
    print("\nReport:")
    print(classification_report(y_test, predictions))

    # 5. Save Model
    joblib.dump(rf, MODEL_FILE)
    print(f"\n✅ Model saved to '{MODEL_FILE}'")
    print("You can now use this file to detect tremors in real-time.")

if __name__ == "__main__":
    train()