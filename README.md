# VoiceID — AI Voice Detector

> Detect whether a voice is human or AI-generated. Free. No login. No signup.

🔗 **[Try it live →](https://mdeepaksai.github.io/human-or-AI/?ref=github)**

![GitHub Pages](https://img.shields.io/badge/Frontend-GitHub%20Pages-blue)
![Railway](https://img.shields.io/badge/Backend-Railway-purple)
![Supabase](https://img.shields.io/badge/DB-Supabase-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## What is VoiceID?

VoiceID is a free audio forensics tool that analyses any voice recording and classifies it as human or AI-generated. It extracts **88 acoustic features** from the audio and runs them through a trained classification model to give you a confidence score.

**239+ visitors · 66+ analyses run · Live since April 2026**

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

1. Upload any MP3 or WAV file — or record live in the browser
2. Select the language of the audio
3. Click **Analyse Voice**
4. Get a **Human** or **AI** classification with confidence score
5. Export results as JSON or share directly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | FastAPI, Python |
| ML Model | Custom classifier, 88 acoustic features |
| Deployment | Railway (backend), GitHub Pages (frontend) |
| Database | Supabase (live counters) |

---

## API Usage

Backend API is publicly documented and testable at the link below.

**Endpoint:** `POST /api/voice-detection`

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

📄 **[Full API Docs →](https://human-or-ai-production-8e10.up.railway.app/docs)**

---

## Why We Built This

Deepfake audio is a growing threat. Most detection tools only support English. We built VoiceID to support Indian languages — Tamil, Hindi, Malayalam, and Telugu — because nobody else was.

---

## Built By

**Mallarpu Deepak Sai** — 2nd year ECE @ KIT, Tamil Nadu
**Smriti Kumari**

🌐 [Portfolio](https://mdeepaksai.github.io/portfolio/) · 💼 [LinkedIn](https://linkedin.com/in/mdeepaksai)

---

⭐ If you find this useful, star the repo!
