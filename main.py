from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, constr
import base64
from model import VoiceClassifier

app = FastAPI(title="AI Voice Detection API", version="1.0")

classifier = VoiceClassifier()

API_KEY = "deeps@simi"


class VoiceRequest(BaseModel):
    language: constr(to_lower=True)
    audioFormat: constr(to_lower=True)
    audioBase64: str


def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
@app.get("/api/voice-detection")
def browser_hint():
    return {
        "message": "This endpoint accepts POST requests only. Use Swagger or API client."
    }

@app.get("/")
def get_welcome_message():
    return {"message": "Welcome to the AI Voice Detection API",
        "docs": "/docs",
        "endpoint": "/api/voice-detection",
        "instructions": "Use /api/voice-detection endpoint to analyze audio.",
        "built_by": "Mallarpu Deepak sai and Smiriti Kumari"
              }

@app.post("/api/voice-detection")
def detect_voice(
    request: VoiceRequest,
    dependency=Depends(verify_api_key)
):
    if request.audioFormat != "mp3":
        raise HTTPException(status_code=400, detail="Only MP3 format is supported")

    try:
        audio_bytes = base64.b64decode(request.audioBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Base64 audio")

    try:
        classification, confidence, explanation = classifier.predict(
            audio_bytes, request.language
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal audio processing error")

    return {
        "status": "success",
        "language": request.language,
        "classification": classification,
        "confidenceScore": round(confidence, 2),
        "explanation": explanation
    }


@app.get("/health")
def health_check(dependency=Depends(verify_api_key)):
    return {"status": "ok"}
