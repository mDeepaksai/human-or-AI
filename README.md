# VoiceID — Free AI Voice Detector

![Live](https://img.shields.io/badge/Live-Demo-brightgreen)
![FastAPI](https://img.shields.io/badge/Built%20with-FastAPI-blue)
![Free](https://img.shields.io/badge/Free-No%20Login-orange)
![Languages](https://img.shields.io/badge/Languages-5%20Indian-red)

> Detect if a voice is human or AI-generated in seconds.

🔴 **Live Demo:** https://mdeepaksai.github.io/human-or-AI/
📖 **API Docs:** https://human-or-ai-production-8e10.up.railway.app/docs

---

## Screenshots

![VoiceID Hero](/logo.png)

![VoiceID Upload](/imaage.png)

---

## What is VoiceID?

VoiceID is a free audio forensics tool that analyses any voice 
recording and classifies it as human or AI-generated. It extracts 
88 acoustic features from the audio and runs them through a 
trained classification model to give you a confidence score.

Built as a real deployed product — not a demo or college project.
Currently live with 90+ visitors and 26+ analyses run.

---

## Features

- 🎙️ Detects AI-generated and synthetic voices
- 📊 88 acoustic features analysed per audio file
- 🌍 Supports English, Tamil, Hindi, Malayalam, Telugu
- 📁 Upload MP3 or WAV files (max 10MB)
- 🎤 Live recording directly in the browser
- ⚡ Results in seconds with confidence score
- 📈 Live visitor and analyses counter powered by Supabase
- 🔓 Free. No login. No signup.

---

## How It Works

1. Upload any MP3 or WAV file (or record live)
2. Select the language of the audio
3. Click Analyse Voice
4. Get a Human or AI classification with confidence score
5. Export results as JSON or share directly

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Backend | FastAPI, Python |
| ML Model | Custom classifier, 88 acoustic features |
| Deployment | Railway (backend), GitHub Pages (frontend) |
| Database | Supabase (live visitor counter) |

---

## API Usage

The backend API is publicly documented and testable.

**Endpoint:** `POST /api/voice-detection`

**Headers:**
```
x-api-key: your_api_key
```

**Form Data:**
```
file: audio.mp3
language: english
```

**Response:**
```json
{
  "classification": "HUMAN",
  "confidenceScore": 0.94,
  "explanation": "Voice contains natural prosody patterns...",
  "processingTimeMs": 1200
}
```

Full API documentation available at:
https://human-or-ai-production-8e10.up.railway.app/docs

---

## Live Stats

- 90+ visitors since launch
- 26+ analyses run
- 5 languages supported
- Deployed and live since April 2026

---

## Why I Built This

Deepfake audio is a growing threat. Most detection tools only 
support English. I built VoiceID to support Indian languages — 
Tamil, Hindi, Malayalam, and Telugu — because nobody else was.

---

## Built By

**Mallarpu Deepak Sai** — 2nd year ECE @ KIT, Tamil Nadu
**Smriti Kumari**

Portfolio: https://mdeepaksai.github.io/portfolio/
LinkedIn: https://linkedin.com/in/mdeepaksai

---

⭐ If you find this useful, star this repo!