"""FastAPI application entrypoint for Healix Healthcare Chatbot Backend."""
import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.core.security import check_emergency_indicators, EMERGENCY_BANNER
from app.core.prompts import build_chat_prompt
from app.services.document_parser import process_uploaded_document
from app.services.vector_service import vector_service
from app.services.search_service import search_service
from app.services.mcp_service import mcp_service
from app.services.llm_service import llm_service
from app.services.chat_history import chat_history_manager
from app.services.user_service import user_service
from app.services.session_service import session_service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("healix-backend")

app = FastAPI(
    title="Healix Healthcare AI Backend",
    description="Domain-restricted medical LLM chatbot with user health profiles, persistent sessions, dynamic RAG, vision, and MCP search",
    version="1.1.0"
)

# CORS configuration
origins = [
    settings.FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Pydantic Request & Response Schemas
# ==========================================

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    preferred_name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    emergency_contact: Optional[Dict[str, str]] = None
    preferences: Optional[Dict[str, Any]] = None


class UserCreateRequest(BaseModel):
    user_id: Optional[str] = None
    full_name: str = "Jane Doe"
    preferred_name: str = "Jane"
    email: str = ""
    age: Optional[int] = None
    gender: Optional[str] = ""
    blood_group: Optional[str] = ""
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    emergency_contact: Optional[Dict[str, str]] = None
    preferences: Optional[Dict[str, Any]] = None


class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=4, description="User password")
    full_name: str = Field(..., description="Full clinical name")
    preferred_name: Optional[str] = ""
    age: Optional[int] = None
    gender: Optional[str] = ""
    blood_group: Optional[str] = ""
    allergies: Optional[List[str]] = Field(default_factory=list)
    chronic_conditions: Optional[List[str]] = Field(default_factory=list)
    current_medications: Optional[List[str]] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email or identifier")
    password: str = Field(..., description="User password")


class SwitchUserRequest(BaseModel):
    user_id: str = Field(..., description="User ID to switch active context to")


class SessionCreateRequest(BaseModel):
    title: Optional[str] = "New Consultation"
    model: Optional[str] = ""
    session_id: Optional[str] = None


class SessionUpdateRequest(BaseModel):
    title: Optional[str] = None
    pinned: Optional[bool] = None
    model: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Unique user/client session ID")
    user_id: Optional[str] = Field(default="user_default", description="User ID owning the session")
    message: str = Field(..., min_length=1, description="User's query or message")
    use_web_search: bool = Field(default=False, description="Whether to query live web search")
    model: Optional[str] = Field(default=None, description="Optional specific model selection")


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict] = []
    is_emergency: bool = False
    chunks_used: int = 0
    message_id: Optional[str] = None


# ==========================================
# Health & Status
# ==========================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": "Healix Healthcare Backend",
        "vectorstore": "ready",
        "chat_model": settings.OPENROUTER_CHAT_MODEL,
        "vision_model": settings.OPENROUTER_VISION_MODEL
    }


# ==========================================
# Authentication & User Management
# ==========================================

