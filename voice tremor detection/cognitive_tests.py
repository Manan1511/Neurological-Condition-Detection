import serial
import time
import numpy as np
import pandas as pd
import sounddevice as sd
import librosa
from scipy.fft import fft, fftfreq
from scipy.signal import find_peaks

# --- CONFIGURATION ---
SERIAL_PORT = 'COM3'   # <--- UPDATE THIS to match your Arduino Port
BAUD_RATE = 115200
SAMPLING_RATE_SENSOR = 50 # Hz (Arduino)
SAMPLING_RATE_AUDIO = 22050 # Hz (Microphone)

class CognitiveAssessments:
    def __init__(self):
        self.ser = None
        self.connect_arduino()

    def connect_arduino(self):
        try:
            self.ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            print(f"✅ Connected to Sensor Device at {SERIAL_PORT}")
            time.sleep(2) # Reset time
            self.ser.reset_input_buffer()
        except Exception as e:
            print(f"❌ Connection Error: {e}")
            print("Ensure Arduino is plugged in and 'data_logger.py' is NOT running.")

    def read_sensor_data(self, duration_sec):
        """Records data from Arduino for N seconds."""
        if not self.ser: return pd.DataFrame()
        
        print(f"   Recording Sensor Data for {duration_sec}s...")
        data = []
        start_time = time.time()
        self.ser.reset_input_buffer()

        while (time.time() - start_time) < duration_sec:
            try:
                line = self.ser.readline().decode('utf-8').strip()
                if line:
                    parts = line.split(',')
                    if len(parts) == 8:
                        # Parsing existing format: Timestamp, AccelX, Y, Z, GyroX, Y, Z, FSR
                        row = {
                            'Timestamp': float(parts[0]),
                            'AccelX': float(parts[1]), 'AccelY': float(parts[2]), 'AccelZ': float(parts[3]),
                            'GyroX': float(parts[4]), 'GyroY': float(parts[5]), 'GyroZ': float(parts[6]),
                            'FSR': int(parts[7])
                        }
                        data.append(row)
            except:
                pass
        
        return pd.DataFrame(data)

    def record_audio(self, duration_sec):
        """Records audio from PC microphone."""
        print(f"   Recording Audio for {duration_sec}s...")
        recording = sd.rec(int(duration_sec * SAMPLING_RATE_AUDIO), 
                           samplerate=SAMPLING_RATE_AUDIO, channels=1)
        sd.wait() # Wait for recording to finish
        return recording.flatten()

    # ==========================================
    # TEST 1: Rapid Tap Test (Speed/Fatigue)
    # ==========================================
    def test_rapid_tap(self):
        print("\n=== 1. RAPID TAP TEST ===")
        print("INSTRUCTIONS: Tap the pressure sensor as FAST as you can for 15 seconds.")
        input("Press Enter to start...")
        
        df = self.read_sensor_data(15)
        if df.empty: return

        # Logic: Find peaks in FSR data
        fsr_signal = df['FSR'].values
        # Threshold: Assuming resting is ~300, tap is > 600
        peaks, properties = find_peaks(fsr_signal, height=600, distance=5) 
        
        num_taps = len(peaks)
        duration = 15
        taps_per_sec = num_taps / duration

        # Fatigue: First 5 taps vs Last 5 taps amplitude
        if num_taps >= 10:
            avg_start = np.mean(properties['peak_heights'][:5])
            avg_end = np.mean(properties['peak_heights'][-5:])
            fatigue_decay = (avg_start - avg_end) / avg_start
        else:
            fatigue_decay = 0.0

        print("\n--- RESULTS ---")
        print(f"Total Taps: {num_taps}")
        print(f"Speed: {taps_per_sec:.2f} taps/sec (Healthy > 4Hz)")
        print(f"Fatigue Decay: {fatigue_decay*100:.1f}% (Flag if > 30%)")
        
        if taps_per_sec < 4.0: print("⚠️  Flag: Bradykinesia Detected (Slow Tapping)")
        if fatigue_decay > 0.30: print("⚠️  Flag: Motor Fatigue Detected")

    # ==========================================
    # TEST 2: Resting Tremor (Steady Hold - Lap)
    # ==========================================
    def test_resting_tremor(self):
        print("\n=== 2. RESTING TREMOR TEST ===")
        print("INSTRUCTIONS: Rest hands on thighs, palms up. Relax completely.")
        input("Press Enter to start (10s)...")

        df = self.read_sensor_data(10)
        if df.empty: return

        # Calc Magnitude
        acc_mag = np.sqrt(df['AccelX']**2 + df['AccelY']**2 + df['AccelZ']**2)
        acc_mag = acc_mag - np.mean(acc_mag)

        # FFT
        N = len(acc_mag)
        yf = fft(acc_mag.values)
        xf = fftfreq(N, 1 / SAMPLING_RATE_SENSOR)
        
        pos_freqs = xf[:N//2]
        pos_mags = 2.0/N * np.abs(yf[0:N//2])

        # Check 3-6Hz band (Parkinson's Resting Tremor)
        mask = (pos_freqs >= 3.0) & (pos_freqs <= 6.0)
        tremor_energy = np.sum(pos_mags[mask])
        peak_freq = pos_freqs[np.argmax(pos_mags)]

        print("\n--- RESULTS ---")
        print(f"Dominant Frequency: {peak_freq:.1f} Hz")
        print(f"Tremor Band Energy: {tremor_energy:.2f}")

        if tremor_energy > 5.0 and (3.0 <= peak_freq <= 6.0):
            print("⚠️  Flag: Resting Tremor Detected (PD Indication)")
        else:
            print("✅ Normal / Steady")

    # ==========================================
    # TEST 3: Action Tremor (Arm Out)
    # ==========================================
    def test_action_tremor(self):
        print("\n=== 3. ACTION TREMOR TEST ===")
        print("INSTRUCTIONS: Extend arm fully forward. Hold steady against gravity.")
        input("Press Enter to start (10s)...")

        df = self.read_sensor_data(10)
        if df.empty: return

        acc_mag = np.sqrt(df['AccelX']**2 + df['AccelY']**2 + df['AccelZ']**2)
        acc_mag = acc_mag - np.mean(acc_mag) # Remove gravity DC

        # RMS Amplitude
        rms = np.sqrt(np.mean(acc_mag**2))

        # FFT for frequency
        N = len(acc_mag)
        yf = fft(acc_mag.values)
        xf = fftfreq(N, 1 / SAMPLING_RATE_SENSOR)
        pos_mags = 2.0/N * np.abs(yf[0:N//2])
        peak_freq = xf[np.argmax(pos_mags)]

        print("\n--- RESULTS ---")
        print(f"Tremor Intensity (RMS): {rms:.2f}")
        print(f"Dominant Freq: {peak_freq:.1f} Hz")

        # Essential Tremor is usually higher freq (6-12Hz) and high amplitude against gravity
        if rms > 2.0 and (6.0 <= peak_freq <= 12.0):
            print("⚠️  Flag: Action/Essential Tremor Detected")
        elif rms > 2.0 and peak_freq < 6.0:
            print("⚠️  Flag: High Amplitude Low Freq Tremor")
        else:
            print("✅ Steady")

    # ==========================================
    # TEST 4: Dual-Task Stress Test
    # ==========================================
    def test_dual_task(self):
        print("\n=== 4. DUAL-TASK STRESS TEST ===")
        
        # Phase 1: Baseline
        print("STEP 1: Hold hand steady for 10s (Baseline). Silence.")
        input("Press Enter...")
        df_base = self.read_sensor_data(10)
        
        acc_base = np.sqrt(df_base['AccelX']**2 + df_base['AccelY']**2 + df_base['AccelZ']**2)
        var_base = np.var(acc_base)
        print(f"-> Baseline Variance: {var_base:.4f}")

        # Phase 2: Stress
        print("\nSTEP 2: Keep holding steady AND count backward from 100 by 7s out loud!")
        print("(e.g., '100, 93, 86...')")
        input("Press Enter to start...")
        
        # Start Audio recording in background (we just use 'record_audio' which is blocking, 
        # so for true simultaneity we'd need threads, but sequential recording is fine for logic check)
        # Note: In a real app, use threading. Here we will rely on user honesty or record concurrently.
        # To keep it simple, we will record sensor data, and assume they are speaking.
        
        print("   Recording (Speak loud!)...")
        df_dual = self.read_sensor_data(10)
        
        acc_dual = np.sqrt(df_dual['AccelX']**2 + df_dual['AccelY']**2 + df_dual['AccelZ']**2)
        var_dual = np.var(acc_dual)
        
        # Calculate Cost
        if var_base == 0: var_base = 0.0001
        pct_change = ((var_dual - var_base) / var_base) * 100

        print("\n--- RESULTS ---")
        print(f"Dual Task Variance: {var_dual:.4f}")
        print(f"Cognitive Cost: {pct_change:.1f}% increase in shake")

        if pct_change > 30.0:
            print("⚠️  Flag: High Cognitive-Motor Interference (>30%)")
        else:
            print("✅ Normal Tolerance")

    # ==========================================
    # TEST 5: Point-to-Point (Coordination)
    # ==========================================
    def test_coordination(self):
        print("\n=== 5. COORDINATION (POINT-TO-POINT) ===")
        print("INSTRUCTIONS: Hold device at chest. Extend arm FULLY and STOP suddenly.")
        input("Press Enter to start recording (Perform motion 3 times)...")
        
        df = self.read_sensor_data(10)
        if df.empty: return

        # Analyze Y-axis (Forward movement)
        acc_y = df['AccelY'].values
        
        # Identify Stops: Large deceleration (negative spike in derivative)
        # Simple derivative
        jerk = np.diff(acc_y)
        
        # Find points of maximum deceleration (stopping the punch)
        # We look for large negative peaks
        stop_indices, _ = find_peaks(-jerk, height=5.0, distance=50) # Height depends on sensor scale
        
        if len(stop_indices) == 0:
            print("❌ No sharp stops detected. Try creating more force.")
            return

        print(f"Detected {len(stop_indices)} stops.")
        
        # Analyze settling time after the first stop
        idx = stop_indices[0]
        # Look at 1 second (50 samples) after stop
        post_stop_window = acc_y[idx:idx+50]
        
        # Dysmetria check: Calculate "Wobble" energy (Standard Deviation after stop)
        wobble_score = np.std(post_stop_window)
        
        print("\n--- RESULTS ---")
        print(f"Settling Wobble Score: {wobble_score:.2f}")
        
        if wobble_score > 2.0: # Threshold needs calibration
            print("⚠️  Flag: Dysmetria / Overshoot Detected")
        else:
            print("✅ Good Motor Control")

    # ==========================================
    # TEST 6: Blind Drift (Proprioception)
    # ==========================================
    def test_blind_drift(self):
        print("\n=== 6. BLIND DRIFT TEST ===")
        print("INSTRUCTIONS: Hold hand flat. Close eyes. Maintain position for 20s.")
        input("Press Enter to start...")
        
        df = self.read_sensor_data(20)
        if df.empty: return

        # Integrate Gyro to get Angle Drift
        # Gyro data is usually deg/sec or rad/sec. Assuming deg/sec based on typical Arduino MPUs.
        gyro_x = df['GyroX'].values
        dt = 1.0 / SAMPLING_RATE_SENSOR
        
        # Simple Integration: Angle = Sum(Rate * dt)
        drift_x = np.sum(gyro_x * dt)
        
        print("\n--- RESULTS ---")
        print(f"Total Drift (Roll/Pitch): {abs(drift_x):.1f} degrees")
        
        if abs(drift_x) > 15.0:
            print("⚠️  Flag: Poor Proprioception (>15 deg drift)")
        else:
            print("✅ Good Position Sense")

    # ==========================================
    # TEST 7: Vocal Motor ("Ahhh")
    # ==========================================
    def test_vocal_motor(self):
        print("\n=== 7. VOCAL MOTOR TEST ===")
        print("INSTRUCTIONS: Take a deep breath. Say 'Ahhhhh' as steady as possible.")
        input("Press Enter to start recording (10s)...")

        y = self.record_audio(10)
        
        # Trim silence
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        
        if len(y_trimmed) < SAMPLING_RATE_AUDIO: # Less than 1 sec
            print("❌ No audio detected.")
            return

        # 1. MPT (Maximum Phonation Time)
        duration = len(y_trimmed) / SAMPLING_RATE_AUDIO
        
        # 2. Extract Pitch (F0) using PyIN
        f0, voiced_flag, voiced_probs = librosa.pyin(y_trimmed, fmin=75, fmax=300)
        f0 = f0[~np.isnan(f0)] # Remove NaNs

        # 3. Calculate Jitter (Frequency Instability)
        if len(f0) > 1:
            # Absolute difference between consecutive periods
            # Jitter (local) formula: sum(|T_i - T_{i-1}|) / sum(T_i)
            # T = 1/f0
            periods = 1.0 / f0
            jitter = np.mean(np.abs(np.diff(periods))) / np.mean(periods)
        else:
            jitter = 0.0

        print("\n--- RESULTS ---")
        print(f"Phonation Time (MPT): {duration:.1f} sec (Healthy > 10s)")
        print(f"Jitter (Pitch Instability): {jitter*100:.2f}% (Flag > 1.0%)")

        if duration < 10.0: print("⚠️  Flag: Hypophonia / Low Breath Support")
        if jitter * 100 > 1.04: print("⚠️  Flag: Vocal Tremor Detected")

    # ==========================================
    # MAIN MENU
    # ==========================================
    def run(self):
        while True:
            print("\n" + "="*40)
            print("   NEURO-COGNITIVE TEST SUITE")
            print("="*40)
            print("1. Rapid Tap (Bradykinesia/Fatigue)")
            print("2. Resting Tremor (Steady Hold - Lap)")
            print("3. Action Tremor (Steady Hold - Arm Out)")
            print("4. Dual-Task Stress (Cognition)")
            print("5. Point-to-Point (Coordination)")
            print("6. Blind Drift (Proprioception)")
            print("7. Vocal Motor ('Ahhh' Test)")
            print("Q. Quit")
            
            choice = input("\nSelect Test: ").upper()
            
            if choice == '1': self.test_rapid_tap()
            elif choice == '2': self.test_resting_tremor()
            elif choice == '3': self.test_action_tremor()
            elif choice == '4': self.test_dual_task()
            elif choice == '5': self.test_coordination()
            elif choice == '6': self.test_blind_drift()
            elif choice == '7': self.test_vocal_motor()
            elif choice == 'Q': break
            else: print("Invalid selection.")

if __name__ == "__main__":
    app = CognitiveAssessments()
    try:
        app.run()
    except KeyboardInterrupt:
        print("\nExiting...")
        if app.ser: app.ser.close()