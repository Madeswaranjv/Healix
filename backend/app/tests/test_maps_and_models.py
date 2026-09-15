"""Unit tests for Google Maps link generation, entity extraction, follow-up query context handling, and new OpenRouter models."""
import pytest
from app.core.maps import (
    generate_google_maps_url,
    detect_maps_followup_intent,
    extract_businesses_from_text,
    extract_local_businesses_from_search,
)
from app.services.llm_service import llm_service
from app.services.mcp_service import mcp_service
from app.config import settings


def test_generate_google_maps_url_standard():
    """Verify safe URL encoding and Google Maps Search URL structure."""
    name = "Apollo Pharmacy"
    location = "Ellis Nagar, Madurai - 625016"
    url = generate_google_maps_url(name, location)

    assert url.startswith("https://www.google.com/maps/search/?api=1&query=")
    assert "Apollo%20Pharmacy" in url
    assert "Ellis%20Nagar" in url
    assert "625016" in url
    # Ensure no raw spaces or unencoded characters
    assert " " not in url


def test_generate_google_maps_url_verified_place_url():
    """Verify that an existing verified Google Maps place URL is preserved."""
    verified = "https://www.google.com/maps/place/Apollo+Pharmacy/@9.925,78.115,17z"
    url = generate_google_maps_url("Apollo Pharmacy", "Ellis Nagar", verified_url=verified)
    assert url == verified


def test_generate_google_maps_url_no_hallucinated_address():
    """Verify fallback to name + area + city when specific street address is not known."""
    name = "Mass Medical Shop"
    location = "Ellis Nagar, Madurai"
    url = generate_google_maps_url(name, location)

    assert "Mass%20Medical%20Shop" in url
    assert "Ellis%20Nagar" in url
    assert "Madurai" in url
    assert "https://www.google.com/maps/search/?api=1&query=" in url


def test_detect_maps_followup_intent():
    """Test follow-up intent detection for various query phrasings."""
    assert detect_maps_followup_intent("Also their google map links?") is True
    assert detect_maps_followup_intent("Give me the map links") is True
    assert detect_maps_followup_intent("Where are these shops?") is True
    assert detect_maps_followup_intent("Show these on Google Maps") is True
    assert detect_maps_followup_intent("Can you give directions to them?") is True
    assert detect_maps_followup_intent("Show their locations on maps") is True

    # Negative cases
    assert detect_maps_followup_intent("What are the side effects of Metformin?") is False
    assert detect_maps_followup_intent("Can I take paracetamol with ibuprofen?") is False
    assert detect_maps_followup_intent("Explain normal blood pressure ranges") is False


def test_extract_businesses_from_table():
    """Test extracting businesses and locations from previous assistant markdown tables."""
    table_text = (
        "Here are some medical shops near Ellis Nagar:\n\n"
        "| # | Medical Shop | Location |\n"
        "|---|---|---|\n"
        "| 1 | Apollo Pharmacy | Ellis Nagar, Madurai |\n"
        "| 2 | Vasan Medical Hall | Ellis Nagar, Madurai |\n"
        "| 3 | Devaki Medicals | Ellis Nagar, Madurai - 625016 |\n"
    )
    extracted = extract_businesses_from_text(table_text)
    assert len(extracted) == 3
    assert extracted[0]["name"] == "Apollo Pharmacy"
    assert "Ellis Nagar" in extracted[0]["location"]
    assert extracted[0]["googleMapsUrl"].startswith("https://www.google.com/maps/search/?api=1&query=")
    assert extracted[1]["name"] == "Vasan Medical Hall"
    assert extracted[2]["name"] == "Devaki Medicals"


