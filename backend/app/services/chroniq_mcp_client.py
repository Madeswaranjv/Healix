"""ChroniQ Patient MCP Client for Healix Healthcare Chatbot.

Provides asynchronous integration with the ChroniQ Model Context Protocol (MCP) server:
- Dynamic tool discovery and schema extraction with TTL caching
- Streamable-HTTP client transport with connection and request timeouts
- Caller JWT bearer token forwarding
- Mutation gating safeguard (CHRONIQ_MCP_MUTATIONS_ALLOWED)
- Sanitized logging protecting sensitive patient data and credentials
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextvars import ContextVar
from typing import Any, Dict, List, Optional, Set

from app.config import settings

logger = logging.getLogger("healix.chroniq_mcp")

# ContextVar for per-request caller bearer token (set by auth middleware or request handler)
_caller_bearer_token: ContextVar[Optional[str]] = ContextVar("_caller_bearer_token", default=None)


def set_caller_token(token: Optional[str]) -> None:
    """Set the caller's bearer token for the current async context."""
    _caller_bearer_token.set(token)


def get_caller_token() -> Optional[str]:
    """Retrieve the caller's bearer token for the current async context."""
    return _caller_bearer_token.get()


# State-mutating tools that require CHRONIQ_MCP_MUTATIONS_ALLOWED=True
CHRONIQ_MUTATING_TOOLS: Set[str] = {
    "hold_appointment_slot",
    "release_appointment_slot",
    "book_appointment",
    "cancel_appointment",
    "update_patient_profile",
    "add_family_member",
    "update_family_member",
    "delete_family_member",
    "update_medical_document",
    "submit_appointment_review",
    "update_appointment_review",
    "create_support_ticket",
    "mark_notification_as_read",
    "update_notification_preferences",
}

# Blocked tools per ChroniQ security/data-leak audit
CHRONIQ_BLOCKED_TOOLS: Dict[str, str] = {
    "reschedule_appointment": "Blocked: non-atomic multi-save vulnerability (Gap #6).",
    "check_in_appointment": "Blocked: missing mandatory authentication enforcement (Gap #1).",
    "get_patient_queue_status": "Blocked: missing ownership verification on appointment ID (Gap #2).",
    "get_department_queue_board": "Blocked: unauthenticated endpoint exposing appointment IDs (Gap #9).",
    "delete_medical_document": "Blocked: file storage orphan leak (Gap #13).",
    "request_account_deletion": "Blocked: missing backend purge worker (Gap #14).",
    "cancel_account_deletion": "Blocked: depends on request_account_deletion.",
    "export_patient_data": "Blocked: data minimisation violation (exposes internal DB fields and hashes).",
}

