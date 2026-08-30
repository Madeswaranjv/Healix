# Healthcare Chatbot — Backend Requirements

## Overview
A domain-restricted (healthcare-only) LLM chatbot backend supporting:
1. Dynamic document upload + RAG (Retrieval-Augmented Generation)
2. Image understanding (vision)
3. Live internet search via an MCP-style tool

Frontend: Vite + React (already built, calls this backend over REST).
Backend: Python + FastAPI.
LLM: Hosted via **OpenRouter** (single OpenAI-compatible API, free-tier models).

### Models in use (OpenRouter, `:free` tier)
| Model ID | Intended role |
|---|---|
| `inclusionai/ling-3.0-flash-fin:free` | General chat / RAG answering |
| `z-ai/glm-5.2:free` | General chat / RAG answering (alt) |
| `minimax/minimax-m3:free` | Vision-capable — image understanding |
| `google/gemma-4-26b-a4b-it:free` | General chat / vision |
| `thinkingmachines/inkling:free` | Reasoning-heavy queries (vision + tools capable) |

### Voice output (future integration)
| Model ID | Intended role |
|---|---|
| `fish-audio/s2.1-pro-free:free` | Text-to-speech — not wired into v1, reserved for a later voice-output feature |

> Free-tier model IDs on OpenRouter change frequently (models get delisted with little notice). Keep the model ID in `.env` (not hardcoded) so you can swap without a code change, and add a fallback model in case your primary gets rate-limited or delisted.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| API framework | FastAPI | Async, plays well with React, auto docs (`/docs`) |
| LLM provider | OpenRouter (free-tier models) | One API key, one OpenAI-compatible endpoint for every model, easy to swap models |
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Free, local, no API cost |
| Vector store | ChromaDB (persistent, local) | Free, simple, good enough at this scale |
| Document parsing | `pdfplumber`, `python-docx` | Handles PDF/DOCX text extraction |
| Web search | Tavily API (MCP-style tool) | Cheap, simple search API; swappable for a real MCP server later |
| Chunking | LangChain `RecursiveCharacterTextSplitter` | Standard, well-tested |

---

#project structure
Frontend in Healix---Chatbot
Backend in backend
```

---

## 3. Core Endpoints Needed

### `POST /upload`
- Accepts a file (PDF/DOCX/TXT) + `session_id`
- Parses → chunks → embeds → stores in Chroma under that session's collection
- Returns number of chunks stored

### `POST /chat`
- Accepts `session_id`, `message`, `use_web_search` flag
- Retrieves top-k relevant chunks for that session from Chroma
- Optionally calls the web search tool (heuristic or LLM-decided)
- Builds a healthcare-scoped prompt with: system rules + retrieved context + search results + user question
- Calls the LLM provider, returns the answer

### `POST /analyze-image`
- Accepts an image file + a question
- Sends image + question to Gemini's vision endpoint
- Returns a factual description, explicitly avoiding definitive diagnosis

---

## 4. Environment Variables Required

```
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Text chat / RAG answering model
OPENROUTER_CHAT_MODEL=inclusionai/ling-3.0-flash-fin:free
OPENROUTER_CHAT_MODEL_FALLBACK=z-ai/glm-5.2:free

# Vision model (must support image input)
OPENROUTER_VISION_MODEL=minimax/minimax-m3:free

# Voice output (reserved for later — not used in v1)
OPENROUTER_TTS_MODEL=fish-audio/s2.1-pro-free:free

TAVILY_API_KEY=
CHROMA_PERSIST_DIR=./data/vectorstore
FRONTEND_ORIGIN=http://localhost:5173
```

---

## 5. Session Handling

- Every upload and chat call carries a `session_id` (generated client-side, e.g. on page load, or tied to a logged-in user).
- Chroma collections are namespaced per session (`session_<id>`) so one user's uploaded documents never leak into another's retrieval results.

---

## 6. Safety Requirements (Healthcare-Specific)

- System prompt must instruct the model to:
  - Answer only from retrieved context when context exists
  - Say "not covered in the provided information" rather than guessing
  - Never give definitive diagnoses, prescriptions, or exact dosages
  - Always recommend consulting a licensed medical professional
  - Detect emergency-sounding queries and tell the user to seek immediate care
- Same rules apply to the vision service (no definitive diagnosis from images).

---

## 7. Dependencies (`requirements.txt`)

```
fastapi
uvicorn[standard]
python-multipart
pydantic
pydantic-settings
pypdf
pdfplumber
python-docx
chromadb
sentence-transformers
langchain
langchain-community
langchain-text-splitters
openai          # OpenRouter uses the OpenAI-compatible client format
httpx
tavily-python
python-dotenv
```

---

## 8. Free-Tier Model Risk

OpenRouter's `:free` models get rate-limited or delisted without much warning, and can also vary in output quality request to request. Before shipping/demoing:
- Keep model IDs in `.env`, never hardcoded
- Configure a fallback model (see `OPENROUTER_CHAT_MODEL_FALLBACK` above) and retry logic that switches to it on a 4xx/429 from the primary
- Re-verify all six model IDs against your OpenRouter dashboard right before your demo/submission — free listings change week to week

## 9. Later Upgrades (not needed for v1)

- Replace the direct Tavily call in `mcp_search.py` with a real MCP server + function-calling loop
- Add an LLM-based router to decide *when* to search instead of keyword heuristics
- Add persistent chat history (currently stateless per request)
- Add auth so `session_id` maps to real logged-in users
- Add OCR fallback for scanned/image-based PDFs
- Wire up voice output using `fish-audio/s2.1-pro-free:free` (TTS) — take the final chat answer text and pass it to this model to generate spoken audio for the frontend to play
