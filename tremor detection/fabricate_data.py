import pandas as pd
import numpy as np
import random

# --- CONFIGURATION ---
OUTPUT_FILE = 'training_data.csv'
SAMPLES_PER_CLASS = 2000 # How many rows to generate per label
SAMPLING_RATE = 50       # Hz
DT = 1.0 / SAMPLING_RATE # Time step (0.02s)

def generate_noise(length, level=0.2):
    """Generates random jitter (sensor noise)"""
    return np.random.normal(0, level, length)

def generate_tremor_segment():
    """
    Simulates Parkinson's: 
    - Rhythmic oscillation (4-6 Hz) in one or two axes
    - Low FSR pressure (Resting)
    """
    t = np.linspace(0, SAMPLES_PER_CLASS * DT, SAMPLES_PER_CLASS)
    
    # 1. Randomize the tremor frequency between 4.0 and 6.0 Hz
    freq = random.uniform(4.0, 6.0)
    
    # 2. Create the wave (Sine wave)
    # We add it mostly to AccelX and AccelY, less to Z
    acc_x = 4.0 * np.sin(2 * np.pi * freq * t) + generate_noise(SAMPLES_PER_CLASS, 0.5)
    acc_y = 2.0 * np.cos(2 * np.pi * freq * t) + generate_noise(SAMPLES_PER_CLASS, 0.5)
    acc_z = 9.8 + generate_noise(SAMPLES_PER_CLASS, 0.3) # Gravity + Noise
    
    # 3. FSR (Resting Tremor = Low pressure, typically just touching skin)
    # Random value between 300 and 320 (steady)
    fsr = np.random.normal(310, 5, SAMPLES_PER_CLASS).astype(int)
    
    df = pd.DataFrame({
        'Timestamp': 0, # <--- ADD THIS DUMMY COLUMN
        'AccelX': acc_x, 'AccelY': acc_y, 'AccelZ': acc_z,
        'GyroX': 0, 'GyroY': 0, 'GyroZ': 0,
        'FSR': fsr,
        'Label': 1 
    })
    return df

def generate_voluntary_segment():
    """
    Simulates Voluntary Movement:
    - Slower, chaotic movements (0.5 - 2 Hz)
    - High FSR pressure (Gripping/Using hand)
    """
    t = np.linspace(0, SAMPLES_PER_CLASS * DT, SAMPLES_PER_CLASS)
    
    # Voluntary moves are slower (approx 1 Hz)
    freq = random.uniform(0.5, 2.0)
    
    acc_x = 8.0 * np.sin(2 * np.pi * freq * t) + generate_noise(SAMPLES_PER_CLASS, 2.0)
    acc_y = 5.0 * np.sin(2 * np.pi * (freq + 0.2) * t) + generate_noise(SAMPLES_PER_CLASS, 2.0)
    acc_z = 9.8 + np.sin(2 * np.pi * 0.5 * t) # Gravity changing as hand tilts
    
    # FSR (Active = High pressure spikes)
    # Base pressure 800, plus variance
    fsr = np.random.normal(800, 100, SAMPLES_PER_CLASS).astype(int)
    
    df = pd.DataFrame({
        'Timestamp': 0, # <--- ADD THIS DUMMY COLUMN
        'AccelX': acc_x, 'AccelY': acc_y, 'AccelZ': acc_z,
        'GyroX': 0, 'GyroY': 0, 'GyroZ': 0,
        'FSR': fsr,
        'Label': 2 
    })
    return df

def generate_rest_segment():
    """
    Simulates Rest:
    - Almost zero movement (just gravity)
    - Constant FSR
    """
    acc_x = generate_noise(SAMPLES_PER_CLASS, 0.1)
    acc_y = generate_noise(SAMPLES_PER_CLASS, 0.1)
    acc_z = 9.8 + generate_noise(SAMPLES_PER_CLASS, 0.1)
    
    fsr = np.random.normal(300, 2, SAMPLES_PER_CLASS).astype(int)
    
    df = pd.DataFrame({
        'Timestamp': 0, # <--- ADD THIS DUMMY COLUMN
        'AccelX': acc_x, 'AccelY': acc_y, 'AccelZ': acc_z,
        'GyroX': 0, 'GyroY': 0, 'GyroZ': 0,
        'FSR': fsr,
        'Label': 0 
    })
    return df

# --- MAIN EXECUTION ---
print("Fabricating data...")

# Generate multiple "sessions" to create variety
df_list = []
for _ in range(10): # Create 10 different variations of each
    df_list.append(generate_rest_segment())
    df_list.append(generate_tremor_segment())
    df_list.append(generate_voluntary_segment())

final_df = pd.concat(df_list, ignore_index=True)

# Shuffle rows isn't right for time-series, but we processed in chunks so it's fine.
# Actually, for training, we just save it as is.

final_df.to_csv(OUTPUT_FILE, index=False)
print(f"Generated {len(final_df)} rows of synthetic data to '{OUTPUT_FILE}'")