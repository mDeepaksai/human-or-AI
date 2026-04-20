"""
Train the AI voice detector.

Dataset structure expected:
    dataset1/humans/  — .mp3 or .wav files of real human voices
    dataset2/ai/      — .mp3 or .wav files of AI-generated voices

Usage:
    python tainedmodel.py
    python tainedmodel.py --human dataset1/humans --ai dataset2/ai --output voice_ai_detector.pkl
"""

import argparse
import logging
import os

import joblib
import librosa
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".mp3", ".wav"}
FEATURE_DIM = 88  # Must match model.py exactly
MIN_SAMPLES_FOR_SPLIT = 10


# ---------------------------------------------------------------------------
# Feature extraction — must stay in sync with model.py
# ---------------------------------------------------------------------------
def extract_features(file_path: str) -> np.ndarray:
    y, sr = librosa.load(file_path, sr=16000, mono=True)

    if len(y) / sr < 1.0:
        raise ValueError(f"Audio too short: {len(y)/sr:.2f}s (minimum 1s required)")

    features = []

    # MFCC: mean + std = 40
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    features.extend(np.mean(mfcc, axis=1))
    features.extend(np.std(mfcc, axis=1))

    # MFCC delta: mean + std = 40
    mfcc_delta = librosa.feature.delta(mfcc)
    features.extend(np.mean(mfcc_delta, axis=1))
    features.extend(np.std(mfcc_delta, axis=1))

    # Spectral centroid: mean + std = 2
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features.append(float(np.mean(centroid)))
    features.append(float(np.std(centroid)))

    # Zero-crossing rate: mean + std = 2
    zcr = librosa.feature.zero_crossing_rate(y)
    features.append(float(np.mean(zcr)))
    features.append(float(np.std(zcr)))

    # RMS energy: mean + std = 2
    rms = librosa.feature.rms(y=y)
    features.append(float(np.mean(rms)))
    features.append(float(np.std(rms)))

    # Spectral rolloff: mean + std = 2
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
    features.append(float(np.mean(rolloff)))
    features.append(float(np.std(rolloff)))

    feature_vector = np.array(features)
    assert len(feature_vector) == FEATURE_DIM, (
        f"Feature dim mismatch: expected {FEATURE_DIM}, got {len(feature_vector)}"
    )
    return feature_vector


# ---------------------------------------------------------------------------
# Dataset loader
# ---------------------------------------------------------------------------
def load_dataset(human_folder: str, ai_folder: str) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    errors = 0

    for label, folder in [(0, human_folder), (1, ai_folder)]:
        label_name = "human" if label == 0 else "AI"

        if not os.path.exists(folder):
            raise FileNotFoundError(f"Folder not found: '{folder}'")

        files = [
            f for f in os.listdir(folder)
            if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
        ]

        if not files:
            raise FileNotFoundError(f"No .mp3 or .wav files found in: '{folder}'")

        logger.info("Loading %d %s files from '%s'...", len(files), label_name, folder)

        for filename in files:
            path = os.path.join(folder, filename)
            try:
                features = extract_features(path)
                X.append(features)
                y.append(label)
            except Exception as e:
                logger.warning("Skipping '%s': %s", filename, e)
                errors += 1

    if errors:
        logger.warning("%d file(s) were skipped due to errors.", errors)

    if len(X) == 0:
        raise RuntimeError("No valid audio files could be loaded. Check your dataset folders.")

    return np.array(X), np.array(y)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(args: argparse.Namespace):
    logger.info("Starting training...")
    logger.info("Human folder : %s", args.human)
    logger.info("AI folder    : %s", args.ai)
    logger.info("Output path  : %s", args.output)

    # --- Load ---
    X, y = load_dataset(args.human, args.ai)
    counts = np.bincount(y)
    logger.info(
        "Dataset loaded: %d human, %d AI | total: %d",
        counts[0], counts[1], len(y)
    )
    logger.info("Feature vector dimension: %d", X.shape[1])

    imbalance_ratio = max(counts) / min(counts)
    if imbalance_ratio > 1.5:
        logger.warning(
            "Class imbalance detected (ratio %.1fx). Using class_weight='balanced'.",
            imbalance_ratio,
        )

    # --- Model ---
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_leaf=1,       # relaxed to support tiny datasets
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    # --- Train with or without split depending on dataset size ---
    if len(X) >= MIN_SAMPLES_FOR_SPLIT:
        # Normal path: train/test split + cross-validation
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        logger.info("Split: %d train / %d test", len(X_train), len(X_test))

        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]

        print("\n" + "=" * 60)
        print("HELD-OUT TEST SET RESULTS")
        print("=" * 60)
        print(classification_report(y_test, y_pred, target_names=["Human", "AI"]))
        print(f"ROC-AUC : {roc_auc_score(y_test, y_prob):.4f}")

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X, y, cv=cv, scoring="f1", n_jobs=-1)
        print(f"5-Fold CV F1 : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
        print("=" * 60 + "\n")

    else:
        # Small dataset path: train on everything, skip split/CV
        logger.warning(
            "Only %d samples found — skipping train/test split and cross-validation. "
            "Add more audio files for reliable accuracy (recommended: 50+ per class).",
            len(X)
        )

        model.fit(X, y)

        y_pred = model.predict(X)
        print("\n" + "=" * 60)
        print("TRAINING SET RESULTS  (no held-out test — dataset too small)")
        print("=" * 60)
        print(classification_report(y, y_pred, target_names=["Human", "AI"]))
        print("⚠️  These scores are optimistic (trained & tested on same data).")
        print("    Add more audio files for a proper evaluation.")
        print("=" * 60 + "\n")

    # --- Save ---
    joblib.dump(model, args.output)
    logger.info("✅ Model saved to '%s'", args.output)
    logger.info("✅ Feature dimension: %d  (matches model.py)", X.shape[1])

    if len(X) < MIN_SAMPLES_FOR_SPLIT:
        logger.warning(
            "⚠️  Model trained on only %d samples. "
            "Predictions will be unreliable — add more data and retrain!",
            len(X)
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AI voice detector")
    parser.add_argument(
        "--human",
        default=os.path.join("dataset1", "humans"),
        help="Path to human audio folder (default: dataset1/humans)"
    )
    parser.add_argument(
        "--ai",
        default=os.path.join("dataset2", "ai"),
        help="Path to AI audio folder (default: dataset2/ai)"
    )
    parser.add_argument(
        "--output",
        default="voice_ai_detector.pkl",
        help="Output path for trained model (default: voice_ai_detector.pkl)"
    )
    main(parser.parse_args())