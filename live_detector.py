import serial
import time
import joblib
import pandas as pd
import numpy as np
from collections import deque
from scipy.fft import fft, fftfreq

# --- CONFIGURATION ---
SERIAL_PORT = 'COM7'   # CHECK THIS!
BAUD_RATE = 115200
MODEL_FILE = 'parkinson_tremor_model.pkl'
WINDOW_SIZE = 100      # Must match training (2 seconds)
SAMPLING_RATE = 50     # Hz

# --- FEATURE EXTRACTION (MUST MATCH TRAINER EXACTLY) ---
def get_features(df_window):
    # 1. Prepare Signals
    acc_mag = np.sqrt(df_window['AccelX']**2 + df_window['AccelY']**2 + df_window['AccelZ']**2)
    acc_mag = acc_mag - np.mean(acc_mag) 
    fsr_signal = df_window['FSR'].values

    # 2. Frequency Domain
    N = len(acc_mag)
    yf = fft(acc_mag.values)
    xf = fftfreq(N, 1 / SAMPLING_RATE)
    
    positive_freqs = xf[:N//2]
    positive_mags = 2.0/N * np.abs(yf[0:N//2])
    
    # Features
    dom_freq_index = np.argmax(positive_mags)
    dom_freq = positive_freqs[dom_freq_index]
    
    tremor_band_mask = (positive_freqs >= 3.5) & (positive_freqs <= 7.5)
    tremor_energy = np.sum(positive_mags[tremor_band_mask])
    
    voluntary_band_mask = (positive_freqs > 0.1) & (positive_freqs < 3.0)
    voluntary_energy = np.sum(positive_mags[voluntary_band_mask])

    # 3. Time Domain
    acc_std = np.std(acc_mag)
    fsr_mean = np.mean(fsr_signal)
    fsr_std = np.std(fsr_signal)

    # Return as list of values in specific order (dict keys aren't ordered reliably)
    # Order: dom_freq, tremor_energy, voluntary_energy, acc_std, fsr_mean, fsr_std
    return [dom_freq, tremor_energy, voluntary_energy, acc_std, fsr_mean, fsr_std]

# --- MAIN LOOP ---
def run_live_detection():
    # 1. Load Model
    print("Loading Brain (Model)...")
    try:
        model = joblib.load(MODEL_FILE)
    except FileNotFoundError:
        print("❌ Model file not found. Run 'train_model.py' first!")
        return

    # 2. Connect to Arduino
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"✅ Connected to {SERIAL_PORT}")
        time.sleep(2) # Allow Arduino reset
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return

    # 3. The Rolling Buffer
    # This deque will automatically pop the oldest item when a new one is added
    data_buffer = deque(maxlen=WINDOW_SIZE)
    
    print("\n--- STARTING DETECTION ---")
    print("Waiting for buffer to fill (2 seconds)...")

    ser.reset_input_buffer()

    while True:
        try:
            # Read line
            raw_line = ser.readline()
            
            # Debug Print 1: See if we get ANY bytes
            # print(f"Raw bytes: {raw_line}") 
            
            line = raw_line.decode('utf-8').strip()
            
            # Debug Print 2: See the text
            print(f"Received: '{line}'") 

            parts = line.split(',')
            
            # Debug Print 3: See why it fails validation
            if len(parts) != 8:
                print(f"❌ REJECTED: Has {len(parts)} columns, expected 8.")
            
            if line and len(line.split(',')) == 8:
                parts = line.split(',')
                # Parse the raw line into a dictionary
                # Timestamp, AccelX, AccelY, AccelZ, GyroX, GyroY, GyroZ, FSR
                row = {
                    'AccelX': float(parts[1]),
                    'AccelY': float(parts[2]),
                    'AccelZ': float(parts[3]),
                    'FSR':    int(parts[7])
                }
                data_buffer.append(row)

                # Only predict if we have enough data (2 seconds worth)
                if len(data_buffer) == WINDOW_SIZE:
                    
                    # Convert buffer to DataFrame for easier math
                    df_window = pd.DataFrame(data_buffer)
                    
                    # Extract Features
                    features = get_features(df_window)
                    
                    # Predict (Reshape because model expects a list of rows)
                    # Predict (Reshape because model expects a list of rows)
                    prediction = model.predict([features])[0]
                    
                    # Get the actual frequency calculated by the math
                    real_freq = features[0] 

                    # --- LOGIC GATE (The Fix) ---
                    # If AI predicts "Tremor" (1), double-check the math.
                    # If the frequency is NOT between 3.5Hz and 7.5Hz, override the AI.
                    if prediction == 1:
                        if real_freq < 3.5 or real_freq > 7.5:
                            prediction = 2 # Force to "Voluntary"
                            # Optional: Print a debug message so you know it happened
                            # print(f" [Correction] Ignored {real_freq:.1f}Hz (Too slow)")

                    # --- DISPLAY RESULTS ---
                    if prediction == 1: # Tremor
                        status = "⚠️  TREMOR DETECTED! (4-6Hz)"
                    elif prediction == 2: # Voluntary
                        status = "✋  Voluntary Movement"
                    else:
                        status = "✅  Rest / Static"

                    # Print formatted output
                    print(f"\rStatus: {status: <30} | Freq: {real_freq:.1f}Hz | FSR: {features[4]:.0f}", end="")

        except KeyboardInterrupt:
            print("\n\nStopping...")
            break
        except Exception as e:
            pass # Ignore random serial glitches

    ser.close()

if __name__ == "__main__":
    run_live_detection()