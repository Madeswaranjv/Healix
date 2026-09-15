<p align="center">
  <img src="assets/logo.png" alt="Healix Logo" width="90" height="90" />
</p>

<h1 align="center">Healix — AI Healthcare & Clinical Information Assistant</h1>

<p align="center">
  <strong>Safety-first AI healthcare intelligence platform with real-time streaming, multi-engine document reading, live web search, and clinical safety grounding.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python" alt="Python 3.11+" />
</p>

---

## ✨ Key Features

- ⚡ **Real-Time Token Streaming (SSE)**: Word-by-word typewriter streaming with immediate response cancellation (`Stop Generating`).
- 🎙️ **Multilingual Voice Accessibility (TTS & STT)**: Hands-free voice input via microphone Speech-to-Text (`MicButton`) and natural clinical response narration via Text-to-Speech (`SpeakerButton`), powered by Bhashini AI with automated Unicode script language detection (Tamil, English, Hindi, Telugu, Malayalam, etc.).
- 📄 **Multi-Engine Document Parser**: High-accuracy text extraction from clinical PDFs (`pdfplumber`, `pypdf`, `pypdfium2`, `pdfminer`), Word docs (`.docx`), and lab spreadsheets (`.csv`, `.tsv`, `.txt`).
- 🌐 **Live Web Search Grounding**: Real-time retrieval of latest 2026 clinical guidelines and medical literature powered by the Tavily Search API.
- 🖼️ **Medical Vision Analysis**: Vision-guided image inspection for medical documents, skin lesions, and lab reports without definitive diagnosis.
- 📊 **Structured Tabular Output**: Automatic parsing of complex lab parameters, medication schedules, and vital ranges into styled, responsive HTML tables.
- 🛡️ **Clinical Safety & Emergency Protocol**: Immediate emergency detection banners for acute symptoms (e.g. chest pain, anaphylaxis) with emergency service guidance.
- 🔐 **Patient Authentication & Profiles**: Secure password hashing (PBKDF2 SHA-256), token sessions, and customized patient health profiles (allergies, medications, chronic conditions).

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v4, Zustand, Lucide Icons |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, SQLite, ChromaDB |
| **AI / LLM** | OpenRouter (Nex N2.5 Pro, Ling 3.0 Flash VL, Gemma 4, Nemotron, Ling Flash, Cortex) & Gemini |
| **Voice I/O (TTS / STT)** | Bhashini ULCA API (IITM ASR & Multilingual TTS), Web Audio API (16kHz PCM WAV), pydub / imageio-ffmpeg |
| **Embeddings** | OpenRouter Remote Embeddings (`openai/text-embedding-3-small`) |
| **Search Engine** | Tavily Search API with DuckDuckGo fallback |
| **Doc Readers** | pdfplumber, pypdf, pypdfium2, pdfminer.six, python-docx |

---

## 🧠 Retrieval-Augmented Generation (RAG) Pipeline

Healix utilizes an ultra-lightweight, zero-local-model remote RAG architecture designed for low-memory cloud deployments (such as Render Free 512MB RAM):

```
Document Upload
      ↓
Text Extraction (pdfplumber, pypdf, python-docx)
      ↓
Text Chunking (RecursiveCharacterTextSplitter)
      ↓
OpenRouter Embeddings API (openai/text-embedding-3-small)
      ↓
ChromaDB Vector Store (Isolated session collections)
      ↓
Semantic Similarity Search (User Query → OpenRouter Vector → Top K)
      ↓
OpenRouter LLM (Grounded response generation with citations)
```

> **Zero Local Model Footprint**: Healix does not download or load any embedding models locally, completely eliminating PyTorch, CUDA, and SentenceTransformer dependencies to run comfortably within 512 MB RAM limits.

---

## 🎙️ Voice Architecture (Speech-to-Text & Text-to-Speech)

Healix integrates end-to-end voice accessibility tailored for patient consultations across major Indian languages and English via Government of India's **Bhashini / ULCA** (AI for Bharat) APIs:

### 1. Speech-to-Text (STT / ASR Voice Input)
- **Client-Side PCM Capture**: The `MicButton` captures live microphone audio through the browser's Web Audio API and encodes raw Float32 buffers into a standardized 16-bit mono 16kHz WAV Blob.
- **Dravidian & Multilingual ASR Pipeline**: Recorded audio is submitted to `POST /api/voice/stt`. The backend invokes Bhashini's ASR pipeline (`bhashini/iitm/asr-dravidian--gpu--t4` / Dhruva inference endpoint) with fallback transcoding powered by `pydub` and `imageio-ffmpeg`.
- **Instant Composer Integration**: Transcriptions are streamed directly into the chat prompt input for hands-free patient symptom reporting.

