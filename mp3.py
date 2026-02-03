import base64

with open(r"C:\Users\mdeep\Downloads\smiriti.mp3", "rb") as f:
    encoded = base64.b64encode(f.read()).decode("utf-8")

with open("audio_base64.txt", "w") as f:
    f.write(encoded)