"""
上传模型文件到 Hugging Face
在你本地电脑运行: python3 upload_to_hf.py
需要: pip install huggingface_hub
"""
import os
from huggingface_hub import HfApi

TOKEN = input("Enter your Hugging Face token: ").strip()
REPO = "stone2010/moon-model"
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "ai_data")

api = HfApi(token=TOKEN)

# 创建仓库
print(f"Creating repo {REPO}...")
api.create_repo(REPO, exist_ok=True, repo_type="model")

# 上传所有 json 文件
files = [f for f in os.listdir(MODEL_DIR) if f.endswith(".json")]
print(f"Uploading {len(files)} files...")

for f in sorted(files):
    path = os.path.join(MODEL_DIR, f)
    print(f"  {f} ({os.path.getsize(path)/1024/1024:.1f}MB)")
    api.upload_file(
        path_or_fileobj=path,
        path_in_repo=f,
        repo_id=REPO,
        repo_type="model",
    )

print(f"\nDone! Files uploaded to https://huggingface.co/{REPO}")
print(f"CDN URL: https://huggingface.co/{REPO}/resolve/main/{{filename}}")
