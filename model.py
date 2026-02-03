import joblib
import librosa
import numpy as np
import io
import soundfile as sf


class VoiceClassifier:
    SUPPORTED_LANGUAGES = ["tamil", "english", "hindi", "malayalam", "telugu"]

    def __init__(self):
        self.model = joblib.load("voice_ai_detector.pkl")

    def extract_features(self, audio_bytes: bytes):
        try:
            # Read audio from bytes
            audio_buffer = io.BytesIO(audio_bytes)

            y, sr = librosa.load(audio_buffer, sr=16000, mono=True)

            if len(y) < sr:
                raise ValueError("Audio too short (min 1 second required)")

            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
            features = np.mean(mfcc.T, axis=0)

            return features.reshape(1, -1)

        except ValueError:
            raise
        except Exception:
            raise ValueError("Invalid or corrupted MP3 audio")

    def predict(self, audio_bytes: bytes, language: str):
        language = language.lower()

        if language not in self.SUPPORTED_LANGUAGES:
            raise ValueError("Unsupported language")

        features = self.extract_features(audio_bytes)

        prob = self.model.predict_proba(features)[0][1]
        classification = "AI_GENERATED" if prob > 0.5 else "HUMAN"

        explanation = (
            "Synthetic voice patterns detected"
            if classification == "AI_GENERATED"
            else "Natural human voice characteristics detected"
        )

        return classification, float(prob), explanation
