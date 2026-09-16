"""OpenRouter LLM integration service with Model Context Protocol (MCP) tool calling, automatic fallbacks, and vision support."""
import base64
import json
import logging
import re
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import AsyncOpenAI

from app.config import settings
from app.core.prompts import VISION_ANALYSIS_SYSTEM_PROMPT
from app.services.mcp_service import mcp_service
from app.services.file_service import file_service

logger = logging.getLogger("healix.llm")

# Keywords that indicate the user wants a file/document created
_FILE_INTENT_KEYWORDS = re.compile(
    r"\b(create|draft|generate|produce|write|make|prepare|give|build|compile|put)\b.{0,60}\b(file|pdf|document|doc|report|note|summary|paper|article|md|markdown|text)\b",
    re.IGNORECASE
)

# Secondary patterns: "as a pdf", "in a file", "into a document", "in pdf form", etc.
_FILE_INTENT_SUFFIX = re.compile(
    r"\b(as|in|into|to)\s+(a\s+)?(pdf|file|document|doc|report|note|summary|text|markdown|md)\b",
    re.IGNORECASE
)

def _is_file_request(query: str) -> bool:
    """Returns True if the user query indicates they want a file/document created."""
    return bool(_FILE_INTENT_KEYWORDS.search(query) or _FILE_INTENT_SUFFIX.search(query))

def parse_text_tool_calls(text: str, default_query: str = "") -> List[Dict[str, Any]]:
    """Detects text/XML tool calls (e.g. <toolcall>, <dotsfunctioncall>, <tool_call>) emitted by models."""
    calls = []
    if not text:
        return calls

    lower = text.lower()
    
    # Custom fallback for tagless tool dumps (create_file, web_search, etc.)
    if "<toolcall" not in lower:
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if len(lines) >= 3:
            first_line = lines[0].lower()
            if "create_file" in first_line and "filename" in lower and "content" in lower:
                c = ""
                t = "Untitled"
                content_idx = -1
                for i, l in enumerate(lines):
                    if l.lower() == "content" or "content" in l.lower():
                        content_idx = i
                        break
                if content_idx > 0:
                    t = lines[content_idx - 1]
                    if t.lower().endswith("content"):
                        t = t[:-7].strip()
                    c = "\n".join(lines[content_idx + 1:])
                    calls.append({"name": "create_file", "args": {"title": t, "content": c, "type": "md"}})
                    return calls
            elif "web_search" in first_line or "search_medical_guidelines" in first_line or "websearch" in first_line:
                # Look for the query string
                q = ""
                for i, l in enumerate(lines):
                    if l.lower() in ("query", "5query", "topic"):
                        if i + 1 < len(lines):
                            q = lines[i + 1]
                        break
                if not q and len(lines) > 1:
                    # If we couldn't find the 'query' keyword, maybe it's just the last line
                    q = lines[-1]
                
                if q:
                    tool_name = "web_search" if "web" in first_line else "search_medical_guidelines"
                    calls.append({"name": tool_name, "args": {"query": q, "topic": q}})
                    return calls

    if not any(tag in lower for tag in ["<toolcall", "<tool_call", "<dotsfunctioncall", "<invoke"]):
        return calls

    tool_alias = {
        "searchmedicalguidelines": "search_medical_guidelines",
        "searchmedical_guidelines": "search_medical_guidelines",
        "search_medical_guidelines": "search_medical_guidelines",
        "websearch": "web_search",
        "web_search": "web_search"
    }

    blocks = re.findall(
        r"(<(?:toolcall|tool_call|dotsfunctioncall)[^>]*>.*?(?:</(?:toolcall|tool_call|dotsfunctioncall)>|\Z))",
        text,
        re.DOTALL | re.IGNORECASE
    )
    if not blocks:
        blocks = [text]

    for block in blocks:
        name_match = re.search(
            r"(?:<toolcall>|<tool_call>|<dotsfunctioncall>\s*<|name=[\"\']?)([a-zA-Z0-9_\-]+)",
            block,
            re.IGNORECASE
        )
        tool_name = "web_search"
        if name_match:
            raw_name = name_match.group(1).lower().replace('"', '').replace("'", "")
            norm = raw_name.replace("_", "").replace("-", "")
            tool_name = tool_alias.get(norm, tool_alias.get(raw_name, "web_search"))

        val_match = re.search(r"<argvalue>(.*?)</argvalue>", block, re.DOTALL | re.IGNORECASE)
        if not val_match:
            val_match = re.search(r"<query>(.*?)</query>", block, re.DOTALL | re.IGNORECASE)

        if tool_name == "create_file" or tool_name == "edit_file":
            content_match = re.search(r"<content>(.*?)</content>", block, re.DOTALL | re.IGNORECASE)
            title_match = re.search(r"<title>(.*?)</title>", block, re.DOTALL | re.IGNORECASE)
            file_id_match = re.search(r"<file_id>(.*?)</file_id>", block, re.DOTALL | re.IGNORECASE)
            
            c = content_match.group(1).strip() if content_match else ""
            t = title_match.group(1).strip() if title_match else "Untitled"
            fid = file_id_match.group(1).strip() if file_id_match else ""
            
            if tool_name == "create_file":
                calls.append({"name": tool_name, "args": {"title": t, "content": c, "type": "md"}})
            else:
                calls.append({"name": tool_name, "args": {"file_id": fid, "new_content": c}})
        else:
            q = val_match.group(1).strip() if val_match else default_query
            if q:
                calls.append({"name": tool_name, "args": {"query": q, "topic": q}})

    if not calls and default_query:
        tool_name = "search_medical_guidelines" if "guideline" in lower else "web_search"
        calls.append({"name": tool_name, "args": {"query": default_query, "topic": default_query}})

    return calls


def clean_tool_markup(text: str) -> str:
    """Removes raw XML tool markup (e.g. <toolcall>, <dotsfunctioncall>, <tool_call>, etc.) if output by LLMs in text."""
    if not text:
        return ""
    if "create_file" in text.lower() and "filename" in text.lower() and "content" in text.lower() and "<toolcall" not in text.lower():
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if len(lines) >= 3 and "create_file" in lines[0].lower():
            return ""

    patterns = [
        r"<dotsfunctioncall[^>]*>.*?</dotsfunctioncall>",
        r"<tool_call>.*?</tool_call>",
        r"<toolcall>.*?</toolcall>",
        r"<toolcall>.*?</tool_call>",
        r"<invoke[^>]*>.*?</invoke>",
        r"<arg_key>.*?</arg_key>",
        r"<arg_value>.*?</arg_value>",
        r"<argkey>.*?</argkey>",
        r"<argvalue>.*?</argvalue>",
        r"</?(?:dotsfunctioncall|toolcall|tool_call|invoke|argkey|argvalue|arg_key|arg_value|searchmedicalguidelines|searchmedical_guidelines|websearch|web_search)[^>]*>",
    ]
    cleaned = text
    for pat in patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.DOTALL | re.IGNORECASE)

    # Strip raw text-based tool dumps (no XML tags): e.g. "web_search\nmax_results\n5\nquery\n..." or "create_file\nfilename\n..."
    # Match a tool name at the start of a line, followed by parameter-like lines
    cleaned = re.sub(
        r"(?:^|\n)(?:web_search|search_medical_guidelines|create_file|edit_file|websearch)\s*\n"
        r"(?:(?:max_results|query|topic|filename|content|file_id|new_content|type|title|results|5query|5|10|3)\s*\n)*"
        r"[^\n]*(?:\n|$)",
        "\n", cleaned, flags=re.IGNORECASE
    )

    # Also catch the full multi-line dump pattern where the tool name line is followed by
    # any number of short lines that look like params/values, ending at a double newline
    cleaned = re.sub(
        r"(?:^|\n)(?:web_search|search_medical_guidelines|create_file|edit_file)\s*\n"
        r"(?:[^\n]{0,50}\n){1,8}",
        "\n", cleaned, flags=re.IGNORECASE
    )

    cleaned = re.sub(r"\n\s*\n\s*\n", "\n\n", cleaned)
    return cleaned.strip()


