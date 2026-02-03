import os
import numpy as np
import librosa
from sklearn.ensemble import RandomForestClassifier
import joblib


def extract_features(file_path):
    y, sr = librosa.load(file_path, sr=16000, mono=True)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    return np.mean(mfcc.T, axis=0)


X, y = [], []

human_folder = os.path.join("dataset1", "humans")
ai_folder = os.path.join("dataset2", "ai")


for file in os.listdir(human_folder):
    if file.endswith((".mp3", ".wav")):
        X.append(extract_features(os.path.join(human_folder, file)))
        y.append(0)

for file in os.listdir(ai_folder):
    if file.endswith((".mp3", ".wav")):
        X.append(extract_features(os.path.join(ai_folder, file)))
        y.append(1)

X = np.array(X)
y = np.array(y)

model = RandomForestClassifier(
    n_estimators=200,
    random_state=42
)

model.fit(X, y)

joblib.dump(model, "voice_ai_detector.pkl")
print("✅ Model trained and saved successfully")
