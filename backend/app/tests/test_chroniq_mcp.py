"""Test suite for ChroniQ Patient MCP Integration with Healix."""

import pytest
from app.config import settings
from app.services.chroniq_mcp_client import (
    CHRONIQ_BLOCKED_TOOLS,
    CHRONIQ_MUTATING_TOOLS,
    STATIC_CHRONIQ_TOOL_CATALOG,
    chroniq_mcp_client,
)
from app.services.mcp_service import mcp_service


def test_chroniq_mcp_settings_loaded():
    """Verify ChroniQ MCP configuration loaded from environment / .env."""
    assert settings.CHRONIQ_MCP_ENABLED is True
    assert "chroniq-mcp.onrender.com" in settings.CHRONIQ_MCP_URL
    assert settings.CHRONIQ_MCP_TRANSPORT == "streamable-http"
    assert settings.CHRONIQ_MCP_REQUEST_TIMEOUT >= 10.0
    assert settings.CHRONIQ_MCP_MUTATIONS_ALLOWED is False
    assert settings.CHRONIQ_MCP_TOOL_DISCOVERY_CACHE_TTL == 60


def test_static_catalog_contains_28_tools():
    """Verify static catalog defines all 28 patient-facing tools."""
    assert len(STATIC_CHRONIQ_TOOL_CATALOG) == 28
    expected_sample = {
        "list_hospitals",
        "get_hospital_details",
        "search_doctors",
        "get_doctor_profile",
        "list_specialties",
        "get_doctor_slots",
        "hold_appointment_slot",
        "release_appointment_slot",
        "book_appointment",
        "list_my_appointments",
        "get_appointment_details",
        "cancel_appointment",
        "get_patient_profile",
        "update_patient_profile",
        "list_family_members",
        "add_family_member",
        "update_family_member",
        "delete_family_member",
        "list_medical_documents",
        "update_medical_document",
        "list_my_reviews",
        "submit_appointment_review",
        "update_appointment_review",
        "list_support_tickets",
        "create_support_ticket",
        "list_notifications",
        "mark_notification_as_read",
        "update_notification_preferences",
    }
    for tool_name in expected_sample:
        assert tool_name in STATIC_CHRONIQ_TOOL_CATALOG


def test_mcp_service_tool_export():
    """Verify mcp_service.get_openai_tools() exports built-in + ChroniQ tools (33 total)."""
    tools = mcp_service.get_openai_tools()
    tool_names = {t["function"]["name"] for t in tools}

    # 5 built-in tools
    assert "web_search" in tool_names
    assert "search_medical_guidelines" in tool_names
    assert "create_file" in tool_names
    assert "edit_file" in tool_names
    assert "get_place_maps" in tool_names

    # 28 ChroniQ tools
    assert "list_hospitals" in tool_names
    assert "search_doctors" in tool_names
    assert "get_doctor_slots" in tool_names
    assert "book_appointment" in tool_names
    assert len(tools) == 33


@pytest.mark.asyncio
async def test_mutation_gating_safeguard():
    """Verify mutating tools are blocked when CHRONIQ_MCP_MUTATIONS_ALLOWED=False."""
    result = await mcp_service.execute_tool("book_appointment", {
        "slot_id": "slot-999",
        "doctor_id": "doc-123"
    })
    assert result.success is False
    assert "mutations are currently disabled" in result.content.lower()


@pytest.mark.asyncio
async def test_blocked_tools_rejection():
    """Verify security-blocked tools are rejected with explanation."""
    result = await mcp_service.execute_tool("reschedule_appointment", {"id": "apt-123"})
    assert result.success is False
    assert "unavailable for security and safety reasons" in result.content


@pytest.mark.asyncio
async def test_live_chroniq_read_tool():
    """Verify live read tool execution over streamable HTTP transport."""
    result = await mcp_service.execute_tool("list_specialties", {})
    assert result.success is True
    assert "Cardiology" in result.content
    assert len(result.sources) > 0
    assert result.sources[0]["type"] == "chroniq_mcp"