class StreamTagFilter:
    """Filters out XML/tool-calling markup AND raw text-based tool dumps from streaming tokens in real time."""
    TAG_REGEX = re.compile(
        r"</?(?:dotsfunctioncall|toolcall|tool_call|invoke|argkey|argvalue|arg_key|arg_value|searchmedicalguidelines|searchmedical_guidelines|websearch|web_search)[^>]*>",
        re.IGNORECASE
    )

    # Known raw tool names and parameter keywords that models sometimes dump as plain text
    _TOOL_NAMES = {"web_search", "search_medical_guidelines", "create_file", "edit_file", "websearch"}
    _TOOL_PARAM_KEYWORDS = {
        "max_results", "query", "topic", "filename", "content", "file_id",
        "new_content", "type", "title", "5query", "max_result", "results",
    }

    def __init__(self):
        self.buffer = ""
        self._line_buffer = ""           # Accumulates full lines for raw-dump detection
        self._suppressing = False        # True when we're in the middle of a raw tool dump
        self._suppress_line_count = 0    # How many lines we've suppressed so far
        self._max_suppress_lines = 15    # Safety cap — stop suppressing after N lines

    def _is_tool_dump_start(self, line: str) -> bool:
        """Check if a line looks like the beginning of a raw text-based tool dump."""
        stripped = line.strip().lower().rstrip(":")
        return stripped in self._TOOL_NAMES

    def _is_tool_param_line(self, line: str) -> bool:
        """Check if a line looks like a raw tool parameter name or value."""
        stripped = line.strip().lower().rstrip(":")
        # Direct match to known param keywords
        if stripped in self._TOOL_PARAM_KEYWORDS:
            return True
        # Looks like a number (e.g. "5" for max_results value)
        if stripped.isdigit() and len(stripped) <= 3:
            return True
        # Parameter combined with value like "5query" or "max_results5"
        for kw in self._TOOL_PARAM_KEYWORDS:
            if kw in stripped and len(stripped) < len(kw) + 10:
                return True
        return False

    def process(self, chunk: str) -> str:
        self.buffer += chunk
        out = []

        while self.buffer:
            if "<" in self.buffer:
                idx = self.buffer.find("<")
                if idx > 0:
                    pre_text = self.buffer[:idx]
                    self.buffer = self.buffer[idx:]
                    filtered_pre = self._filter_raw_dumps(pre_text)
                    if filtered_pre:
                        out.append(filtered_pre)

                close_idx = self.buffer.find(">")
                if close_idx != -1:
                    tag = self.buffer[:close_idx + 1]
                    self.buffer = self.buffer[close_idx + 1:]
                    if not self.TAG_REGEX.match(tag):
                        filtered_tag = self._filter_raw_dumps(tag)
                        if filtered_tag:
                            out.append(filtered_tag)
                else:
                    if len(self.buffer) > 60:
                        filtered_char = self._filter_raw_dumps(self.buffer[0])
                        if filtered_char:
                            out.append(filtered_char)
                        self.buffer = self.buffer[1:]
                    break
            else:
                filtered = self._filter_raw_dumps(self.buffer)
                if filtered:
                    out.append(filtered)
                self.buffer = ""
                break

        return "".join(out)

    def _filter_raw_dumps(self, text: str) -> str:
        """Filter out raw text-based tool dumps line by line."""
        if not text:
            return ""

        self._line_buffer += text
        out_lines = []

        while "\n" in self._line_buffer:
            line_end = self._line_buffer.index("\n")
            line = self._line_buffer[:line_end]
            self._line_buffer = self._line_buffer[line_end + 1:]

            if self._suppressing:
                self._suppress_line_count += 1
                # Keep suppressing tool param lines; stop at safety cap or when we hit real content
                if self._suppress_line_count >= self._max_suppress_lines:
                    self._suppressing = False
                    self._suppress_line_count = 0
                elif self._is_tool_param_line(line) or line.strip() == "":
                    continue  # Suppress this line
                else:
                    # This line doesn't look like a param — stop suppressing
                    # But DON'T emit this line if it's clearly a query string following tool params
                    # (i.e. short content right after "query" or "5query")
                    if self._suppress_line_count <= 3:
                        # Still within the tool call header area — suppress the query value too
                        continue
                    self._suppressing = False
                    self._suppress_line_count = 0
                    out_lines.append(line + "\n")
            elif self._is_tool_dump_start(line):
                # Start suppressing
                self._suppressing = True
                self._suppress_line_count = 1
                continue
            else:
                out_lines.append(line + "\n")

        # If there's remaining content without a newline, only emit if not suppressing
        # But hold it in the line buffer until we get a full line
        if not self._suppressing and "\n" not in self._line_buffer:
            # Check if the partial line itself starts a tool dump
            if self._line_buffer.strip() and self._is_tool_dump_start(self._line_buffer):
                # Hold it — don't emit yet, wait for more content
                pass
            elif len(self._line_buffer) > 0 and not self._is_tool_dump_start(self._line_buffer.strip()):
                # Only emit if we're sure it's not a tool name being typed character by character
                # Wait until we have enough content to decide
                pass

        return "".join(out_lines)

    def flush(self) -> str:
        res = self.buffer + self._line_buffer
        self.buffer = ""
        self._line_buffer = ""
        self._suppressing = False
        self._suppress_line_count = 0
        # Clean both XML tags and raw tool dumps from remaining content
        cleaned = self.TAG_REGEX.sub("", res)
        cleaned = clean_tool_markup(cleaned)
        return cleaned


