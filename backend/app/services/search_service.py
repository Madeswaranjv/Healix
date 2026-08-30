"""Web search service using Tavily API with graceful fallbacks."""
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class SearchService:
    """Provides medical/health web search capabilities."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.TAVILY_API_KEY
        self.client = None
        if self.api_key:
            try:
                from tavily import TavilyClient
                self.client = TavilyClient(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize TavilyClient: {e}")

    async def search(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        """Executes a search query and returns structured results."""
        if not self.client:
            logger.info("Tavily API key not configured. Web search skipped.")
            return []

        try:
            # Tavily synchronous call in async wrapper
            import asyncio
            response = await asyncio.to_thread(
                self.client.search,
                query=f"{query} health medical",
                search_depth="basic",
                max_results=max_results
            )
            
            results = []
            if response and "results" in response:
                for item in response["results"]:
                    results.append({
                        "title": item.get("title", "Web Reference"),
                        "url": item.get("url", "#"),
                        "content": item.get("content", ""),
                        "score": item.get("score", 0.0)
                    })
            return results
        except Exception as e:
            logger.error(f"Error during Tavily search: {e}")
            return []

# Singleton instance
search_service = SearchService()
