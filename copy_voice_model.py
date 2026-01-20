import shutil
import os

files = ['speech_svm_model.pkl', 'speech_scaler.pkl']
src_dir = 'voice tremor detection'
dst_dir = 'api'

for f in files:
    src = os.path.join(src_dir, f)
    dst = os.path.join(dst_dir, f)
    if os.path.exists(src):
        shutil.copy(src, dst)
        print(f"Copied {src} to {dst}")
    else:
        print(f"Source {src} not found in {os.getcwd()}")