def test_extract_businesses_from_numbered_list():
    """Test extracting businesses from numbered lists in conversation history."""
    list_text = (
        "Here are the pharmacies:\n"
        "1. **Apollo Pharmacy** - 70 Feet Road, Ellis Nagar, Madurai\n"
        "2. **Shifa Medicals** - No:30, Sarvodaya Nagar, Ellis Nagar, Madurai - 625016\n"
        "3. **Mass Medical Shop** - Ellis Nagar, Madurai\n"
    )
    extracted = extract_businesses_from_text(list_text)
    assert len(extracted) == 3
    assert extracted[0]["name"] == "Apollo Pharmacy"
    assert "70 Feet Road" in extracted[0]["location"]
    assert extracted[1]["name"] == "Shifa Medicals"
    assert "Sarvodaya Nagar" in extracted[1]["location"]


def test_extract_local_businesses_from_search():
    """Test entity extraction from raw web search results."""
    mock_results = [
        {
            "title": "Apollo Pharmacy - Ellis Nagar Madurai",
            "content": "Apollo Pharmacy located at 70 Feet Road, Ellis Nagar, Madurai - 625016. Open 24 hours.",
            "url": "https://www.apollopharmacy.in/ellis-nagar",
        },
        {
            "title": "Top Chemists in Ellis Nagar Madurai - Justdial",
            "content": "Shifa Medicals, No:30, Sarvodaya Nagar Main Road, Ellis Nagar, Madurai - 625016. Contact: 0452-2601234.",
            "url": "https://www.justdial.com/Madurai/Chemists-in-Ellis-Nagar",
        }
    ]
    extracted = extract_local_businesses_from_search("medical shops near Ellis Nagar, Madurai", mock_results)
    assert len(extracted) >= 1
    names = [e["name"] for e in extracted]
    assert any("Apollo Pharmacy" in n for n in names)
    for e in extracted:
        assert e["googleMapsUrl"].startswith("https://www.google.com/maps/search/?api=1&query=")


def test_model_resolution_new_and_existing():
    """Test that new OpenRouter models resolve correctly alongside existing models."""
    # New Model 1: Nex N2.5 Pro
    assert llm_service.resolve_model("Nex N2.5 Pro") == settings.NEX_N2_5_PRO_MODEL
    assert llm_service.resolve_model("nex-agi/nex-n2.5-pro:free") == "nex-agi/nex-n2.5-pro:free"

    # New Model 2: Ling 3.0 Flash VL
    assert llm_service.resolve_model("Ling 3.0 Flash VL") == settings.LING_3_0_FLASH_VL_MODEL
    assert llm_service.resolve_model("inclusionai/ling-3.0-flash-vl:free") == "inclusionai/ling-3.0-flash-vl:free"

    # Existing models continue working
    assert llm_service.resolve_model("Gemini 3.8 Flash") == "gemini-3.8-flash"
    assert llm_service.resolve_model("Asclepius Flash") == "inclusionai/ling-3.0-flash-fin:free"
    assert llm_service.resolve_model("Cortex") == "cohere/north-mini-code:free"
    assert llm_service.resolve_model("Helix 4 Pro") == "google/gemma-4-31b-it:free"
    assert llm_service.resolve_model("Aether 3 Super") == "nvidia/nemotron-3-super-120b-a12b:free"
    assert llm_service.resolve_model("Salve") == "liquid/lfm-2.5-2.6b:free"
    assert llm_service.resolve_model("Rx Neuron") == "dots-studio/dots-3-note-preview:free"


@pytest.mark.asyncio
async def test_get_place_maps_tool():
    """Test MCP get_place_maps tool execution."""
    result = await mcp_service.execute_tool("get_place_maps", {
        "location": "Ellis Nagar, Madurai",
        "businesses": [
            {"name": "Apollo Pharmacy", "address": "Ellis Nagar, Madurai - 625016"},
            {"name": "Devaki Medicals", "address": "Ellis Nagar, Madurai"}
        ]
    })
    assert result.success is True
    assert "Apollo Pharmacy" in result.content
    assert "https://www.google.com/maps/search/?api=1&query=Apollo%20Pharmacy" in result.content
    assert len(result.sources) == 2
