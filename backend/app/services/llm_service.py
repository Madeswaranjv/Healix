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

logger = logging.getLogger("healix.llm")


def parse_text_tool_calls(text: str, default_query: str = "") -> List[Dict[str, Any]]:
    """Detects text/XML tool calls (e.g. <toolcall>, <dotsfunctioncall>, <tool_call>) emitted by models."""
    calls = []
    if not text:
        return calls

    lower = text.lower()
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
    cleaned = re.sub(r"\n\s*\n\s*\n", "\n\n", cleaned)
    return cleaned.strip()


class StreamTagFilter:
    """Filters out XML/tool-calling markup from streaming tokens in real time."""
    TAG_REGEX = re.compile(
        r"</?(?:dotsfunctioncall|toolcall|tool_call|invoke|argkey|argvalue|arg_key|arg_value|searchmedicalguidelines|searchmedical_guidelines|websearch|web_search)[^>]*>",
        re.IGNORECASE
    )

    def __init__(self):
        self.buffer = ""

    def process(self, chunk: str) -> str:
        self.buffer += chunk
        out = []

        while self.buffer:
            if "<" in self.buffer:
                idx = self.buffer.find("<")
                if idx > 0:
                    out.append(self.buffer[:idx])
                    self.buffer = self.buffer[idx:]

                close_idx = self.buffer.find(">")
                if close_idx != -1:
                    tag = self.buffer[:close_idx + 1]
                    self.buffer = self.buffer[close_idx + 1:]
                    if not self.TAG_REGEX.match(tag):
                        out.append(tag)
                else:
                    if len(self.buffer) > 60:
                        out.append(self.buffer[0])
                        self.buffer = self.buffer[1:]
                    break
            else:
                out.append(self.buffer)
                self.buffer = ""
                break

        return "".join(out)

    def flush(self) -> str:
        res = self.buffer
        self.buffer = ""
        return self.TAG_REGEX.sub("", res)


