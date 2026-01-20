import serial
import time
import csv
import pandas as pd

# --- CONFIGURATION ---
# CHANGE THIS to your Arduino's port! 
# Windows: 'COM3', 'COM4', etc. | Mac: '/dev/tty.usbmodem...'
SERIAL_PORT = 'COM7' 
BAUD_RATE = 115200
OUTPUT_FILE = 'training_data.csv'
RECORD_DURATION = 10 # Seconds per session

def collect_data():
    # 1. Connect to Arduino
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"✅ Connected to {SERIAL_PORT}")
        time.sleep(2) # Give Arduino time to reset
    except Exception as e:
        print(f"❌ Could not connect: {e}")
        return

    # 2. Prepare CSV File
    # We check if file exists to avoid overwriting headers
    try:
        with open(OUTPUT_FILE, 'x', newline='') as f:
            writer = csv.writer(f)
            # Write Header
            writer.writerow(["Timestamp", "AccelX", "AccelY", "AccelZ", 
                             "GyroX", "GyroY", "GyroZ", "FSR", "Label"])
    except FileExistsError:
        pass # File exists, we will append to it

    # 3. Main Recording Loop
    while True:
        print("\n--- NEW RECORDING SESSION ---")
        print("Enter the LABEL for the data you are about to record.")
        print("Examples: '0' for No Tremor, '1' for Tremor, '2' for Voluntary Move")
        label = input("Label (or type 'exit' to quit): ")
        
        if label.lower() == 'exit':
            break
            
        print(f"--> Get ready! Recording '{label}' in 2 seconds...")
        time.sleep(2)
        print("--> RECORDING NOW... (Keep moving!)")
        
        start_time = time.time()
        data_buffer = []

        # Flush buffer so we don't get old data
        ser.reset_input_buffer()

        while (time.time() - start_time) < RECORD_DURATION:
            if ser.in_waiting > 0:
                try:
                    # Read line from Arduino
                    line = ser.readline().decode('utf-8').strip()
                    
                    # Basic validation to ensure line isn't empty or corrupted
                    if line and len(line.split(',')) == 8: 
                        # Append the label to the row
                        row = line.split(',') + [label]
                        data_buffer.append(row)
                except:
                    pass # Ignore read errors

        # 4. Save Buffer to File
        with open(OUTPUT_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(data_buffer)
            
        print(f"✅ Saved {len(data_buffer)} samples to {OUTPUT_FILE}")

    ser.close()
    print("Connection closed.")

if __name__ == "__main__":
    collect_data()