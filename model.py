import io
import logging

import joblib
import librosa
import numpy as np

MODEL_PATH = "voice_ai_detector.pkl"
SUPPORTED_LANGUAGES = {"tamil", "english", "hindi", "malayalam", "telugu"}
MIN_AUDIO_DURATION_SECONDS = 1

logger = logging.getLogger(__name__)


class VoiceClassifier:
    """
    Classifies audio as AI-generated or human using a trained Random Forest.

    Feature vector (88 dimensions):
        - MFCC (20 coefficients): mean + std = 40
        - MFCC delta (20 coefficients): mean + std = 40
        - Spectral centroid: mean + std = 2
        - Zero-crossing rate: mean + std = 2
        - RMS energy: mean + std = 2
        - Spectral rolloff: mean + std = 2
    """

    FEATURE_DIM = 88

    def __init__(self):
        self.model = joblib.load(MODEL_PATH)
        logger.info("VoiceClassifier loaded from %s", MODEL_PATH)

    def extract_features(self, audio_bytes: bytes) -> np.ndarray:
        try:
            audio_buffer = io.BytesIO(audio_bytes)
            y, sr = librosa.load(audio_buffer, sr=16000, mono=True)
        except Exception as e:
            logger.warning("Failed to decode audio: %s", e)
            raise ValueError("Invalid or corrupted audio file")

        duration = len(y) / sr
        if duration < MIN_AUDIO_DURATION_SECONDS:
            raise ValueError(
                f"Audio too short: {duration:.2f}s "
                f"(minimum {MIN_AUDIO_DURATION_SECONDS}s required)"
            )

        features = []

        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        features.extend(np.mean(mfcc, axis=1))
        features.extend(np.std(mfcc, axis=1))

        mfcc_delta = librosa.feature.delta(mfcc)
        features.extend(np.mean(mfcc_delta, axis=1))
        features.extend(np.std(mfcc_delta, axis=1))

        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        features.append(float(np.mean(centroid)))
        features.append(float(np.std(centroid)))

        zcr = librosa.feature.zero_crossing_rate(y)
        features.append(float(np.mean(zcr)))
        features.append(float(np.std(zcr)))

        rms = librosa.feature.rms(y=y)
        features.append(float(np.mean(rms)))
        features.append(float(np.std(rms)))

        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        features.append(float(np.mean(rolloff)))
        features.append(float(np.std(rolloff)))

        feature_vector = np.array(features).reshape(1, -1)
        assert feature_vector.shape[1] == self.FEATURE_DIM, (
            f"Feature dim mismatch: expected {self.FEATURE_DIM}, "
            f"got {feature_vector.shape[1]}"
        )
        return feature_vector

    def predict(self, audio_bytes: bytes, language: str) -> tuple[str, float, str]:
        language = language.lower()
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language '{language}'. "
                f"Supported: {sorted(SUPPORTED_LANGUAGES)}"
            )

        features = self.extract_features(audio_bytes)
        prob = float(self.model.predict_proba(features)[0][1])

        if prob >= 0.75:
            classification = "AI_GENERATED"
            confidence = prob
            explanation = (
                "Strong synthetic voice patterns detected: "
                "unnatural prosody, spectral uniformity, and temporal regularity."
            )
        elif prob >= 0.5:
            classification = "AI_GENERATED"
            confidence = prob
            explanation = (
                "Likely AI-generated: some synthetic artifacts present, "
                "but signal is ambiguous."
            )
        elif prob >= 0.25:
            classification = "HUMAN"
            confidence = 1 - prob
            explanation = (
                "Likely human voice: natural variation detected, "
                "though some ambiguity remains."
            )
        else:
            classification = "HUMAN"
            confidence = 1 - prob
            explanation = (
                "Natural human voice characteristics detected: "
                "organic pitch variation, natural breath patterns."
            )

        return classification, round(confidence, 4), explanation