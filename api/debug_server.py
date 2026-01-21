
import requests
import numpy as np
import json

url = 'http://127.0.0.1:5000/predict_audio'

# Simulate 5 seconds of audio at 44.1kHz
duration = 5
fs = 44100
t = np.linspace(0, duration, int(fs*duration), endpoint=False)
audio = 0.5 * np.sin(2*np.pi*440*t) # 440Hz sine wave

payload = {
    "audio": audio.tolist(),
    "rate": fs
}

print(f"Sending request to {url} with {len(payload['audio'])} samples...")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print("Response:", response.text)
except Exception as e:
    print(f"Request Failed: {e}")