# Fallback catalog for all 28 patient-facing tools (used before or if discovery is offline)
STATIC_CHRONIQ_TOOL_CATALOG: Dict[str, Dict[str, Any]] = {
    "list_hospitals": {
        "description": "Search active hospitals with optional filters (city, specialty, rating, search, lat, lng, radius_km).",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name filter."},
                "specialty": {"type": "string", "description": "Medical specialty filter."},
                "rating": {"type": "number", "description": "Minimum average rating (0.0-5.0)."},
                "search": {"type": "string", "description": "Free-text search on hospital name."},
                "lat": {"type": "number", "description": "Latitude for geo search."},
                "lng": {"type": "number", "description": "Longitude for geo search."},
                "radius_km": {"type": "number", "description": "Search radius in km (default 25)."}
            },
            "required": []
        }
    },
    "get_hospital_details": {
        "description": "Get full hospital details including departments and doctors.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Hospital ID."}
            },
            "required": ["id"]
        }
    },
    "search_doctors": {
        "description": "Search for doctors across all hospitals with clinical and location filters.",
        "parameters": {
            "type": "object",
            "properties": {
                "specialty": {"type": "string", "description": "Clinical specialty."},
                "hospital_id": {"type": "string", "description": "Filter by specific hospital."},
                "city": {"type": "string", "description": "City name."},
                "gender": {"type": "string", "description": "Doctor gender ('male', 'female', etc.)."},
                "language": {"type": "string", "description": "Spoken language."},
                "fee_max": {"type": "integer", "description": "Maximum consultation fee."},
                "rating_min": {"type": "number", "description": "Minimum rating (0.0-5.0)."},
                "search": {"type": "string", "description": "Free-text search on doctor name."}
            },
            "required": []
        }
    },
    "get_doctor_profile": {
        "description": "Get full public profile for a doctor including fees, department, and qualifications.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Doctor ID."}
            },
            "required": ["id"]
        }
    },
    "list_specialties": {
        "description": "List all distinct medical specialties offered by active doctors across hospitals.",
        "parameters": {"type": "object", "properties": {}}
    },
    "get_doctor_slots": {
        "description": "Get available appointment slots for a specific doctor on a given date (YYYY-MM-DD).",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "string", "description": "Doctor ID."},
                "date": {"type": "string", "description": "Date in YYYY-MM-DD format."}
            },
            "required": ["doctor_id", "date"]
        }
    },
    "hold_appointment_slot": {
        "description": "Temporarily hold an appointment slot for 5 minutes (requires patient auth).",
        "parameters": {
            "type": "object",
            "properties": {
                "slot_id": {"type": "string", "description": "Slot ID to hold."},
                "confirmed": {"type": "boolean", "description": "Explicit confirmation flag."}
            },
            "required": ["slot_id"]
        }
    },
    "release_appointment_slot": {
        "description": "Release a previously held appointment slot.",
        "parameters": {
            "type": "object",
            "properties": {
                "slot_id": {"type": "string", "description": "Slot ID to release."}
            },
            "required": ["slot_id"]
        }
    },
    "book_appointment": {
        "description": "Book a confirmed appointment for a held or available slot (requires patient auth).",
        "parameters": {
            "type": "object",
            "properties": {
                "slot_id": {"type": "string", "description": "Slot ID."},
                "doctor_id": {"type": "string", "description": "Doctor ID."},
                "family_member_id": {"type": "string", "description": "Optional family dependent ID."},
                "reason": {"type": "string", "description": "Reason for visit."},
                "symptoms_note": {"type": "string", "description": "Description of current symptoms."},
                "confirmed": {"type": "boolean", "description": "Explicit confirmation flag."}
            },
            "required": ["slot_id", "doctor_id"]
        }
    },
    "list_my_appointments": {
        "description": "List all upcoming and past appointments for the authenticated patient.",
        "parameters": {"type": "object", "properties": {}}
    },
    "get_appointment_details": {
        "description": "Get details of a specific appointment by appointment ID or booking code.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Appointment ID or booking code."}
            },
            "required": ["id"]
        }
    },
    "cancel_appointment": {
        "description": "Cancel an existing appointment with a reason (requires patient auth).",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Appointment ID."},
                "reason": {"type": "string", "description": "Cancellation reason."},
                "confirmed": {"type": "boolean", "description": "Explicit confirmation flag."}
            },
            "required": ["id"]
        }
    },
    "get_patient_profile": {
        "description": "Get profile details for the authenticated patient.",
        "parameters": {"type": "object", "properties": {}}
    },
    "update_patient_profile": {
        "description": "Update patient profile attributes (name, phone, email, age, gender, preferred_language, photo_url).",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "phone": {"type": "string"},
                "email": {"type": "string"},
                "age": {"type": "integer"},
                "gender": {"type": "string"},
                "preferred_language": {"type": "string"},
                "photo_url": {"type": "string"},
                "confirmed": {"type": "boolean"}
            }
        }
    },
    "list_family_members": {
        "description": "List all registered family members/dependents for the authenticated patient.",
        "parameters": {"type": "object", "properties": {}}
    },
    "add_family_member": {
        "description": "Add a new family dependent (name, relation, age, gender).",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "relation": {"type": "string"},
                "age": {"type": "integer"},
                "gender": {"type": "string"}
            },
            "required": ["name", "relation"]
        }
    },
    "update_family_member": {
        "description": "Update an existing family dependent.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "relation": {"type": "string"},
                "age": {"type": "integer"},
                "gender": {"type": "string"}
            },
            "required": ["id"]
        }
    },
    "delete_family_member": {
        "description": "Delete a family member by ID (requires patient auth and confirmation).",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "confirmed": {"type": "boolean"}
            },
            "required": ["id"]
        }
    },
    "list_medical_documents": {
        "description": "List uploaded medical documents and lab reports for the patient (metadata only).",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Filter by category: 'lab_report', 'prescription', 'imaging', 'discharge_summary', 'other'."
                }
            }
        }
    },
    "update_medical_document": {
        "description": "Update metadata for a medical document (name or category).",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "category": {"type": "string"}
            },
            "required": ["id"]
        }
    },
    "list_my_reviews": {
        "description": "List reviews submitted by the authenticated patient for doctor/hospital visits.",
        "parameters": {"type": "object", "properties": {}}
    },
    "submit_appointment_review": {
        "description": "Submit a review and rating for a completed appointment.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string"},
                "doctor_rating": {"type": "integer", "description": "1 to 5 rating."},
                "hospital_rating": {"type": "integer", "description": "1 to 5 rating."},
                "comment": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "wait_as_expected": {"type": "string", "enum": ["shorter", "as_expected", "longer"]},
                "confirmed": {"type": "boolean"}
            },
            "required": ["appointment_id", "doctor_rating", "hospital_rating"]
        }
    },
    "update_appointment_review": {
        "description": "Update a previously submitted review within the 48-hour edit window.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "doctor_rating": {"type": "integer"},
                "hospital_rating": {"type": "integer"},
                "comment": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "wait_as_expected": {"type": "string"}
            },
            "required": ["id"]
        }
    },
    "list_support_tickets": {
        "description": "List support tickets submitted by the authenticated patient.",
        "parameters": {"type": "object", "properties": {}}
    },
    "create_support_ticket": {
        "description": "Create a new patient support ticket for booking, hospital, or billing issues.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["booking_problem", "queue_or_waiting", "fee_or_payment", "app_problem", "privacy_concern", "other"]
                },
                "description": {"type": "string"},
                "appointment_id": {"type": "string"},
                "hospital_id": {"type": "string"},
                "contact_preference": {"type": "string", "enum": ["in_app", "email", "sms"]},
                "confirmed": {"type": "boolean"}
            },
            "required": ["category", "description"]
        }
    },
    "list_notifications": {
        "description": "List notifications and appointment reminders for the authenticated patient.",
        "parameters": {"type": "object", "properties": {}}
    },
    "mark_notification_as_read": {
        "description": "Mark a notification as read by ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"}
            },
            "required": ["id"]
        }
    },
    "update_notification_preferences": {
        "description": "Update patient notification preferences (channels, reminder_24h, reminder_1h).",
        "parameters": {
            "type": "object",
            "properties": {
                "channels": {"type": "object"},
                "reminder_24h": {"type": "boolean"},
                "reminder_1h": {"type": "boolean"}
            }
        }
    },
}


