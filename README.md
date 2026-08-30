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
| **AI / LLM** | OpenRouter (MiniMax M3, Ling Flash, Gemma 4, Nemotron), HuggingFace MiniLM Embeddings |
| **Search Engine** | Tavily Search API |
| **Doc Readers** | pdfplumber, pypdf, pypdfium2, pdfminer.six, python-docx |

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
TAVILY_API_KEY=your_tavily_api_key_here
```

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
│   │   ├── services/               # LLM, Document Parser, Tavily Search, Sessions, Users
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
│   │   │   └── settings/           # Patient Clinical Profile Modal
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
> It does not provide definitive medical diagnoses, prescriptions, or emergency care. Users should always consult with a licensed physician or qualified healthcare provider regarding medical conditions or symptoms. In medical emergencies, contact local emergency services immediately (e.g., 911 / 112)