### 2. Text-to-Speech (TTS Voice Narration)
- **Response Narration**: Each assistant response bubble features an integrated `SpeakerButton` for clear, audible clinical summaries.
- **Smart Clinical Text Sanitization**: The `clean_text_for_tts()` pre-processor automatically strips markdown tokens, headers, tables, bullet points, and raw URLs while preserving clinical punctuation and capping speech at optimal sentence boundaries (~380 chars) for sub-second audio generation.
- **Automated Unicode Script Detection**: Using `detect_language_from_text()`, Healix dynamically inspects Unicode character ranges to identify Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Kannada (`kn`), Malayalam (`ml`), Bengali (`bn`), Gujarati (`gu`), or English (`en`) without requiring manual language switching.
- **Single-Stream Audio Controller**: A centralized playback coordinator guarantees that only one message audio stream plays at any time, with quick toggle-to-stop capability.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18+) & **npm**
- **Python** (v3.11+)

---

### 2. Backend Setup

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
# source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables
cp .env.example .env
```

Edit `backend/.env` with your API keys:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_EMBEDDING_BATCH_SIZE=32
TAVILY_API_KEY=your_tavily_api_key_here

# OpenRouter Models (Configurable)
NEX_N2_5_PRO_MODEL=nex-agi/nex-n2.5-pro:free
LING_3_0_FLASH_VL_MODEL=inclusionai/ling-3.0-flash-vl:free

# Bhashini Voice I/O (Optional - for TTS and STT features)
BHASHINI_INFERENCE_API_KEY=your_bhashini_inference_api_key_here
```

### 📍 Local Businesses & Google Maps Navigation
When Healix identifies local pharmacies, medical shops, clinics, or hospitals, it provides direct, clickable Google Maps links for each business. Links are generated using:
1. A verified Google Maps place URL when available from web search results, OR
2. A Google Maps Search URL safely constructed from the verified business name and location:
   `https://www.google.com/maps/search/?api=1&query=<URL_ENCODED_NAME_AND_LOCATION>`
   *(Addresses are never hallucinated; if an exact street is unverified, `Business Name + Area + City` is used).*

Start the FastAPI backend:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Backend API will be accessible at: `http://localhost:8000`  
Interactive API Docs (Swagger): `http://localhost:8000/docs`

---

### 3. Frontend Setup

In a new terminal:
```bash
cd Healix---ChatBot

# 1. Install dependencies
npm install

# 2. Launch Vite dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📁 Project Structure

```
Haelix/
├── backend/                        # FastAPI Backend Application
│   ├── app/
│   │   ├── core/                   # Database connection, schemas, and system prompts
│   │   ├── routes/                 # Voice routes (/tts, /stt, /languages)
│   │   ├── services/               # LLM, Bhashini Voice, Document Parser, Search, Sessions
│   │   └── main.py                 # FastAPI endpoints & SSE streaming routes
│   ├── data/                       # Local SQLite DB and ChromaDB vectorstore (gitignored)
│   ├── .env.example                # Sample configuration template
│   └── requirements.txt            # Python backend dependencies
├── Healix---ChatBot/               # React + Vite Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/               # AuthModal (Sign In / Register)
│   │   │   ├── chat/               # Composer, MessageBubble, Tables, PulseIndicator
│   │   │   ├── sidebar/            # Sidebar, ChatList, ProfileMenu, Options
│   │   │   ├── settings/           # Patient Clinical Profile Modal
│   │   │   ├── MicButton.tsx       # 16kHz WAV recording & STT transcription button
│   │   │   └── SpeakerButton.tsx   # Audio playback & Bhashini TTS synthesis button
│   │   ├── services/               # API service & SSE stream consumer
│   │   ├── store/                  # Zustand global state management
│   │   └── index.css               # Design system tokens & Tailwind styles
│   └── package.json
├── .gitignore                      # Git ignore rules for keys, DBs, and dependencies
└── README.md                       # Project documentation
```

---

## ⚖️ Medical Disclaimer

> **Healix is an AI-powered health informational tool designed for educational and informational support only.**  
> It does not provide definitive medical diagnoses, prescriptions, or emergency care. Users should always consult with a licensed physician or qualified healthcare provider regarding medical conditions or symptoms. In medical emergencies, contact local emergency services immediately (e.g., 911 / 112).
