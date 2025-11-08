"""
Relation Service - Simple market relationship finder using stored embeddings
"""
from typing import List, Optional
from app.services.vector_service import get_vector_service
import logging

logger = logging.getLogger(__name__)


class RelationService:
    """Find relationships between markets using stored embeddings."""
    
    def __init__(self):
        self.vector_service = get_vector_service()
    
    async def find_related_markets(
        self,
        market_id: int,
        limit: int = 10,
        min_similarity: float = 0.7
    ) -> List[tuple]:
        """Find related markets above similarity threshold."""
        try:
            results = await self.vector_service.find_similar_to_market(market_id, limit=limit)
            return [(mid, score) for mid, score in results if score >= min_similarity]
        except Exception as e:
            logger.error(f"Error finding related markets: {e}")
            raise


_relation_service: Optional[RelationService] = None


def get_relation_service() -> RelationService:
    global _relation_service
    if _relation_service is None:
        _relation_service = RelationService()
    return _relation_service
