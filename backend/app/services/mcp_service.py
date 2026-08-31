"""Model Context Protocol (MCP) tool service for Healix Healthcare Chatbot.

Provides standardized MCP tool schemas, tool dispatching, execution, and translation
to OpenAI/OpenRouter-compatible function calling interfaces.
"""
import json
import logging
import time
from typing import List, Dict, Any, Optional, Callable
from pydantic import BaseModel, Field

from app.services.search_service import search_service

logger = logging.getLogger("healix.mcp")


class MCPToolParameter(BaseModel):
    name: str
    type: str = "string"
    description: str
    required: bool = True


class MCPToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]


class MCPToolResult(BaseModel):
    tool_name: str
    success: bool
    content: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    raw_data: Optional[Dict[str, Any]] = None
    execution_time_ms: float = 0.0


class MCPService:
    """Manages Model Context Protocol (MCP) medical tools and execution."""

    def __init__(self):
        self._tools: Dict[str, MCPToolDefinition] = {}
        self._handlers: Dict[str, Callable] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        """Registers default healthcare MCP tools."""
        # 1. General Medical Web Search
        self.register_tool(
            name="web_search",
            description=(
                "Search the live internet for medical literature, health news, drug indications, "
                "clinical trials, treatment options, disease symptoms, or wellness topics. "
                "Use this tool whenever up-to-date or real-world medical information is requested."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Specific, focused medical search query (e.g. 'type 2 diabetes GLP-1 2026 guidelines' or 'hypertension dietary recommendations')."
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Number of high-quality sources to return (default: 3).",
                        "default": 3
                    }
                },
                "required": ["query"]
            },
            handler=self._handle_web_search
        )

        # 2. Clinical Guidelines Search
        self.register_tool(
            name="search_medical_guidelines",
            description=(
                "Search accredited clinical practice guidelines from major health authorities "
                "(CDC, WHO, FDA, NIH, AHA, ADA, NICE, PubMed). Use when clinical protocols, "
                "diagnostic criteria, or official health advisory recommendations are needed."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Medical condition, drug, or clinical procedure topic (e.g., 'pediatric asthma exacerbation management')."
                    },
                    "organization": {
                        "type": "string",
                        "description": "Specific authority filter if relevant (e.g., 'ADA', 'AHA', 'CDC', 'FDA', 'WHO', 'NIH', or 'all').",
                        "default": "all"
                    }
                },
                "required": ["topic"]
            },
            handler=self._handle_clinical_guidelines_search
        )

    def register_tool(
        self,
        name: str,
        description: str,
        input_schema: Dict[str, Any],
        handler: Callable
    ):
        """Registers a new tool into the MCP tool registry."""
        tool_def = MCPToolDefinition(
            name=name,
            description=description,
            input_schema=input_schema
        )
        self._tools[name] = tool_def
        self._handlers[name] = handler
        logger.info(f"[MCP] Registered tool: '{name}'")

    def get_mcp_tools(self) -> List[MCPToolDefinition]:
        """Returns all registered MCP tools in MCP schema format."""
        return list(self._tools.values())

    def get_openai_tools(self) -> List[Dict[str, Any]]:
        """Converts registered MCP tools into OpenAI / OpenRouter function calling format."""
        openai_tools = []
        for name, tool_def in self._tools.items():
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool_def.name,
                    "description": tool_def.description,
                    "parameters": tool_def.input_schema
                }
            })
        return openai_tools

    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> MCPToolResult:
        """Executes a registered MCP tool by name with provided argument dictionary."""
        start_time = time.perf_counter()
        logger.info(f"[MCP Tool Call] Invoking tool '{name}' with arguments: {json.dumps(arguments)}")

        if name not in self._handlers:
            err_msg = f"Tool '{name}' is not registered in the MCP tool registry."
            logger.error(f"[MCP Tool Error] {err_msg}")
            return MCPToolResult(
                tool_name=name,
                success=False,
                content=f"Error: {err_msg}",
                sources=[],
                execution_time_ms=(time.perf_counter() - start_time) * 1000
            )

        handler = self._handlers[name]
        try:
            result = await handler(arguments)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.info(
                f"[MCP Tool Result] Tool '{name}' executed successfully in {elapsed_ms:.1f}ms "
                f"({len(result.sources)} sources retrieved)."
            )
            result.execution_time_ms = elapsed_ms
            return result
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"[MCP Tool Exception] Error executing tool '{name}': {e}", exc_info=True)
            return MCPToolResult(
                tool_name=name,
                success=False,
                content=f"Tool execution failed: {str(e)}",
                sources=[],
                execution_time_ms=elapsed_ms
            )

    async def _handle_web_search(self, args: Dict[str, Any]) -> MCPToolResult:
        """Handler for 'web_search' MCP tool."""
        query = args.get("query", "").strip()
        max_results = int(args.get("max_results", 3))

        if not query:
            return MCPToolResult(
                tool_name="web_search",
                success=False,
                content="Search query cannot be empty.",
                sources=[]
            )

        raw_results = await search_service.search(query=query, max_results=max_results, search_type="general")
        
        if not raw_results:
            return MCPToolResult(
                tool_name="web_search",
                success=True,
                content=f"Web search for '{query}' returned no relevant results.",
                sources=[]
            )

        formatted_lines = []
        sources = []

        for idx, item in enumerate(raw_results):
            source_id = f"web-{idx+1}"
            title = item.get("title", "Medical Web Resource")
            url = item.get("url", "#")
            content = item.get("content", "")
            
            formatted_lines.append(
                f"[{idx+1}] **{title}**\n"
                f"URL: {url}\n"
                f"Evidence: {content}\n"
            )
            
            sources.append({
                "id": source_id,
                "title": title,
                "url": url,
                "type": "web",
                "snippet": content[:180] + ("..." if len(content) > 180 else ""),
                "engine": item.get("engine", "web")
            })

        compiled_content = (
            f"### LIVE WEB SEARCH RESULTS FOR: '{query}'\n\n"
            + "\n---\n".join(formatted_lines)
            + "\n\n*Safety Advisory: Ground your response in the above retrieved facts and cite the URLs/sources.*"
        )

        return MCPToolResult(
            tool_name="web_search",
            success=True,
            content=compiled_content,
            sources=sources,
            raw_data={"query": query, "count": len(raw_results)}
        )

    async def _handle_clinical_guidelines_search(self, args: Dict[str, Any]) -> MCPToolResult:
        """Handler for 'search_medical_guidelines' MCP tool."""
        topic = args.get("topic", "").strip()
        organization = args.get("organization", "all").strip()
        
        if not topic:
            return MCPToolResult(
                tool_name="search_medical_guidelines",
                success=False,
                content="Topic cannot be empty for guidelines search.",
                sources=[]
            )

        enhanced_query = f"{topic} clinical practice guideline consensus {organization if organization != 'all' else ''}".strip()
        raw_results = await search_service.search(query=enhanced_query, max_results=4, search_type="advanced")

        if not raw_results:
            return MCPToolResult(
                tool_name="search_medical_guidelines",
                success=True,
                content=f"No specific clinical guidelines found for '{topic}'.",
                sources=[]
            )

        formatted_lines = []
        sources = []

        for idx, item in enumerate(raw_results):
            source_id = f"guideline-{idx+1}"
            title = item.get("title", "Clinical Practice Guideline")
            url = item.get("url", "#")
            content = item.get("content", "")

            formatted_lines.append(
                f"[{idx+1}] **{title}**\n"
                f"Source URL: {url}\n"
                f"Clinical Summary: {content}\n"
            )

            sources.append({
                "id": source_id,
                "title": f"Guideline: {title}",
                "url": url,
                "type": "web",
                "snippet": content[:180] + ("..." if len(content) > 180 else ""),
                "engine": item.get("engine", "guidelines")
            })

        compiled_content = (
            f"### CLINICAL GUIDELINE EVIDENCE FOR: '{topic}' (Filter: {organization})\n\n"
            + "\n---\n".join(formatted_lines)
        )

        return MCPToolResult(
            tool_name="search_medical_guidelines",
            success=True,
            content=compiled_content,
            sources=sources,
            raw_data={"topic": topic, "organization": organization, "count": len(raw_results)}
        )


# Singleton instance
mcp_service = MCPService()