class ChroniQMCPClient:
    """Client for communicating with the ChroniQ MCP Server."""

    def __init__(self):
        self._cached_tools: Dict[str, Dict[str, Any]] = dict(STATIC_CHRONIQ_TOOL_CATALOG)
        self._last_discovery_time: float = 0.0
        self._lock = asyncio.Lock()

    @property
    def is_enabled(self) -> bool:
        return bool(settings.CHRONIQ_MCP_ENABLED and settings.CHRONIQ_MCP_URL)

    def _sanitize_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Redact sensitive fields from logging when CHRONIQ_MCP_LOG_SENSITIVE_DATA is false."""
        if settings.CHRONIQ_MCP_LOG_SENSITIVE_DATA:
            return args

        sensitive_keys = {"token", "auth_token", "password", "phone", "email", "secret", "user_id"}
        sanitized = {}
        for k, v in args.items():
            if k.lower() in sensitive_keys and v is not None:
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = v
        return sanitized

    async def get_tools(self, force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
        """Returns registered/discovered tools, refreshing if cache TTL expired."""
        now = time.time()
        ttl = settings.CHRONIQ_MCP_TOOL_DISCOVERY_CACHE_TTL

        if not force_refresh and (now - self._last_discovery_time < ttl):
            return self._cached_tools

        async with self._lock:
            # Double-check inside lock
            if not force_refresh and (time.time() - self._last_discovery_time < ttl):
                return self._cached_tools

            try:
                discovered = await self._discover_remote_tools()
                if discovered:
                    self._cached_tools = discovered
                    self._last_discovery_time = time.time()
                    logger.info(f"[ChroniQ MCP] Successfully refreshed {len(discovered)} tools from remote server.")
            except Exception as e:
                logger.warning(
                    f"[ChroniQ MCP] Remote tool discovery failed ({e}). Falling back to cached/static catalog."
                )
                self._last_discovery_time = time.time()  # Backoff TTL before retrying

            return self._cached_tools

    async def _discover_remote_tools(self) -> Dict[str, Dict[str, Any]]:
        """Discovers tools live from the remote ChroniQ MCP server."""
        if not self.is_enabled:
            return STATIC_CHRONIQ_TOOL_CATALOG

        import mcp.client.streamable_http as sh
        from mcp import ClientSession

        timeout = sh.httpx2.Timeout(
            settings.CHRONIQ_MCP_REQUEST_TIMEOUT,
            connect=settings.CHRONIQ_MCP_CONNECT_TIMEOUT
        )
        headers = {"User-Agent": "Healix-MCP-Client/1.0"}

        async with sh.httpx2.AsyncClient(headers=headers, timeout=timeout) as http_client:
            async with sh.streamable_http_client(settings.CHRONIQ_MCP_URL, http_client=http_client) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    response = await session.list_tools()
                    discovered: Dict[str, Dict[str, Any]] = {}
                    for t in response.tools:
                        params = t.inputSchema if hasattr(t, "inputSchema") and t.inputSchema else {"type": "object", "properties": {}}
                        discovered[t.name] = {
                            "description": t.description or "",
                            "parameters": params
                        }
                    return discovered

    def is_chroniq_tool(self, name: str) -> bool:
        """Check if tool name belongs to ChroniQ catalog."""
        return name in self._cached_tools or name in STATIC_CHRONIQ_TOOL_CATALOG or name in CHRONIQ_BLOCKED_TOOLS

    async def execute_tool(
        self,
        name: str,
        arguments: Dict[str, Any],
        caller_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Executes a ChroniQ tool remotely over streamable HTTP transport."""
        start_time = time.perf_counter()

        if settings.CHRONIQ_MCP_LOG_TOOL_CALLS:
            sanitized = self._sanitize_args(arguments)
            logger.info(f"[ChroniQ MCP Tool Call] Invoking '{name}' with args: {json.dumps(sanitized)}")

        # 1. Check for blocked tools
        if name in CHRONIQ_BLOCKED_TOOLS:
            reason = CHRONIQ_BLOCKED_TOOLS[name]
            logger.warning(f"[ChroniQ MCP] Call to blocked tool '{name}' rejected: {reason}")
            return {
                "success": False,
                "content": f"The requested operation '{name}' is currently unavailable for security and safety reasons ({reason}).",
                "sources": [],
                "raw_data": {"error": "tool_blocked", "reason": reason},
                "execution_time_ms": (time.perf_counter() - start_time) * 1000
            }

        # 2. Check mutations policy
        if name in CHRONIQ_MUTATING_TOOLS and not settings.CHRONIQ_MCP_MUTATIONS_ALLOWED:
            logger.warning(
                f"[ChroniQ MCP] Mutating tool '{name}' called while CHRONIQ_MCP_MUTATIONS_ALLOWED=False."
            )
            return {
                "success": False,
                "content": (
                    f"Action '{name}' requires write permissions, but mutations are currently disabled "
                    f"(CHRONIQ_MCP_MUTATIONS_ALLOWED=false). Read-only queries (searching hospitals, "
                    f"doctors, slots, and viewing records) are active."
                ),
                "sources": [],
                "raw_data": {"error": "mutations_disabled"},
                "execution_time_ms": (time.perf_counter() - start_time) * 1000
            }

        # 3. Clean arguments (remove internal Healix fields like user_id)
        clean_args = {k: v for k, v in arguments.items() if k not in ("user_id", "auth_token")}

        # 4. Resolve bearer token
        token = caller_token or get_caller_token()
        headers = {"User-Agent": "Healix-MCP-Client/1.0"}
        if token and settings.CHRONIQ_MCP_AUTH_FORWARDING_ENABLED:
            headers["Authorization"] = f"Bearer {token}"

        # 5. Remote execution via MCP session
        import mcp.client.streamable_http as sh
        from mcp import ClientSession

        timeout = sh.httpx2.Timeout(
            settings.CHRONIQ_MCP_REQUEST_TIMEOUT,
            connect=settings.CHRONIQ_MCP_CONNECT_TIMEOUT
        )

        try:
            async with sh.httpx2.AsyncClient(headers=headers, timeout=timeout) as http_client:
                async with sh.streamable_http_client(settings.CHRONIQ_MCP_URL, http_client=http_client) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        call_res = await session.call_tool(name, clean_args)
                        elapsed_ms = (time.perf_counter() - start_time) * 1000

                        # Extract text contents
                        content_texts = []
                        if hasattr(call_res, "content") and call_res.content:
                            for item in call_res.content:
                                if hasattr(item, "text"):
                                    content_texts.append(item.text)
                                else:
                                    content_texts.append(str(item))

                        combined_text = "\n".join(content_texts) if content_texts else "No content returned from tool."

                        # Parse raw JSON if available
                        raw_data = None
                        try:
                            raw_data = json.loads(combined_text)
                        except Exception:
                            pass

                        # Create a source reference for UI transparency
                        source_item = {
                            "id": f"chroniq-{name}",
                            "title": f"ChroniQ Patient Portal: {name}",
                            "url": settings.CHRONIQ_MCP_URL,
                            "type": "chroniq_mcp",
                            "snippet": (combined_text[:200] + "...") if len(combined_text) > 200 else combined_text
                        }

                        logger.info(
                            f"[ChroniQ MCP Tool Result] Tool '{name}' executed in {elapsed_ms:.1f}ms."
                        )

                        is_err = getattr(call_res, "isError", False)
                        if isinstance(raw_data, dict) and "error" in raw_data:
                            is_err = True

                        return {
                            "success": not is_err,
                            "content": combined_text,
                            "sources": [source_item],
                            "raw_data": raw_data,
                            "execution_time_ms": elapsed_ms
                        }


        except asyncio.TimeoutError:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"[ChroniQ MCP Timeout] Request to tool '{name}' timed out after {elapsed_ms:.1f}ms.")
            return {
                "success": False,
                "content": f"ChroniQ MCP request timed out after {settings.CHRONIQ_MCP_REQUEST_TIMEOUT}s.",
                "sources": [],
                "raw_data": {"error": "timeout"},
                "execution_time_ms": elapsed_ms
            }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"[ChroniQ MCP Error] Failed to execute tool '{name}': {e}", exc_info=True)
            return {
                "success": False,
                "content": f"ChroniQ MCP execution failed: {str(e)}",
                "sources": [],
                "raw_data": {"error": str(e)},
                "execution_time_ms": elapsed_ms
            }


# Singleton instance
chroniq_mcp_client = ChroniQMCPClient()
