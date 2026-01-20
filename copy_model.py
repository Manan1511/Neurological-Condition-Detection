import shutil
import os

src = 'parkinson_tremor_model.pkl'
dst = 'api/parkinson_tremor_model.pkl'

if os.path.exists(src):
    shutil.copy(src, dst)
    print(f"Copied {src} to {dst}")
else:
    print(f"Source {src} not found in {os.getcwd()}")