class LLMService:
    """Handles communication with OpenRouter's OpenAI-compatible API, supporting MCP tool calling."""

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.primary_model = settings.OPENROUTER_CHAT_MODEL
        self.fallback_model = settings.OPENROUTER_CHAT_MODEL_FALLBACK
        self.vision_model = settings.OPENROUTER_VISION_MODEL
        
        self.client = AsyncOpenAI(
            api_key=self.api_key or "sk-dummy-key",
            base_url=self.base_url,
            default_headers={
                "HTTP-Referer": "https://healix.app",
                "X-Title": "Healix Healthcare Chatbot",
            }
        )

    # Friendly name to OpenRouter model mapping (Verified Active & Operational)
    MODEL_MAP = {
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
    }

    def resolve_model(self, model_name: Optional[str]) -> str:
        """Resolves a model name or ID to an OpenRouter model ID."""
        if not model_name:
            return self.primary_model
        if model_name in self.MODEL_MAP:
            return self.MODEL_MAP[model_name]
        if "/" in model_name:
            return model_name
        return self.primary_model

    async def generate_chat_response(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        user_query: str = "",
    ) -> Dict[str, Any]:
        """Generates a chat completion with MCP tool-calling loop and model fallbacks.
        
        Returns:
            Dict containing 'answer' (str), 'sources' (list of dicts), and 'tool_calls' (list).
        """
        if not self.api_key:
            return {
                "answer": (
                    "**Notice:** OpenRouter API key is not configured in backend `.env`. "
                    "Please add `OPENROUTER_API_KEY` to enable real-time healthcare AI responses."
                ),
                "sources": [],
                "tool_calls": []
            }

        target_model = self.resolve_model(model)
        models_to_try = [target_model]
        if target_model != self.fallback_model:
            models_to_try.append(self.fallback_model)

        for current_model in models_to_try:
            try:
                logger.info(f"Querying chat model: {current_model} (tools={'enabled' if tools else 'none'})")
                working_messages = list(messages)
                accumulated_sources = []
                executed_tool_calls = []

                if tools:
                    # Multi-turn tool execution loop (up to 2 turns of tools)
                    for turn in range(2):
                        response = await self.client.chat.completions.create(
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

                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                
                                # Execute MCP tool
                                tool_result = await mcp_service.execute_tool(func_name, func_args)
                                if tool_result.sources:
                                    accumulated_sources.extend(tool_result.sources)

                                working_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.id,
                                    "name": func_name,
                                    "content": tool_result.content
                                })

                        # Fallback check for text/XML tool calls emitted in message.content
                        elif turn == 0 and parse_text_tool_calls(message.content or "", default_query=user_query):
                            text_calls = parse_text_tool_calls(message.content or "", default_query=user_query)
                            logger.info(f"[LLM Tool Turn {turn+1}] Model {current_model} emitted {len(text_calls)} text XML tool call(s).")
                            for tc in text_calls:
                                func_name = tc["name"]
                                func_args = tc["args"]
                                executed_tool_calls.append({"name": func_name, "args": func_args})
                                tool_result = await mcp_service.execute_tool(func_name, func_args)
                                if tool_result.sources:
                                    accumulated_sources.extend(tool_result.sources)
                                working_messages.append({
                                    "role": "system",
                                    "content": f"[Tool Result for '{func_name}']:\n{tool_result.content}"
                                })

                        else:
                            # Final answer reached directly
                            content = clean_tool_markup(message.content or "")
                            return {
                                "answer": content.strip(),
                                "sources": accumulated_sources,
                                "tool_calls": executed_tool_calls
                            }

                    # Final generation pass after tools
                    working_messages.append({
                        "role": "system",
                        "content": (
                            "All requested tool search results have been retrieved and provided above. "
                            "Now formulate your complete, structured clinical consultation response citing "
                            "the retrieved sources ([1], [2]) with clear tables and bullet points."
                        )
                    })
                    final_response = await self.client.chat.completions.create(
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
                    response = await self.client.chat.completions.create(
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
                logger.warning(f"Model {current_model} failed with error: {e}. Trying fallback if available...")

        return {
            "answer": "I apologize, but I am currently experiencing connection difficulties with our AI inference provider. Please try again in a moment.",
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
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Yields structured streaming events from OpenRouter with MCP tool execution and fallback support.
        
        Yielded event schema:
            - {"type": "tool_call", "name": str, "arguments": dict}
            - {"type": "tool_result", "name": str, "sources": list, "count": int}
            - {"type": "delta", "content": str}
            - {"type": "done", "sources": list}
        """
        if not self.api_key:
            yield {
                "type": "delta",
                "content": (
                    "**Notice:** OpenRouter API key is not configured in backend `.env`. "
                    "Please add `OPENROUTER_API_KEY` to enable real-time healthcare AI responses."
                )
            }
            return

        target_model = self.resolve_model(model)
        models_to_try = [target_model]
        if target_model != self.fallback_model:
            models_to_try.append(self.fallback_model)

        for current_model in models_to_try:
            try:
                logger.info(f"Streaming from chat model: {current_model} (tools={'enabled' if tools else 'none'})")
                working_messages = list(messages)
                accumulated_sources = []

                if tools:
                    # Check for tool calls first
                    initial_resp = await self.client.chat.completions.create(
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
                        # Synthesis prompt instruction for final response
                        working_messages.append({
                            "role": "system",
                            "content": (
                                "All requested tool search results have been retrieved and provided above. "
                                "Now formulate your complete, structured clinical consultation response citing "
                                "the retrieved sources ([1], [2]) with clear tables and bullet points."
                            )
                        })

                        # Stream synthesized response after tool execution
                        stream_resp = await self.client.chat.completions.create(
                            model=current_model,
                            messages=working_messages,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            stream=True
                        )
                        tag_filter = StreamTagFilter()
                        async for chunk in stream_resp:
                            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                text_chunk = chunk.choices[0].delta.content
                                filtered = tag_filter.process(text_chunk)
                                if filtered:
                                    yield {
                                        "type": "delta",
                                        "content": filtered
                                    }
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
                    else:
                        # No tool calls made; if content was returned in initial response, yield it directly
                        cleaned_content = clean_tool_markup(message.content or "")
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
                stream_resp = await self.client.chat.completions.create(
                    model=current_model,
                    messages=working_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )
                tag_filter = StreamTagFilter()
                async for chunk in stream_resp:
                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        filtered = tag_filter.process(chunk.choices[0].delta.content)
                        if filtered:
                            yield {
                                "type": "delta",
                                "content": filtered
                            }
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
                logger.warning(f"Streaming with model {current_model} failed: {e}. Trying fallback if available...")

        yield {
            "type": "delta",
            "content": "I apologize, but I am currently experiencing connection difficulties with our AI inference provider. Please try again in a moment."
        }

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        question: str = "Please inspect and describe the visible details in this healthcare image."
    ) -> str:
        """Performs visual analysis on medical images or lab sheets using vision LLMs."""
        if not self.api_key:
            return (
                "**Notice:** OpenRouter API key is not configured in backend `.env`. "
                "Please add `OPENROUTER_API_KEY` to enable vision analysis."
            )

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_image}"

        messages = [
            {"role": "system", "content": VISION_ANALYSIS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question or "Please analyze this healthcare image."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]

        # Try vision model
        try:
            logger.info(f"Querying vision model: {self.vision_model}")
            response = await self.client.chat.completions.create(
                model=self.vision_model,
                messages=messages,
                max_tokens=1200
            )
            if response.choices and response.choices[0].message.content:
                return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Vision model {self.vision_model} failed ({e}). Attempting fallback vision models...")
            
            fallback_vision_models = ["google/gemma-4-31b-it:free", "inclusionai/ling-3.0-flash-fin:free"]
            for f_model in fallback_vision_models:
                try:
                    logger.info(f"Attempting fallback vision model: {f_model}")
                    response = await self.client.chat.completions.create(
                        model=f_model,
                        messages=messages,
                        max_tokens=1200
                    )
                    if response.choices and response.choices[0].message.content:
                        return response.choices[0].message.content.strip()
                except Exception as fb_err:
                    logger.warning(f"Fallback vision model {f_model} failed: {fb_err}")

        return (
            "Unable to analyze the image at this moment due to provider rate limits or image processing constraints. "
            "Please ensure the image is clear and try again."
        )


# Singleton instance
llm_service = LLMService()
