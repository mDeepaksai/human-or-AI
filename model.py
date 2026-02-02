import numpy as np

class VoiceClassifier:
    """
    Dummy voice classifier for demonstration.
    Replace this with real ML model / features extraction.
    """
    SUPPORTED_LANGUAGES = ["Tamil", "English", "Hindi", "Malayalam", "Telugu"]

    def predict(self, audio_bytes: bytes, language: str):
        """
        Predicts whether voice is AI_GENERATED or HUMAN
        Returns: classification (str), confidenceScore (float), explanation (str)
        """
        if language not in self.SUPPORTED_LANGUAGES:
            raise ValueError("Unsupported language")

        # Dummy logic: random prediction
        np.random.seed(len(audio_bytes))  # deterministic for same input
        score = np.random.rand()
        classification = "AI_GENERATED" if score > 0.5 else "HUMAN"
        explanation = (
            "Detected robotic tone and unnatural pitch fluctuations"
            if classification == "AI_GENERATED"
            else "Natural human intonation and pauses detected"
        )

        return classification, float(score), explanation
