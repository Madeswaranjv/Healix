"""Web search service with Tavily API primary and DuckDuckGo (DDGS) fallback for medical queries."""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("healix.search")

class SearchService:
    """Provides resilient medical and health web search capabilities."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.TAVILY_API_KEY
        self.tavily_client = None
        if self.api_key:
            try:
                from tavily import TavilyClient
                self.tavily_client = TavilyClient(api_key=self.api_key)
                logger.info("Initialized Tavily search client.")
            except Exception as e:
                logger.warning(f"Failed to initialize TavilyClient: {e}")

    async def search(self, query: str, max_results: int = 4, search_type: str = "general") -> List[Dict[str, Any]]:
        """Executes a search query using Tavily, falling back to DuckDuckGo if needed.
        
        Returns:
            List of dicts: [{"title": str, "url": str, "content": str, "score": float, "engine": str}]
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        # 1. Try Tavily Search first if configured
        if self.tavily_client:
            try:
                results = await self._search_tavily(clean_query, max_results=max_results, search_type=search_type)
                if results:
                    logger.info(f"[SearchService] Tavily returned {len(results)} results for: '{clean_query}'")
                    return results
            except Exception as e:
                logger.warning(f"[SearchService] Tavily search failed ({e}). Falling back to DuckDuckGo...")

        # 2. Fallback to DuckDuckGo search
        try:
            results = await self._search_duckduckgo(clean_query, max_results=max_results)
            if results:
                logger.info(f"[SearchService] DuckDuckGo fallback returned {len(results)} results for: '{clean_query}'")
                return results
        except Exception as e:
            logger.error(f"[SearchService] DuckDuckGo search failed: {e}")

        logger.warning(f"[SearchService] No web search results retrieved for: '{clean_query}'")
        return []

    async def _search_tavily(self, query: str, max_results: int = 4, search_type: str = "general") -> List[Dict[str, Any]]:
        """Internal Tavily search executor."""
        medical_query = query
        if not any(k in query.lower() for k in ["health", "medical", "clinical", "doctor", "treatment", "disease", "symptom", "fda", "guideline", "guidelines"]):
            medical_query = f"{query} medical health"

        response = await asyncio.to_thread(
            self.tavily_client.search,
            query=medical_query,
            search_depth="basic" if search_type == "general" else "advanced",
            max_results=max_results,
            include_answer=False,
        )

        results = []
        if response and "results" in response:
            for item in response["results"]:
                title = item.get("title", "Medical Web Reference")
                url = item.get("url", "#")
                content = item.get("content", "").strip()
                score = float(item.get("score", 0.0))
                if content:
                    results.append({
                        "title": title,
                        "url": url,
                        "content": content,
                        "score": score,
                        "engine": "tavily"
                    })
        return results

    async def _search_duckduckgo(self, query: str, max_results: int = 4) -> List[Dict[str, Any]]:
        """Internal DuckDuckGo (DDGS) search fallback executor."""
        def _ddg_sync():
            try:
                try:
                    from ddgs import DDGS
                except ImportError:
                    from duckduckgo_search import DDGS

                with DDGS() as ddgs:
                    search_term = query
                    if len(query.split()) < 3:
                        search_term = f"{query} medical healthcare"
                    raw_results = list(ddgs.text(search_term, max_results=max_results))
                    return raw_results
            except Exception as ddg_err:
                logger.error(f"DDGS error: {ddg_err}")
                return []

        raw_results = await asyncio.to_thread(_ddg_sync)
        results = []
        for item in raw_results:
            title = item.get("title", "Medical Reference")
            url = item.get("href") or item.get("link") or "#"
            body = item.get("body") or item.get("snippet") or ""
            if body:
                results.append({
                    "title": title,
                    "url": url,
                    "content": body.strip(),
                    "score": 0.5,
                    "engine": "duckduckgo"
                })
        return results

# Singleton instance
search_service = SearchService()
