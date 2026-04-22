# VoiceID — Free AI Voice Detector

> Detect if a voice is human or AI-generated in seconds.

🔴 **Live Demo:** https://mdeepaksai.github.io/human-or-AI/
📖 **API Docs:** https://human-or-ai-production-8e10.up.railway.app/docs

---

## What is VoiceID?

VoiceID is a free audio forensics tool that analyses any voice 
recording and classifies it as human or AI-generated. It extracts 
88 acoustic features from the audio and runs them through a 
trained classification model to give you a confidence score.

Built as a real deployed product — not a demo or college project.

---

## Features

- 🎙️ Detects AI-generated and synthetic voices
- 📊 88 acoustic features analysed per audio file
- 🌍 Supports English, Tamil, Hindi, Malayalam, Telugu
- 📁 Upload MP3 or WAV files (max 10MB)
- 🎤 Live recording directly in the browser
- ⚡ Results in seconds with confidence score
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