@app.post("/auth/register")
async def register(request: RegisterRequest):
    """Registers a new user account with hashed password and health profile."""
    existing = user_service.get_user_by_email(request.email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = user_service.create_user(
        full_name=request.full_name,
        preferred_name=request.preferred_name or request.full_name.split()[0],
        email=request.email,
        password=request.password,
        age=request.age,
        gender=request.gender,
        blood_group=request.blood_group,
        allergies=request.allergies,
        chronic_conditions=request.chronic_conditions,
        current_medications=request.current_medications
    )

    auth_data = user_service.authenticate(request.email, request.password)
    return {
        "status": "success",
        "message": "Account created successfully",
        "user": auth_data or user
    }


@app.post("/auth/login")
async def login(request: LoginRequest):
    """Authenticates user credentials and returns session token + user profile."""
    user = user_service.authenticate(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {
        "status": "success",
        "user": user,
        "token": user.get("token", "")
    }


@app.post("/auth/logout")
async def logout(token: Optional[str] = None, user_id: Optional[str] = None):
    """Logs out and invalidates active session token."""
    target = token or user_id or "user_default"
    user_service.logout(target)
    return {"status": "success", "message": "Logged out successfully"}


@app.get("/auth/me")
async def get_auth_me(token: Optional[str] = None, user_id: Optional[str] = None):
    """Retrieves active user profile by token or user ID."""
    if token:
        user = user_service.get_user_by_token(token)
        if user:
            user.pop("password_hash", None)
            return user
    if user_id:
        user = user_service.get_user(user_id)
        if user:
            user.pop("password_hash", None)
            return user
    return user_service.get_or_create_default_user()


@app.get("/auth/users")
@app.get("/users")
async def list_users():
    """Lists all registered user profiles for account switching."""
    return user_service.list_users()


@app.get("/users/me")
async def get_current_user():
    """Retrieves default / active user profile with healthcare properties."""
    return user_service.get_or_create_default_user()


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    """Retrieves a specific user profile by user ID."""
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.pop("password_hash", None)
    return user


@app.post("/users")
async def create_user(request: UserCreateRequest):
    """Creates a new user profile with clinical health properties."""
    return user_service.create_user(
        user_id=request.user_id,
        full_name=request.full_name,
        preferred_name=request.preferred_name,
        email=request.email,
        age=request.age,
        gender=request.gender,
        blood_group=request.blood_group,
        allergies=request.allergies,
        chronic_conditions=request.chronic_conditions,
        current_medications=request.current_medications,
        emergency_contact=request.emergency_contact,
        preferences=request.preferences
    )


@app.put("/users/{user_id}")
async def update_user(user_id: str, request: UserUpdateRequest):
    """Updates user profile attributes and clinical properties."""
    updates = request.model_dump(exclude_unset=True)
    updated = user_service.update_user(user_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


# ==========================================
# Session Management Endpoints
# ==========================================

@app.get("/users/{user_id}/sessions")
async def list_user_sessions(
    user_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """Lists all conversation sessions belonging to a user, ordered by recency."""
    return session_service.list_user_sessions(user_id, limit=limit, offset=offset)


@app.post("/users/{user_id}/sessions")
async def create_user_session(user_id: str, request: SessionCreateRequest):
    """Creates a new persistent conversation session for a user."""
    return session_service.create_session(
        user_id=user_id,
        title=request.title or "New Consultation",
        model=request.model or "",
        session_id=request.session_id
    )


@app.get("/sessions/{session_id}")
async def get_session_details(session_id: str):
    """Retrieves full session info, message history, and linked documents."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = session_service.get_session_messages(session_id)
    documents = session_service.get_session_documents(session_id)
    return {
        **session,
        "messages": messages,
        "documents": documents
    }


@app.patch("/sessions/{session_id}")
async def update_session(session_id: str, request: SessionUpdateRequest):
    """Updates session title, pin status, or model."""
    updated = session_service.update_session(
        session_id=session_id,
        title=request.title,
        pinned=request.pinned,
        model=request.model
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Deletes a session, its messages, documents, vectorstore, and memory."""
    deleted = session_service.delete_session(session_id)
    return {"status": "success" if deleted else "not_found", "session_id": session_id}


@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, limit: int = Query(default=100, ge=1)):
    """Retrieves all message turns for a session."""
    return session_service.get_session_messages(session_id, limit=limit)


# ==========================================
# Core AI Chat & RAG Pipeline
# ==========================================

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    user_id: Optional[str] = Form("user_default")
):
    """Uploads a PDF, DOCX, or TXT file, parses and embeds it into the session's vector store and SQLite."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    logger.info(f"Received file upload '{file.filename}' for session '{session_id}' (User: {user_id})")

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        full_text, chunks = process_uploaded_document(file.filename, file_bytes)
        
        if not chunks:
            return {
                "status": "warning",
                "filename": file.filename,
                "chunks_count": 0,
                "message": "No extractable text found in file (may be scanned image without OCR)."
            }

        stored_count = vector_service.add_document_chunks(
            session_id=session_id,
            filename=file.filename,
            chunks=chunks
        )

        # Record document link in session database
        session_service.add_session_document(
            session_id=session_id,
            filename=file.filename,
            chunks_count=stored_count,
            user_id=user_id or "user_default"
        )

        return {
            "status": "success",
            "filename": file.filename,
            "chunks_count": stored_count,
            "message": f"Successfully indexed {stored_count} chunks from '{file.filename}'."
        }

    except Exception as e:
        logger.error(f"Error processing file '{file.filename}': {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process document: {str(e)}"
        )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Answers healthcare queries using user health profile, RAG context, optional MCP web search, session conversation memory, and safety prompts."""
    user_query = request.message.strip()
    session_id = request.session_id.strip()
    user_id = (request.user_id or "user_default").strip()

    # 1. Emergency safety check
    is_emergency = check_emergency_indicators(user_query)

    # 2. Retrieve document chunks from session vectorstore
    retrieved_items = vector_service.query_similar_chunks(
        session_id=session_id,
        query=user_query,
        top_k=4
    )
    context_chunks = [item["content"] for item in retrieved_items]
    sources = []

    # Include document sources
    for idx, item in enumerate(retrieved_items):
        meta = item.get("metadata", {})
        src_name = meta.get("source", "Uploaded Document")
        sources.append({
            "id": f"doc-{idx}-{meta.get('chunk_index', idx)}",
            "title": f"Doc: {src_name}",
            "type": "document",
            "snippet": item["content"][:150] + "..."
        })

    # 3. Fetch user clinical health summary (allergies, medications, conditions)
    user_health_summary = user_service.get_user_health_summary(user_id)

    # 4. Fetch prior session conversation history
    chat_history = chat_history_manager.get_prompt_history(session_id=session_id)

    # 5. Build prompt with safety guidelines, user health profile, grounded context, and conversation history
    messages = build_chat_prompt(
        user_message=user_query,
        context_chunks=context_chunks,
        search_results=None,
        chat_history=chat_history,
        user_health_profile=user_health_summary
    )

    # 6. Pass MCP tools if web search is enabled
    tools = mcp_service.get_openai_tools() if request.use_web_search else None

    # 7. Query OpenRouter LLM via tool-calling loop
    llm_result = await llm_service.generate_chat_response(messages, model=request.model, tools=tools)
    raw_answer = llm_result.get("answer", "")
    web_sources = llm_result.get("sources", [])
    if web_sources:
        sources.extend(web_sources)

    # 8. Format final answer with emergency warning if triggered
    final_answer = raw_answer
    if is_emergency:
        final_answer = EMERGENCY_BANNER + final_answer

    # 9. Store user message in SQLite & memory
    session_service.add_message(
        session_id=session_id,
        role="user",
        content=user_query,
        user_id=user_id
    )

    # 10. Store assistant response in SQLite & memory
    asst_msg_record = session_service.add_message(
        session_id=session_id,
        role="assistant",
        content=final_answer,
        model=request.model or settings.OPENROUTER_CHAT_MODEL,
        sources=sources,
        is_emergency=is_emergency,
        chunks_used=len(context_chunks),
        user_id=user_id
    )

    return ChatResponse(
        answer=final_answer,
        sources=sources,
        is_emergency=is_emergency,
        chunks_used=len(context_chunks),
        message_id=asst_msg_record["id"]
    )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streams healthcare AI responses token-by-token using Server-Sent Events (SSE) with live MCP tool events."""
    user_query = request.message.strip()
    session_id = request.session_id.strip()
    user_id = (request.user_id or "user_default").strip()

    is_emergency = check_emergency_indicators(user_query)

    retrieved_items = vector_service.query_similar_chunks(
        session_id=session_id,
        query=user_query,
        top_k=4
    )
    context_chunks = [item["content"] for item in retrieved_items]
    sources = []

    for idx, item in enumerate(retrieved_items):
        meta = item.get("metadata", {})
        src_name = meta.get("source", "Uploaded Document")
        sources.append({
            "id": f"doc-{idx}-{meta.get('chunk_index', idx)}",
            "title": f"Doc: {src_name}",
            "type": "document",
            "snippet": item["content"][:150] + "..."
        })

    user_health_summary = user_service.get_user_health_summary(user_id)
    chat_history = chat_history_manager.get_prompt_history(session_id=session_id)

    messages = build_chat_prompt(
        user_message=user_query,
        context_chunks=context_chunks,
        search_results=None,
        chat_history=chat_history,
        user_health_profile=user_health_summary
    )

    tools = mcp_service.get_openai_tools() if request.use_web_search else None

    async def event_generator():
        # 1. Send initial metadata event (document sources, emergency status, chunks used)
        metadata_payload = {
            "type": "metadata",
            "sources": list(sources),
            "is_emergency": is_emergency,
            "chunks_used": len(context_chunks)
        }
        yield f"data: {json.dumps(metadata_payload)}\n\n"

        accumulated_chunks = []

        # 2. If emergency, send emergency banner first
        if is_emergency:
            accumulated_chunks.append(EMERGENCY_BANNER)
            yield f"data: {json.dumps({'type': 'delta', 'content': EMERGENCY_BANNER})}\n\n"

        # 3. Stream from LLM service (handles MCP tool execution events and text deltas)
        async for event in llm_service.generate_chat_stream(messages, model=request.model, tools=tools):
            event_type = event.get("type")
            
            if event_type == "tool_call":
                # Forward tool_call event to frontend
                yield f"data: {json.dumps(event)}\n\n"
            
            elif event_type == "tool_result":
                # Forward tool_result event and update sources metadata
                new_sources = event.get("sources", [])
                if new_sources:
                    sources.extend(new_sources)
                    yield f"data: {json.dumps(event)}\n\n"
                    # Emit updated metadata with web sources
                    yield f"data: {json.dumps({'type': 'metadata', 'sources': sources, 'is_emergency': is_emergency, 'chunks_used': len(context_chunks)})}\n\n"

            elif event_type == "delta":
                content_chunk = event.get("content", "")
                if content_chunk:
                    accumulated_chunks.append(content_chunk)
                    yield f"data: {json.dumps({'type': 'delta', 'content': content_chunk})}\n\n"

            elif event_type == "done":
                done_sources = event.get("sources", [])
                for s in done_sources:
                    if not any(existing.get("url") == s.get("url") for existing in sources):
                        sources.append(s)

        full_answer = "".join(accumulated_chunks)

        # 4. Save user & assistant records in SQLite & memory
        session_service.add_message(
            session_id=session_id,
            role="user",
            content=user_query,
            user_id=user_id
        )
        asst_msg_record = session_service.add_message(
            session_id=session_id,
            role="assistant",
            content=full_answer,
            model=request.model or settings.OPENROUTER_CHAT_MODEL,
            sources=sources,
            is_emergency=is_emergency,
            chunks_used=len(context_chunks),
            user_id=user_id
        )

        # 5. Send done event with final message ID
        done_payload = {
            "type": "done",
            "message_id": asst_msg_record["id"],
            "total_chunks": len(accumulated_chunks)
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")



@app.post("/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    question: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form("user_default")
):
    """Analyzes a medical image or lab sheet using vision LLM without definitive diagnosis."""
    if not image.filename:
        raise HTTPException(status_code=400, detail="No image provided")

    try:
        image_bytes = await image.read()
        mime_type = image.content_type or "image/jpeg"

        prompt_question = question or "Please objectively analyze this healthcare image, note visible findings, and suggest next clinical review steps."

        answer = await llm_service.analyze_image(
            image_bytes=image_bytes,
            mime_type=mime_type,
            question=prompt_question
        )

        # Record visual observation into session SQLite & memory if session provided
        if session_id:
            session_service.add_message(
                session_id=session_id,
                role="user",
                content=f"[Attached Image: {image.filename}] {prompt_question}",
                user_id=user_id or "user_default"
            )
            session_service.add_message(
                session_id=session_id,
                role="assistant",
                content=answer,
                model=settings.OPENROUTER_VISION_MODEL,
                sources=[{"id": f"img-doc-{image.filename}", "title": f"Image: {image.filename}", "type": "document"}],
                user_id=user_id or "user_default"
            )

        return {
            "status": "success",
            "filename": image.filename,
            "answer": answer
        }

    except Exception as e:
        logger.error(f"Error during image analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze image: {str(e)}"
        )


# ==========================================
# Legacy Session Stats / Reset Endpoints
# ==========================================

@app.get("/session/{session_id}/stats")
async def get_session_stats(session_id: str):
    """Retrieves document indexing and conversation stats for a session."""
    vector_stats = vector_service.get_session_stats(session_id)
    history_count = len(session_service.get_session_messages(session_id))
    return {
        **vector_stats,
        "message_count": history_count
    }


@app.get("/session/{session_id}/history")
async def get_session_history(session_id: str):
    """Retrieves the conversation memory history for a session."""
    history = session_service.get_session_messages(session_id)
    return {
        "session_id": session_id,
        "count": len(history),
        "messages": history
    }


@app.delete("/session/{session_id}/history")
async def clear_session_history(session_id: str):
    """Clears conversation memory for a session."""
    cleared = chat_history_manager.clear_history(session_id)
    return {"status": "success" if cleared else "not_found", "session_id": session_id}


@app.delete("/session/{session_id}/documents")
async def clear_session_documents(session_id: str):
    """Deletes all indexed documents for a session."""
    cleared = vector_service.clear_session_documents(session_id)
    return {"status": "success" if cleared else "not_found", "session_id": session_id}


@app.delete("/session/{session_id}")
async def reset_entire_session(session_id: str):
    """Resets both documents and conversation memory for a session."""
    deleted = session_service.delete_session(session_id)
    return {
        "status": "success" if deleted else "not_found",
        "session_id": session_id
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
