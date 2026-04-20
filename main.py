import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import VoiceClassifier

load_dotenv()

# --- Config ---
API_KEY = os.environ.get("API_KEY", "deeps@simi")
MODEL_PATH = os.environ.get("MODEL_PATH", "voice_ai_detector.pkl")
MAX_AUDIO_SIZE_MB = 10
MAX_AUDIO_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024
SUPPORTED_LANGUAGES = {"tamil", "english", "hindi", "malayalam", "telugu"}
SUPPORTED_FORMATS = {"mp3", "wav"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

classifier: VoiceClassifier | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global classifier
    logger.info("Loading VoiceClassifier...")
    classifier = VoiceClassifier()
    logger.info("VoiceClassifier ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="AI Voice Detection API",
    version="2.0.0",
    description=(
        "Upload an MP3/WAV file and get back a Human vs AI-Generated classification. "
        "Send as multipart/form-data with fields: `language`, `file`."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def verify_api_key(x_api_key: str = Header(..., description="Your API key")):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class VoiceResponse(BaseModel):
    requestId: str
    status: str
    language: str
    filename: str
    classification: str
    confidenceScore: float
    explanation: str
    processingTimeMs: float


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "req_id=%s method=%s path=%s status=%d duration=%.1fms",
        request_id, request.method, request.url.path,
        response.status_code, duration_ms,
    )
    return response


@app.get("/", tags=["Info"])
def welcome():
    return {
        "name": "AI Voice Detection API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "detect": "POST /api/voice-detection  (multipart/form-data)",
        "supportedLanguages": sorted(SUPPORTED_LANGUAGES),
        "supportedFormats": sorted(SUPPORTED_FORMATS),
        "maxAudioSizeMB": MAX_AUDIO_SIZE_MB,
        "builtBy": ["Mallarpu Deepak Sai", "Smriti Kumari"],
    }


@app.get("/health", tags=["Info"])
def health_check():
    return {"status": "ok", "modelLoaded": classifier is not None}


@app.post(
    "/api/voice-detection",
    response_model=VoiceResponse,
    tags=["Detection"],
    summary="Upload an audio file and classify it as Human or AI-generated",
)
async def detect_voice(
    language: str = Form(..., description=f"Spoken language. Options: {sorted(SUPPORTED_LANGUAGES)}"),
    file: UploadFile = File(..., description="Audio file (.mp3 or .wav)"),
    _: None = Depends(verify_api_key),
):
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    language = language.lower().strip()
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{language}'. Supported: {sorted(SUPPORTED_LANGUAGES)}",
        )

    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Upload a .mp3 or .wav file.",
        )

    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_AUDIO_SIZE_MB}MB.",
        )
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    start = time.perf_counter()
    try:
        classification, confidence, explanation = classifier.predict(audio_bytes, language)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Prediction failed for file=%s language=%s", filename, language)
        raise HTTPException(status_code=500, detail="Audio processing failed")

    processing_ms = round((time.perf_counter() - start) * 1000, 2)

    return VoiceResponse(
        requestId=str(uuid.uuid4()),
        status="success",
        language=language,
        filename=filename,
        classification=classification,
        confidenceScore=confidence,
        explanation=explanation,
        processingTimeMs=processing_ms,
    )