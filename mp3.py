import base64
import re
with open(r"C:\Users\mdeep\Downloads\aaa.mp3", "rb") as f: 
    b64 = base64.b64encode(f.read()).decode() 
    
b64_clean = re.sub(r'//.*', '', b64) 
print(b64_clean)
# print(b64)