class LLMService:
    """Handles communication with OpenRouter and Google Gemini OpenAI-compatible APIs, supporting MCP tool calling."""

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.primary_model = settings.OPENROUTER_CHAT_MODEL
        self.fallback_model = settings.OPENROUTER_CHAT_MODEL_FALLBACK
        self.vision_model = settings.OPENROUTER_VISION_MODEL

        self.gemini_key = getattr(settings, "GEMINI_API_KEY", "")
        self.gemini_base_url = getattr(settings, "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
        self.gemini_primary = getattr(settings, "GEMINI_MODEL", "gemini-3.8-flash")
        self.gemini_fallback = getattr(settings, "GEMINI_MODEL_FALLBACK", "gemini-3.7-flash")
        self.gemini_model = self.gemini_primary

        self.client = AsyncOpenAI(
            api_key=self.api_key or "sk-dummy-key",
            base_url=self.base_url,
            default_headers={
                "HTTP-Referer": "https://healix.app",
                "X-Title": "Healix Healthcare Chatbot",
            }
        )

        self.gemini_client = AsyncOpenAI(
            api_key=self.gemini_key or "dummy-key",
            base_url=self.gemini_base_url
        ) if self.gemini_key else None

    # Friendly name to model mapping (Verified Active & Operational)
    MODEL_MAP = {
        # Google Gemini Flagship Free Models
        "Gemini 3.8 Flash": "gemini-3.8-flash",
        "Gemini 3.7 Flash": "gemini-3.7-flash",
        "Gemini": "gemini-3.8-flash",
        "gemini-3.8-flash": "gemini-3.8-flash",
        "gemini-3.7-flash": "gemini-3.7-flash",

        # OpenRouter Models (Verified Active)
        "Asclepius Flash": "inclusionai/ling-3.0-flash-fin:free",
        "Asclepius": "inclusionai/ling-3.0-flash-fin:free",
        "Cortex": "cohere/north-mini-code:free",
        "Cortex M3": "cohere/north-mini-code:free",
        "Cortex M2.7": "cohere/north-mini-code:free",
        "Helix 4 Pro": "google/gemma-4-31b-it:free",
        "Helix": "google/gemma-4-31b-it:free",
        "Aether 3 Super": "nvidia/nemotron-3-super-120b-a12b:free",
        "Aether 3.5 Lightning": "nvidia/nemotron-3.5-lightning:free",
        "Aether 3 Nano": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "Aether": "nvidia/nemotron-3-super-120b-a12b:free",
        "Salve": "liquid/lfm-2.5-2.6b:free",
        "Rx Neuron": "dots-studio/dots-3-note-preview:free",

        # New OpenRouter Models (Task 2)
        "Nex N2.5 Pro": getattr(settings, "NEX_N2_5_PRO_MODEL", "nex-agi/nex-n2.5-pro:free"),
        "nex-agi/nex-n2.5-pro:free": getattr(settings, "NEX_N2_5_PRO_MODEL", "nex-agi/nex-n2.5-pro:free"),
        "Ling 3.0 Flash VL": getattr(settings, "LING_3_0_FLASH_VL_MODEL", "inclusionai/ling-3.0-flash-vl:free"),
        "inclusionai/ling-3.0-flash-vl:free": getattr(settings, "LING_3_0_FLASH_VL_MODEL", "inclusionai/ling-3.0-flash-vl:free"),
    }

    def is_gemini_model(self, model_id: str) -> bool:
        """Checks whether the given model name or ID is a Gemini model."""
        if not model_id:
            return False
        return "gemini" in model_id.lower()

    def resolve_model(self, model_name: Optional[str]) -> str:
        """Resolves a model name or ID to an OpenRouter or Gemini model ID."""
        if not model_name:
            if self.gemini_key:
                return self.gemini_primary
            return self.primary_model
        if model_name in self.MODEL_MAP:
            return self.MODEL_MAP[model_name]
        if "/" in model_name or model_name.startswith("gemini-"):
            return model_name
        return self.gemini_primary if self.gemini_key else self.primary_model

    def get_execution_plan(self, requested_model: Optional[str]):
        """Returns a list of (client, model_id, is_gemini) tuples to try in order."""
        target_model = self.resolve_model(requested_model)
        attempts = []

        if self.is_gemini_model(target_model):
            # Target is Gemini
            if self.gemini_client:
                attempts.append((self.gemini_client, target_model, True))
                # Add fallback Gemini model
                fb = self.gemini_fallback if target_model != self.gemini_fallback else "gemini-3.7-flash"
                if fb != target_model:
                    attempts.append((self.gemini_client, fb, True))
            # OpenRouter fallback if configured
            if self.api_key and self.client:
                attempts.append((self.client, self.fallback_model, False))
        else:
            # Target is OpenRouter
            if self.api_key and self.client:
                attempts.append((self.client, target_model, False))
                if target_model != self.fallback_model:
                    attempts.append((self.client, self.fallback_model, False))
            # Gemini fallback if configured
            if self.gemini_client:
                attempts.append((self.gemini_client, self.gemini_fallback, True))

        return attempts

    async def generate_chat_response(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        user_query: str = "",
        user_id: str = "user_default",
    ) -> Dict[str, Any]:
        """Generates a chat completion with MCP tool-calling loop and model fallbacks.
        
        Returns:
            Dict containing 'answer' (str), 'sources' (list of dicts), and 'tool_calls' (list).
        """
        attempts = self.get_execution_plan(model)
        if not attempts:
            return {
                "answer": (
                    "**Notice:** Neither Gemini API key nor OpenRouter API key is configured in backend `.env`. "
                    "Please add `GEMINI_API_KEY` or `OPENROUTER_API_KEY` to enable real-time healthcare AI responses."
                ),
                "sources": [],
                "tool_calls": []
            }

        last_error = None
        for current_client, current_model, is_gem in attempts:
            try:
                logger.info(f"Querying chat model: {current_model} (gemini={is_gem}, tools={'enabled' if tools else 'none'})")
                working_messages = list(messages)
                accumulated_sources = []
                executed_tool_calls = []

                if tools:
                    # Multi-turn tool execution loop (up to 2 turns of tools)
                    for turn in range(2):
                        response = await current_client.chat.completions.create(
                            model=current_model,
                            messages=working_messages,
                            tools=tools if turn == 0 else None,
                            tool_choice="auto" if turn == 0 else None,
                            temperature=temperature,
                            max_tokens=max_tokens
                        )
                        choice = response.choices[0]
                        message = choice.message

                        # Check native tool calls
                        if getattr(message, "tool_calls", None) and len(message.tool_calls) > 0:
                            logger.info(f"[LLM Tool Turn {turn+1}] Model {current_model} requested {len(message.tool_calls)} native tool call(s).")
                            working_messages.append(message)

                            for tc in message.tool_calls:
                                func_name = tc.function.name
                                try:
                                    func_args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                                except Exception:
                                    func_args = {"query": tc.function.arguments}

                                func_args["user_id"] = user_id
                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                tool_result = await mcp_service.execute_tool(func_name, func_args)
                                if tool_result.sources:
                                    accumulated_sources.extend(tool_result.sources)

                                working_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.id,
                                    "name": func_name,
                                    "content": tool_result.content
                                })

                        # Check XML-based tool calls in text
                        elif parse_text_tool_calls(message.content or "", default_query=user_query):
                            xml_calls = parse_text_tool_calls(message.content or "", default_query=user_query)
                            logger.info(f"[LLM Tool Turn {turn+1}] Model {current_model} emitted {len(xml_calls)} text XML tool call(s).")
                            for tc in xml_calls:
                                func_name = tc["name"]
                                func_args = tc["args"]
                                func_args["user_id"] = user_id
                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                tool_result = await mcp_service.execute_tool(func_name, func_args)
                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                if tool_result.sources:
                                    accumulated_sources.extend(tool_result.sources)

                                working_messages.append({
                                    "role": "system",
                                    "content": f"[Tool Result for '{func_name}']:\n{tool_result.content}"
                                })

                        else:
                            # Final answer reached directly — no tool calls
                            content = clean_tool_markup(message.content or "")

                            # INTERCEPTION: If user wanted a file, redirect content into a file
                            if content.strip() and _is_file_request(user_query):
                                logger.info("[LLM] No tool calls but user wants a file. Redirecting content to file creation.")
                                fallback_title = user_query[:80].strip() or "Document"
                                try:
                                    file_record = file_service.create_file(
                                        user_id=user_id,
                                        title=fallback_title,
                                        file_type="md",
                                        content=content.strip()
                                    )
                                    accumulated_sources.append({
                                        "id": f"file-{file_record['id']}",
                                        "file_id": file_record["id"],
                                        "title": fallback_title,
                                        "type": "file",
                                        "file_type": "md"
                                    })
                                    executed_tool_calls.append({"name": "create_file", "args": {"title": fallback_title}})
                                    return {
                                        "answer": f"I have created a comprehensive document titled **{fallback_title}** for you. You can view and download it from the Files panel.",
                                        "sources": accumulated_sources,
                                        "tool_calls": executed_tool_calls
                                    }
                                except Exception as file_err:
                                    logger.error(f"[LLM] Direct file creation failed: {file_err}")

                            return {
                                "answer": content.strip(),
                                "sources": accumulated_sources,
                                "tool_calls": executed_tool_calls
                            }

                    # Final generation pass after tools
                    executed_names = {tc["name"] for tc in executed_tool_calls}
                    has_file_tool = bool(executed_names & {"create_file", "edit_file"})
                    has_search_only = bool(executed_names & {"web_search", "search_medical_guidelines"}) and not has_file_tool
                    user_wants_file = _is_file_request(user_query)

                    if has_file_tool:
                        synth = "The file has been successfully created. Now, output ONLY a very brief acknowledgement (1-2 sentences) confirming the file creation. DO NOT output the detailed document content or tables."
                    elif has_search_only and user_wants_file:
                        # Collect all search content from tool results for fallback file creation
                        _search_content_parts = []
                        for wm in working_messages:
                            if isinstance(wm, dict) and wm.get("role") in ("tool", "system"):
                                c = wm.get("content", "")
                                if "SEARCH RESULTS" in c.upper() or "GUIDELINE EVIDENCE" in c.upper() or "Tool Result" in c:
                                    _search_content_parts.append(c)

                        # Need a second pass to call create_file
                        working_messages.append({
                            "role": "system",
                            "content": (
                                "The web search results above contain the information the user needs. "
                                "The user wants this information saved as a FILE/DOCUMENT. "
                                "You MUST now call the `create_file` tool with a descriptive title and CLEAN, PROFESSIONALLY FORMATTED content. "
                                "CRITICAL CONTENT RULES FOR THE FILE: "
                                "1. SYNTHESIZE the search results into a polished medical document — do NOT copy-paste raw search output. "
                                "2. Use markdown tables (| Column | Column |) wherever statistics, comparisons, or structured data are involved. "
                                "3. Do NOT include raw URLs, 'Evidence:' markers, 'Safety Advisory' footers, source citation brackets like [1][2], or search engine metadata. "
                                "4. Use clear headings (##), bullet points, and professional formatting. "
                                "5. The document should read like a polished medical report, NOT a search result dump. "
                                "6. Include source references at the bottom in a clean 'References' section with just the title and URL. "
                                "Put the SYNTHESIZED content INSIDE the create_file tool call. "
                                "Do NOT output the content in chat — only a brief 1-2 sentence acknowledgement."
                            )
                        })
                        file_resp = await self.client.chat.completions.create(
                            model=current_model,
                            messages=working_messages,
                            tools=tools,
                            tool_choice="auto",
                            temperature=temperature,
                            max_tokens=max_tokens
                        )
                        file_msg = file_resp.choices[0].message
                        file_created_in_pass = False
                        if getattr(file_msg, "tool_calls", None) and len(file_msg.tool_calls) > 0:
                            working_messages.append(file_msg)
                            for tc in file_msg.tool_calls:
                                func_name = tc.function.name
                                try:
                                    func_args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                                except Exception:
                                    func_args = {}
                                func_args["user_id"] = user_id
                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                tool_result = await mcp_service.execute_tool(func_name, func_args)
                                if tool_result.sources:
                                    accumulated_sources.extend(tool_result.sources)
                                working_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.id,
                                    "name": func_name,
                                    "content": tool_result.content
                                })
                                if func_name in ("create_file", "edit_file"):
                                    file_created_in_pass = True
                        else:
                            # Text-based fallback for second pass
                            second_text_calls = parse_text_tool_calls(file_msg.content or "", default_query=user_query)
                            for tc in second_text_calls:
                                func_name = tc["name"]
                                func_args = tc["args"]
                                func_args["user_id"] = user_id
                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                tool_result = await mcp_service.execute_tool(func_name, func_args)
                                if tool_result.sources:
                                    accumulated_sources.extend(tool_result.sources)
                                working_messages.append({
                                    "role": "system",
                                    "content": f"[Tool Result for '{func_name}']:\n{tool_result.content}"
                                })
                                if func_name in ("create_file", "edit_file"):
                                    file_created_in_pass = True

                        # FALLBACK: If LLM failed to call create_file, synthesize and create the file directly
                        if not file_created_in_pass and _search_content_parts:
                            logger.info("[LLM] LLM did not call create_file in second pass. Synthesizing content and creating file directly.")
                            fallback_title = user_query[:80].strip() or "Web Search Report"
                            # Use LLM to synthesize raw search results into clean document content
                            raw_data = "\n\n".join(_search_content_parts)
                            synthesis_messages = [
                                {
                                    "role": "system",
                                    "content": (
                                        "You are a professional medical document writer. Transform the raw web search results below "
                                        "into a clean, well-structured markdown document. RULES: "
                                        "1. Synthesize and organize the information — do NOT copy-paste raw search output. "
                                        "2. Use markdown tables (| Column | Column |) for statistics, comparisons, and structured data. "
                                        "3. Do NOT include 'Evidence:' markers, 'Safety Advisory' footers, or raw search metadata. "
                                        "4. Use clear headings (## / ###), bullet points, and professional formatting. "
                                        "5. Add a 'References' section at the end with clean source titles and URLs. "
                                        "6. The document should read like a polished medical report. "
                                        "Output ONLY the document content in markdown, nothing else."
                                    )
                                },
                                {
                                    "role": "user",
                                    "content": f"Create a professional medical document about: {user_query}\n\nRaw research data:\n\n{raw_data}"
                                }
                            ]
                            try:
                                synth_resp = await self.client.chat.completions.create(
                                    model=current_model,
                                    messages=synthesis_messages,
                                    temperature=0.3,
                                    max_tokens=2500
                                )
                                fallback_content = synth_resp.choices[0].message.content or raw_data
                            except Exception as synth_err:
                                logger.warning(f"[LLM] Content synthesis failed, using cleaned raw data: {synth_err}")
                                fallback_content = raw_data

                            try:
                                file_record = file_service.create_file(
                                    user_id=user_id,
                                    title=fallback_title,
                                    file_type="md",
                                    content=fallback_content
                                )
                                accumulated_sources.append({
                                    "id": f"file-{file_record['id']}",
                                    "file_id": file_record["id"],
                                    "title": fallback_title,
                                    "type": "file",
                                    "file_type": "md"
                                })
                                executed_tool_calls.append({"name": "create_file", "args": {"title": fallback_title}})
                            except Exception as fallback_err:
                                logger.error(f"[LLM] Fallback file creation failed: {fallback_err}")

                        synth = "The file has been successfully created with the web search results. Now, output ONLY a very brief acknowledgement (1-2 sentences) confirming the file was created. Do NOT repeat, summarize, or display the web search content, tables, or document body in chat."
                    else:
                        synth = (
                            "All requested tool search results have been retrieved and provided above. "
                            "Now formulate your complete, structured clinical consultation response citing "
                            "the retrieved sources ([1], [2]) with clear tables and bullet points."
                        )
                    working_messages.append({
                        "role": "system",
                        "content": synth
                    })
                    final_response = await current_client.chat.completions.create(
                        model=current_model,
                        messages=working_messages,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    content = clean_tool_markup(final_response.choices[0].message.content or "")
                    return {
                        "answer": content.strip(),
                        "sources": accumulated_sources,
                        "tool_calls": executed_tool_calls
                    }

                else:
                    # Direct generation without tools
                    response = await current_client.chat.completions.create(
                        model=current_model,
                        messages=working_messages,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    content = clean_tool_markup(response.choices[0].message.content or "")
                    return {
                        "answer": content.strip(),
                        "sources": [],
                        "tool_calls": []
                    }

            except Exception as e:
                last_error = e
                logger.warning(f"Model {current_model} failed with error: {e}. Trying fallback if available...")

        error_message = "I apologize, but I am currently experiencing connection difficulties with our AI inference provider. Please try again in a moment."
        if last_error:
            err_text = str(last_error).lower()
            if "429" in str(last_error) or "rate limit" in err_text or "quota" in err_text or "free-models-per-day" in err_text:
                error_message = (
                    "**API Rate / Quota Limit Reached (429):** The inference provider reported a rate or quota limit.\n\n"
                    "Please wait a few moments or switch to another model using the model selector."
                )
            elif "401" in str(last_error) or "unauthorized" in err_text or "invalid api key" in err_text:
                error_message = "**Invalid API Key (401):** The API key provided was rejected. Please verify your credentials in `backend/.env`."

        return {
            "answer": error_message,
            "sources": [],
            "tool_calls": []
        }

    async def generate_chat_stream(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        user_query: str = "",
        user_id: str = "user_default",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Yields structured streaming events from OpenRouter or Gemini with MCP tool execution and fallback support.
        
        Yielded event schema:
            - {"type": "tool_call", "name": str, "arguments": dict}
            - {"type": "tool_result", "name": str, "sources": list, "count": int}
            - {"type": "delta", "content": str}
            - {"type": "done", "sources": list}
        """
        attempts = self.get_execution_plan(model)
        if not attempts:
            yield {
                "type": "delta",
                "content": (
                    "**Notice:** Neither Gemini API key nor OpenRouter API key is configured in backend `.env`. "
                    "Please add `GEMINI_API_KEY` or `OPENROUTER_API_KEY` to enable real-time healthcare AI responses."
                )
            }
            return

        last_error = None
        for current_client, current_model, is_gem in attempts:
            try:
                logger.info(f"Streaming from chat model: {current_model} (gemini={is_gem}, tools={'enabled' if tools else 'none'})")
                working_messages = list(messages)
                accumulated_sources = []

                if tools:
                    # Check for tool calls first
                    initial_resp = await current_client.chat.completions.create(
                        model=current_model,
                        messages=working_messages,
                        tools=tools,
                        tool_choice="auto",
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    choice = initial_resp.choices[0]
                    message = choice.message

                    has_tool_calls = False

                    # Case A: Native tool calls
                    if getattr(message, "tool_calls", None) and len(message.tool_calls) > 0:
                        has_tool_calls = True
                        logger.info(f"[LLM Stream] Model {current_model} triggered {len(message.tool_calls)} native MCP tool call(s).")
                        working_messages.append(message)

                        for tc in message.tool_calls:
                            func_name = tc.function.name
                            try:
                                func_args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                            except Exception:
                                func_args = {"query": tc.function.arguments}

                            func_args["user_id"] = user_id

                            yield {
                                "type": "tool_call",
                                "name": func_name,
                                "arguments": func_args
                            }

                            tool_res = await mcp_service.execute_tool(func_name, func_args)
                            if tool_res.sources:
                                accumulated_sources.extend(tool_res.sources)

                            yield {
                                "type": "tool_result",
                                "name": func_name,
                                "sources": tool_res.sources,
                                "count": len(tool_res.sources)
                            }

                            working_messages.append({
                                "role": "tool",
                                "tool_call_id": tc.id,
                                "name": func_name,
                                "content": tool_res.content
                            })

                    # Case B: Text-based XML tool calls fallback
                    else:
                        text_calls = parse_text_tool_calls(message.content or "", default_query=user_query)
                        if text_calls:
                            has_tool_calls = True
                            logger.info(f"[LLM Stream] Model {current_model} emitted {len(text_calls)} text XML tool call(s).")
                            for tc in text_calls:
                                func_name = tc["name"]
                                func_args = tc["args"]
                                func_args["user_id"] = user_id

                                yield {
                                    "type": "tool_call",
                                    "name": func_name,
                                    "arguments": func_args
                                }

                                tool_res = await mcp_service.execute_tool(func_name, func_args)
                                if tool_res.sources:
                                    accumulated_sources.extend(tool_res.sources)

                                yield {
                                    "type": "tool_result",
                                    "name": func_name,
                                    "sources": tool_res.sources,
                                    "count": len(tool_res.sources)
                                }

                                working_messages.append({
                                    "role": "system",
                                    "content": f"[Tool Result for '{func_name}']:\n{tool_res.content}"
                                })

                    if has_tool_calls:
                        # Track which tools already ran
                        executed_names = set()
                        if 'text_calls' in locals() and text_calls:
                            executed_names = {tc["name"] for tc in text_calls}
                        elif getattr(message, "tool_calls", None):
                            executed_names = {tc.function.name for tc in message.tool_calls}

                        has_file_tool = bool(executed_names & {"create_file", "edit_file"})
                        has_search_only = bool(executed_names & {"web_search", "search_medical_guidelines"}) and not has_file_tool
                        user_wants_file = _is_file_request(user_query)

                        if has_file_tool:
                            # File already created — just emit brief acknowledgement
                            synth = "The file has been successfully created. Now, output 2-3 lines summarizing the request and confirming the file creation. DO NOT output the detailed document content or tables."
                            working_messages.append({"role": "system", "content": synth})

                            stream_resp = await self.client.chat.completions.create(
                                model=current_model,
                                messages=working_messages,
                                temperature=temperature,
                                max_tokens=300,
                                stream=True
                            )
                            tag_filter = StreamTagFilter()
                            async for chunk in stream_resp:
                                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                    filtered = tag_filter.process(chunk.choices[0].delta.content)
                                    if filtered:
                                        yield {"type": "delta", "content": filtered}
                            remaining = tag_filter.flush()
                            if remaining:
                                yield {"type": "delta", "content": remaining}

                        elif has_search_only and user_wants_file:
                            # Web search finished but user wanted a FILE — do a second pass with create_file tool
                            logger.info("[LLM Stream] User requested file creation after web search. Invoking create_file in second pass.")

                            # Collect all search content from tool results for fallback file creation
                            _search_content_parts = []
                            for wm in working_messages:
                                if isinstance(wm, dict) and wm.get("role") in ("tool", "system"):
                                    c = wm.get("content", "")
                                    if "SEARCH RESULTS" in c.upper() or "GUIDELINE EVIDENCE" in c.upper() or "Tool Result" in c:
                                        _search_content_parts.append(c)

                            working_messages.append({
                                "role": "system",
                                "content": (
                                    "The web search results above contain the information the user needs. "
                                    "The user wants this information saved as a FILE/DOCUMENT. "
                                    "You MUST now call the `create_file` tool with a descriptive title and CLEAN, PROFESSIONALLY FORMATTED content. "
                                    "CRITICAL CONTENT RULES FOR THE FILE: "
                                    "1. SYNTHESIZE the search results into a polished medical document — do NOT copy-paste raw search output. "
                                    "2. Use markdown tables (| Column | Column |) wherever statistics, comparisons, or structured data are involved. "
                                    "3. Do NOT include raw URLs inline, 'Evidence:' markers, 'Safety Advisory' footers, source citation brackets like [1][2], or search engine metadata. "
                                    "4. Use clear headings (##), bullet points, and professional formatting. "
                                    "5. The document should read like a polished medical report, NOT a search result dump. "
                                    "6. Include source references at the bottom in a clean 'References' section with just the title and URL. "
                                    "Put the SYNTHESIZED content INSIDE the create_file tool call. "
                                    "Do NOT output the content in chat — only a brief 1-2 sentence acknowledgement."
                                )
                            })

                            # Second LLM call WITH tools so it can call create_file
                            file_resp = await self.client.chat.completions.create(
                                model=current_model,
                                messages=working_messages,
                                tools=tools,
                                tool_choice="auto",
                                temperature=temperature,
                                max_tokens=max_tokens
                            )
                            file_choice = file_resp.choices[0]
                            file_message = file_choice.message

                            file_created = False

                            # Handle native tool calls from second pass
                            if getattr(file_message, "tool_calls", None) and len(file_message.tool_calls) > 0:
                                working_messages.append(file_message)
                                for tc in file_message.tool_calls:
                                    func_name = tc.function.name
                                    try:
                                        func_args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                                    except Exception:
                                        func_args = {}
                                    func_args["user_id"] = user_id

                                    yield {"type": "tool_call", "name": func_name, "arguments": func_args}
                                    tool_res = await mcp_service.execute_tool(func_name, func_args)
                                    if tool_res.sources:
                                        accumulated_sources.extend(tool_res.sources)
                                    yield {"type": "tool_result", "name": func_name, "sources": tool_res.sources, "count": len(tool_res.sources)}

                                    working_messages.append({
                                        "role": "tool",
                                        "tool_call_id": tc.id,
                                        "name": func_name,
                                        "content": tool_res.content
                                    })
                                    if func_name in ("create_file", "edit_file"):
                                        file_created = True
                            else:
                                # Text-based fallback for second pass
                                second_text_calls = parse_text_tool_calls(file_message.content or "", default_query=user_query)
                                for tc in second_text_calls:
                                    func_name = tc["name"]
                                    func_args = tc["args"]
                                    func_args["user_id"] = user_id
                                    yield {"type": "tool_call", "name": func_name, "arguments": func_args}
                                    tool_res = await mcp_service.execute_tool(func_name, func_args)
                                    if tool_res.sources:
                                        accumulated_sources.extend(tool_res.sources)
                                    yield {"type": "tool_result", "name": func_name, "sources": tool_res.sources, "count": len(tool_res.sources)}
                                    working_messages.append({
                                        "role": "system",
                                        "content": f"[Tool Result for '{func_name}']:\n{tool_res.content}"
                                    })
                                    if func_name in ("create_file", "edit_file"):
                                        file_created = True

                            # FALLBACK: If LLM failed to call create_file, synthesize and create the file directly
                            if not file_created and _search_content_parts:
                                logger.info("[LLM Stream] LLM did not call create_file in second pass. Synthesizing content and creating file directly.")
                                fallback_title = user_query[:80].strip() or "Web Search Report"
                                # Use LLM to synthesize raw search results into clean document content
                                raw_data = "\n\n".join(_search_content_parts)
                                synthesis_messages = [
                                    {
                                        "role": "system",
                                        "content": (
                                            "You are a professional medical document writer. Transform the raw web search results below "
                                            "into a clean, well-structured markdown document. RULES: "
                                            "1. Synthesize and organize the information — do NOT copy-paste raw search output. "
                                            "2. Use markdown tables (| Column | Column |) for statistics, comparisons, and structured data. "
                                            "3. Do NOT include 'Evidence:' markers, 'Safety Advisory' footers, or raw search metadata. "
                                            "4. Use clear headings (## / ###), bullet points, and professional formatting. "
                                            "5. Add a 'References' section at the end with clean source titles and URLs. "
                                            "6. The document should read like a polished medical report. "
                                            "Output ONLY the document content in markdown, nothing else."
                                        )
                                    },
                                    {
                                        "role": "user",
                                        "content": f"Create a professional medical document about: {user_query}\n\nRaw research data:\n\n{raw_data}"
                                    }
                                ]
                                try:
                                    synth_resp = await self.client.chat.completions.create(
                                        model=current_model,
                                        messages=synthesis_messages,
                                        temperature=0.3,
                                        max_tokens=2500
                                    )
                                    fallback_content = synth_resp.choices[0].message.content or raw_data
                                except Exception as synth_err:
                                    logger.warning(f"[LLM Stream] Content synthesis failed, using cleaned raw data: {synth_err}")
                                    fallback_content = raw_data

                                try:
                                    file_record = file_service.create_file(
                                        user_id=user_id,
                                        title=fallback_title,
                                        file_type="md",
                                        content=fallback_content
                                    )
                                    file_sources = [{
                                        "id": f"file-{file_record['id']}",
                                        "file_id": file_record["id"],
                                        "title": fallback_title,
                                        "type": "file",
                                        "file_type": "md"
                                    }]
                                    accumulated_sources.extend(file_sources)
                                    yield {"type": "tool_call", "name": "create_file", "arguments": {"title": fallback_title}}
                                    yield {"type": "tool_result", "name": "create_file", "sources": file_sources, "count": 1}
                                    file_created = True
                                except Exception as fallback_err:
                                    logger.error(f"[LLM Stream] Fallback file creation failed: {fallback_err}")

                            # Brief acknowledgement after file creation
                            if file_created:
                                synth = "The file has been successfully created with the web search results. Now, output ONLY 1-2 sentences confirming the file was created. Do NOT repeat, summarize, or display the web search content, tables, or document body in chat."
                            else:
                                synth = "Provide a brief response to the user about their request."
                            working_messages.append({"role": "system", "content": synth})

                            stream_resp = await self.client.chat.completions.create(
                                model=current_model,
                                messages=working_messages,
                                temperature=temperature,
                                max_tokens=300,
                                stream=True
                            )
                            tag_filter = StreamTagFilter()
                            async for chunk in stream_resp:
                                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                    filtered = tag_filter.process(chunk.choices[0].delta.content)
                                    if filtered:
                                        yield {"type": "delta", "content": filtered}
                            remaining = tag_filter.flush()
                            if remaining:
                                yield {"type": "delta", "content": remaining}

                        else:
                            # Normal search synthesis (no file creation needed)
                            synth = (
                                "All requested tool search results have been retrieved and provided above. "
                                "Now formulate your complete, structured clinical consultation response citing "
                                "the retrieved sources ([1], [2]) with clear tables and bullet points."
                            )
                            working_messages.append({"role": "system", "content": synth})

                            stream_resp = await current_client.chat.completions.create(
                                model=current_model,
                                messages=working_messages,
                                temperature=temperature,
                                max_tokens=max_tokens,
                                stream=True
                            )
                            tag_filter = StreamTagFilter()
                            try:
                                async for chunk in stream_resp:
                                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                        filtered = tag_filter.process(chunk.choices[0].delta.content)
                                        if filtered:
                                            yield {"type": "delta", "content": filtered}
                            finally:
                                if hasattr(stream_resp, "close"):
                                    await stream_resp.close()

                            remaining = tag_filter.flush()
                            if remaining:
                                yield {"type": "delta", "content": remaining}

                        yield {
                            "type": "done",
                            "sources": accumulated_sources
                        }
                        return
                    else:
                        # No tool calls made; if content was returned in initial response
                        cleaned_content = clean_tool_markup(message.content or "")

                        # INTERCEPTION: If user wanted a file, redirect content into a file
                        if cleaned_content.strip() and _is_file_request(user_query):
                            logger.info("[LLM Stream] No tool calls but user wants a file. Redirecting content to file creation.")
                            fallback_title = user_query[:80].strip() or "Document"

                            # If the initial response was truncated or too short, do a fresh generation with higher max_tokens
                            if len(cleaned_content.strip()) < 300:
                                logger.info("[LLM Stream] Initial content too short, regenerating with higher max_tokens for file.")
                                file_gen_messages = list(working_messages)
                                file_gen_messages.append({
                                    "role": "system",
                                    "content": (
                                        "Generate a comprehensive, detailed, professional markdown document for the user's request. "
                                        "Use markdown tables where applicable. Include all relevant details. "
                                        "Output ONLY the document content, nothing else."
                                    )
                                })
                                try:
                                    file_gen_resp = await self.client.chat.completions.create(
                                        model=current_model,
                                        messages=file_gen_messages,
                                        temperature=temperature,
                                        max_tokens=3000
                                    )
                                    cleaned_content = file_gen_resp.choices[0].message.content or cleaned_content
                                except Exception:
                                    pass  # Use the original content

                            try:
                                file_record = file_service.create_file(
                                    user_id=user_id,
                                    title=fallback_title,
                                    file_type="md",
                                    content=cleaned_content.strip()
                                )
                                file_sources = [{
                                    "id": f"file-{file_record['id']}",
                                    "file_id": file_record["id"],
                                    "title": fallback_title,
                                    "type": "file",
                                    "file_type": "md"
                                }]
                                accumulated_sources.extend(file_sources)
                                yield {"type": "tool_call", "name": "create_file", "arguments": {"title": fallback_title}}
                                yield {"type": "tool_result", "name": "create_file", "sources": file_sources, "count": 1}
                                # Only yield brief acknowledgement, NOT the full content
                                yield {
                                    "type": "delta",
                                    "content": f"I have created a comprehensive document titled **{fallback_title}** for you. You can view and download it from the Files panel."
                                }
                                yield {"type": "done", "sources": accumulated_sources}
                                return
                            except Exception as file_err:
                                logger.error(f"[LLM Stream] Direct file creation failed: {file_err}")

                        if cleaned_content:
                            yield {
                                "type": "delta",
                                "content": cleaned_content
                            }
                            yield {
                                "type": "done",
                                "sources": []
                            }
                            return

                # Direct stream when tools are not used or initial content was empty
                # Check if user wants a file — if so, generate content and redirect to file
                if _is_file_request(user_query):
                    logger.info("[LLM Stream] Direct stream path — user wants a file. Generating content for file.")
                    file_gen_messages = list(working_messages)
                    file_gen_messages.append({
                        "role": "system",
                        "content": (
                            "Generate a comprehensive, detailed, professional markdown document for the user's request. "
                            "Use markdown tables where applicable. Include all relevant details, structured with clear headings and bullet points. "
                            "Output ONLY the document content in markdown, nothing else."
                        )
                    })
                    try:
                        file_gen_resp = await current_client.chat.completions.create(
                            model=current_model,
                            messages=file_gen_messages,
                            temperature=temperature,
                            max_tokens=3000
                        )
                        file_content = file_gen_resp.choices[0].message.content or ""
                        if file_content.strip():
                            fallback_title = user_query[:80].strip() or "Document"
                            file_record = file_service.create_file(
                                user_id=user_id,
                                title=fallback_title,
                                file_type="md",
                                content=file_content.strip()
                            )
                            file_sources = [{
                                "id": f"file-{file_record['id']}",
                                "file_id": file_record["id"],
                                "title": fallback_title,
                                "type": "file",
                                "file_type": "md"
                            }]
                            accumulated_sources.extend(file_sources)
                            yield {"type": "tool_call", "name": "create_file", "arguments": {"title": fallback_title}}
                            yield {"type": "tool_result", "name": "create_file", "sources": file_sources, "count": 1}
                            yield {
                                "type": "delta",
                                "content": f"I have created a comprehensive document titled **{fallback_title}** for you. You can view and download it from the Files panel."
                            }
                            yield {"type": "done", "sources": accumulated_sources}
                            return
                    except Exception as file_err:
                        logger.warning(f"[LLM Stream] Direct file creation path failed: {file_err}. Falling back to normal stream.")

                stream_resp = await current_client.chat.completions.create(
                    model=current_model,
                    messages=working_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )
                tag_filter = StreamTagFilter()
                try:
                    async for chunk in stream_resp:
                        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                            filtered = tag_filter.process(chunk.choices[0].delta.content)
                            if filtered:
                                yield {
                                    "type": "delta",
                                    "content": filtered
                                }
                finally:
                    if hasattr(stream_resp, "close"):
                        await stream_resp.close()

                remaining = tag_filter.flush()
                if remaining:
                    yield {
                        "type": "delta",
                        "content": remaining
                    }
                yield {
                    "type": "done",
                    "sources": accumulated_sources
                }
                return

            except Exception as e:
                last_error = e
                logger.warning(f"Streaming with model {current_model} failed: {e}. Trying fallback if available...")

        error_message = "I apologize, but I am currently experiencing connection difficulties with our AI inference provider. Please try again in a moment."
        if last_error:
            err_text = str(last_error).lower()
            if "429" in str(last_error) or "rate limit" in err_text or "quota" in err_text or "free-models-per-day" in err_text:
                error_message = (
                    "**API Rate / Quota Limit Reached (429):** The inference provider reported a rate or quota limit.\n\n"
                    "Please wait a few moments or switch to another model using the model selector."
                )
            elif "401" in str(last_error) or "unauthorized" in err_text or "invalid api key" in err_text:
                error_message = "**Invalid API Key (401):** The API key provided was rejected. Please verify your credentials in `backend/.env`."

        yield {
            "type": "delta",
            "content": error_message
        }

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        question: str = "Please inspect and describe the visible details in this healthcare image.",
        model: Optional[str] = None,
    ) -> str:
        """Performs visual analysis on medical images or lab sheets using vision LLMs."""
        if not self.api_key and not self.gemini_key:
            return (
                "**Notice:** Neither Gemini API key nor OpenRouter API key is configured in backend `.env`. "
                "Please configure an API key to enable vision analysis."
            )

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_image}"

        messages = [
            {"role": "system", "content": VISION_ANALYSIS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question or "Please analyze this image."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]

        def _extract_response_text(resp) -> Optional[str]:
            """Safely extracts text or refusal message from chat completion response."""
            if not resp or not getattr(resp, "choices", None):
                return None
            for choice in resp.choices:
                msg = getattr(choice, "message", None)
                if not msg:
                    continue
                content = getattr(msg, "content", None)
                if content and str(content).strip():
                    return str(content).strip()
                refusal = getattr(msg, "refusal", None)
                if refusal and str(refusal).strip():
                    return str(refusal).strip()
            return None

        # Check if user explicitly requested a specific vision-capable model
        target_model = self.resolve_model(model) if model else None

        # Attempt requested model first if provided
        if target_model:
            if self.is_gemini_model(target_model) and self.gemini_client:
                try:
                    logger.info(f"Querying requested Gemini vision model: {target_model}")
                    response = await self.gemini_client.chat.completions.create(
                        model=target_model,
                        messages=messages,
                        max_tokens=1500
                    )
                    text = _extract_response_text(response)
                    if text:
                        return text
                except Exception as req_err:
                    logger.warning(f"Requested Gemini vision model {target_model} failed: {req_err}. Falling back to default pipeline...")
            elif self.api_key and self.client and not self.is_gemini_model(target_model):
                try:
                    logger.info(f"Querying requested OpenRouter vision model: {target_model}")
                    response = await self.client.chat.completions.create(
                        model=target_model,
                        messages=messages,
                        max_tokens=1500
                    )
                    text = _extract_response_text(response)
                    if text:
                        return text
                except Exception as req_err:
                    logger.warning(f"Requested OpenRouter vision model {target_model} failed: {req_err}. Falling back to default pipeline...")

        # 1. Gemini Vision Pipeline (fast and high fidelity, with automatic quota/rate-limit fallbacks)
        if self.gemini_client:
            gemini_candidates = []
            seen_gemini = set()
            for m in [
                target_model if (target_model and self.is_gemini_model(target_model)) else None,
                self.gemini_primary,
                "gemini-3.1-flash-lite",
                self.gemini_fallback,
                "gemini-flash-latest",
            ]:
                if m and m not in seen_gemini:
                    seen_gemini.add(m)
                    gemini_candidates.append(m)

            for gemini_vision_model in gemini_candidates:
                try:
                    logger.info(f"Querying Gemini vision model: {gemini_vision_model}")
                    response = await self.gemini_client.chat.completions.create(
                        model=gemini_vision_model,
                        messages=messages,
                        max_tokens=1500
                    )
                    text = _extract_response_text(response)
                    if text:
                        return text
                except Exception as g_err:
                    logger.warning(f"Gemini vision model {gemini_vision_model} failed: {g_err}")

        # 2. Fall back to OpenRouter vision models (tested vision-capable free models)
        if self.api_key and self.client:
            ling_vl = getattr(settings, "LING_3_0_FLASH_VL_MODEL", "inclusionai/ling-3.0-flash-vl:free")
            openrouter_candidates = []
            seen_or = set()
            for m in [
                target_model if (target_model and not self.is_gemini_model(target_model)) else None,
                ling_vl,
                self.vision_model if self.vision_model and self.vision_model != "google/gemma-4-31b-it:free" else None,
                "inclusionai/ling-3.0-flash-vl:free",
            ]:
                if m and m not in seen_or:
                    seen_or.add(m)
                    openrouter_candidates.append(m)

            for f_model in openrouter_candidates:
                try:
                    logger.info(f"Attempting OpenRouter vision model: {f_model}")
                    response = await self.client.chat.completions.create(
                        model=f_model,
                        messages=messages,
                        max_tokens=1500
                    )
                    text = _extract_response_text(response)
                    if text:
                        return text
                except Exception as fb_err:
                    logger.warning(f"OpenRouter vision model {f_model} failed: {fb_err}")

        return (
            "Unable to analyze the image at this moment due to provider rate limits or temporary processing constraints. "
            "Please ensure the image is clear and try again shortly, or select a different model."
        )


# Singleton instance
llm_service = LLMService()
