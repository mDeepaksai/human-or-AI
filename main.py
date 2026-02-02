from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, constr
import base64
from model import VoiceClassifier

app = FastAPI(title="AI Voice Detection API", version="1.0")

# Instantiate classifier
classifier = VoiceClassifier()

# Set your secret API key
API_KEY = "sk_test_123456789"

# Request body model
class VoiceRequest(BaseModel):
    language: constr(to_lower=False)  # Tamil, English, Hindi, Malayalam, Telugu
    audioFormat: constr(to_lower=True)  # must be "mp3"
    audioBase64: str  # Base64-encoded MP3

@app.post("/api/voice-detection")
def detect_voice(request: VoiceRequest, x_api_key: str = Header(...)):
    # --- API Key validation ---
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key or malformed request")

    # --- Validate audio format ---
    if request.audioFormat.lower() != "mp3":
        raise HTTPException(status_code=400, detail="Only MP3 format is supported")

    # --- Decode Base64 ---
    try:
        audio_bytes = base64.b64decode(request.audioBase64)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Base64 audio data")

    # --- Predict ---
    try:
        classification, confidence, explanation = classifier.predict(audio_bytes, request.language)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # --- Return response ---
    return {
        "status": "success",
        "language": request.language,
        "classification": classification,
        "confidenceScore": round(confidence, 2),
        "explanation": explanation
    }

# --- Health check endpoint ---
@app.get("/health")
def health_check():
    return {"status": "ok"}
