import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:8000/api/parse"
file_path = r"C:\Users\Manashjyoti Barman\Downloads\Class VII (1).docx"

with open(file_path, "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)

data = response.json()
for q in data.get("questions", []):
    if q["number"] == 22:
        print(f"Server Q22 Question:\n{q['question']}")
        print(f"Server Q22 Options:\n{q['options']}")
