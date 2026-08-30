/**
 * Healix API Service
 * Handles communication between React Frontend and FastAPI Backend
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Health check endpoint
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend health check failed:', err);
    return null;
  }
}

// ==========================================
// Authentication & User APIs
// ==========================================

/**
 * Register a new user account
 */
export async function registerUser(payload) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Registration failed (${res.status})`);
  }
  return await res.json();
}

/**
 * Log in with email and password
 */
export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Login failed (${res.status})`);
  }
  return await res.json();
}

/**
 * Log out and invalidate token
 */
export async function logoutUser(token = '', userId = '') {
  try {
    const params = new URLSearchParams();
    if (token) params.append('token', token);
    if (userId) params.append('user_id', userId);
    await fetch(`${API_BASE}/auth/logout?${params.toString()}`, { method: 'POST' });
  } catch (err) {
    console.warn('Logout request failed:', err);
  }
  return true;
}

/**
 * Fetch authenticated user by token or userId
 */
export async function fetchAuthMe(token = '', userId = '') {
  const params = new URLSearchParams();
  if (token) params.append('token', token);
  if (userId) params.append('user_id', userId);
  const res = await fetch(`${API_BASE}/auth/me?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch authenticated user (${res.status})`);
  return await res.json();
}

/**
 * List all available user accounts
 */
export async function fetchAllUsers() {
  const res = await fetch(`${API_BASE}/auth/users`);
  if (!res.ok) throw new Error(`Failed to list users (${res.status})`);
  return await res.json();
}

/**
 * Fetch default / current user profile
 */
export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/users/me`);
  if (!res.ok) throw new Error(`Failed to fetch user profile (${res.status})`);
  return await res.json();
}

/**
 * Fetch a specific user profile
 * @param {string} userId
 */
export async function fetchUserProfile(userId) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Failed to fetch user profile (${res.status})`);
  return await res.json();
}

/**
 * Update user profile and clinical health properties
 * @param {string} userId
 * @param {Object} updates
 */
export async function updateUserProfile(userId, updates) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update user profile (${res.status})`);
  }
  return await res.json();
}

/**
 * List all users
 */
export async function listUsers() {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) return [];
  return await res.json();
}

/**
 * Create a new user profile
 * @param {Object} userData
 */
export async function createUser(userData) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create user (${res.status})`);
  }
  return await res.json();
}

// ==========================================
// Session Management APIs
// ==========================================

/**
 * Fetch all sessions for a user
 * @param {string} userId
 */
export async function fetchUserSessions(userId = 'user_default') {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/sessions`);
  if (!res.ok) return [];
  return await res.json();
}

/**
 * Create a new conversation session on the backend
 * @param {string} userId
 * @param {Object} params
 * @param {string} [params.title]
 * @param {string} [params.model]
 * @param {string} [params.sessionId]
 */
export async function createBackendSession(userId = 'user_default', { title = 'New Consultation', model = '', sessionId = null } = {}) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      model,
      session_id: sessionId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create session (${res.status})`);
  }
  return await res.json();
}

/**
 * Fetch full session details including message history and uploaded documents
 * @param {string} sessionId
 */
export async function fetchSessionDetails(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Update session title, pin, or model
 * @param {string} sessionId
 * @param {Object} updates
 */
export async function updateBackendSession(sessionId, updates) {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Delete a session and its associated vectors and history
 * @param {string} sessionId
 */
export async function deleteBackendSession(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) return false;
  return await res.json();
}

// ==========================================
// Chat & RAG APIs
// ==========================================

/**
 * Send chat query to FastAPI backend RAG + LLM pipeline (non-streaming fallback)
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.message
 * @param {string} [params.userId='user_default']
 * @param {boolean} [params.useWebSearch=false]
 * @param {string} [params.model]
 */
export async function sendChatMessage({ sessionId, message, userId = 'user_default', useWebSearch = false, model = null }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: userId,
      message,
      use_web_search: useWebSearch,
      model,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return await res.json();
}

/**
 * Stream chat query from FastAPI backend RAG + LLM pipeline using Server-Sent Events (SSE)
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.message
 * @param {string} [params.userId='user_default']
 * @param {boolean} [params.useWebSearch=false]
 * @param {string} [params.model]
 * @param {Function} [params.onMetadata] - ({ sources, isEmergency, chunksUsed }) => void
 * @param {Function} [params.onDelta] - (deltaText) => void
 * @param {Function} [params.onDone] - ({ messageId }) => void
 * @param {Function} [params.onError] - (error) => void
 * @param {AbortSignal} [params.signal]
 */
export async function streamChatMessage({
  sessionId,
  message,
  userId = 'user_default',
  useWebSearch = false,
  model = null,
  onMetadata,
  onDelta,
  onDone,
  onError,
  signal,
}) {
  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        message,
        use_web_search: useWebSearch,
        model,
      }),
      signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep any partial event chunk in buffer

      for (const rawEvent of lines) {
        const trimmed = rawEvent.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'metadata') {
            onMetadata?.({
              sources: event.sources || [],
              isEmergency: Boolean(event.is_emergency),
              chunksUsed: event.chunks_used || 0,
            });
          } else if (event.type === 'delta') {
            onDelta?.(event.content || '');
          } else if (event.type === 'done') {
            onDone?.({
              messageId: event.message_id,
            });
          }
        } catch (parseErr) {
          console.warn('Failed to parse SSE event:', jsonStr, parseErr);
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.(err);
      throw err;
    }
  }
}


/**
 * Upload a document (PDF, DOCX, TXT) to index into session vectorstore and SQLite
 * @param {File} file
 * @param {string} sessionId
 * @param {string} [userId='user_default']
 */
export async function uploadDocument(file, sessionId, userId = 'user_default') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);
  formData.append('user_id', userId);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to upload document (${res.status})`);
  }

  return await res.json();
}

/**
 * Analyze a medical image using vision LLM
 * @param {File} imageFile
 * @param {string} question
 * @param {string} sessionId
 * @param {string} [userId='user_default']
 */
export async function analyzeImage(imageFile, question, sessionId, userId = 'user_default') {
  const formData = new FormData();
  formData.append('image', imageFile);
  if (question) formData.append('question', question);
  if (sessionId) formData.append('session_id', sessionId);
  if (userId) formData.append('user_id', userId);

  const res = await fetch(`${API_BASE}/analyze-image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to analyze image (${res.status})`);
  }

  return await res.json();
}

/**
 * Retrieve session indexed document stats
 * @param {string} sessionId
 */
export async function getSessionStats(sessionId) {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/stats`);
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Retrieve session conversation memory history
 * @param {string} sessionId
 */
export async function getSessionHistory(sessionId) {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/history`);
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Clear conversation memory for a session
 * @param {string} sessionId
 */
export async function clearSessionHistory(sessionId) {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/history`, {
    method: 'DELETE',
  });
  if (!res.ok) return false;
  return await res.json();
}

/**
 * Clear indexed documents for a session
 * @param {string} sessionId
 */
export async function clearSessionDocs(sessionId) {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/documents`, {
    method: 'DELETE',
  });
  if (!res.ok) return false;
  return await res.json();
}

/**
 * Reset both documents and conversation memory for a session
 * @param {string} sessionId
 */
export async function resetEntireSession(sessionId) {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) return false;
  return await res.json();
}
