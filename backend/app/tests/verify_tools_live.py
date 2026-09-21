import asyncio
import json
import logging
import sys
from typing import Any, Dict

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ToolVerification")

async def test_direct_tools():
    print("\n" + "="*80)
    print(" 1. DIRECT TOOL EXECUTION VERIFICATION (MCP Service & ChroniQ)")
    print("="*80)

    from app.services.mcp_service import mcp_service

    tools_to_test = [
        ("list_specialties", {}),
        ("list_hospitals", {}),
        ("search_doctors", {"specialty": "Cardiology", "city": "Chennai"}),
        ("get_hospital_details", {"id": "hosp_city_01"}),
        ("get_doctor_profile", {"id": "doc_card_1"}),
        ("get_doctor_slots", {"doctor_id": "doc_card_1", "date": "2026-09-22"}),
        ("book_appointment", {"doctor_id": "doc_card_1", "slot_id": "slot_01"}),  # Mutation safeguard test
    ]

    for tool_name, args in tools_to_test:
        print(f"\n--- Testing tool: '{tool_name}' with args: {args} ---")
        try:
            res = await mcp_service.execute_tool(tool_name, args)
            success = getattr(res, "success", False)
            content = getattr(res, "content", "")
            content_preview = str(content)[:350]
            raw_data = getattr(res, "raw_data", None)

            status_str = "SUCCESS (Live Data Received)" if success else "BLOCKED / MUTATION SAFEGUARD ENFORCED"
            print(f"Status: {status_str}")
            print(f"Content Preview:\n{content_preview}...")
            if raw_data:
                if isinstance(raw_data, dict):
                    print(f"Data Schema: Keys -> {list(raw_data.keys())}")
                elif isinstance(raw_data, list):
                    print(f"Data Schema: List of {len(raw_data)} items")
        except Exception as e:
            print(f"Execution Error: {e}")

async def test_llm_tool_usage():
    print("\n" + "="*80)
    print(" 2. AUTONOMOUS LLM TOOL USAGE VERIFICATION")
    print("="*80)

    from app.services.mcp_service import mcp_service
    from app.services.llm_service import llm_service
    from app.core.prompts import HEALTHCARE_SYSTEM_PROMPT

    tools = mcp_service.get_openai_tools()
    print(f"Total tools exposed to LLM: {len(tools)}")
    tool_names = [t["function"]["name"] for t in tools]
    print(f"Available tool names sample: {', '.join(tool_names[:10])}... ({len(tool_names)} total)")

    prompt = "Can you search for cardiology doctors in Chennai and tell me their names, consultation fee, and hospital?"
    print(f"\nUser Query: \"{prompt}\"")

    messages = [
        {"role": "system", "content": HEALTHCARE_SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]

    try:
        response = await llm_service.generate_chat_response(
            messages=messages,
            tools=tools,
            user_query=prompt,
            temperature=0.2
        )

        tool_calls = response.get("tool_calls", [])
        print("\n--- Autonomous Tool Invocations by LLM ---")
        print(f"Count: {len(tool_calls)}")
        for idx, tc in enumerate(tool_calls, 1):
            print(f"  [{idx}] Invoked Tool: {tc.get('name')}")
            print(f"      Arguments: {json.dumps(tc.get('args'))}")

        print("\n--- Final Synthesized Response from LLM ---")
        answer = response.get("answer", "(No answer returned)")
        try:
            print(answer)
        except Exception:
            print(answer.encode("ascii", errors="replace").decode("ascii"))

        sources = response.get("sources", [])
        print(f"\n--- Attached Sources ({len(sources)}) ---")
        for s in sources:
            print(f"  - {s.get('title')}: {s.get('url') or s.get('content', '')[:60]}")

    except Exception as e:
        print(f"LLM Tool Execution Error: {e}")

async def main():
    await test_direct_tools()
    await test_llm_tool_usage()

if __name__ == "__main__":
    asyncio.run(main())
