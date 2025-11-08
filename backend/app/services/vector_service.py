"""
Vector Service - Handles vector embeddings stored in database
"""
from typing import List, Optional, Tuple
from app.schemas.vector_schema import VectorEmbedding, Dataset
from app.core.config import settings
from app.utils.openai_service import get_openai_helper
from app.services.database_service import get_database_service
import logging
import numpy as np

logger = logging.getLogger(__name__)


class VectorService:
    """Service for vector operations using stored embeddings."""
    
    def __init__(self):
        self._openai_helper = None
        self.db_service = get_database_service()
    
    @property
    def openai_helper(self):
        """Lazy initialization of OpenAI helper - only when needed."""
        if self._openai_helper is None:
            self._openai_helper = get_openai_helper()
        return self._openai_helper
    
    # ==================== CREATE & STORE EMBEDDINGS ====================
    
    async def create_and_store_embedding(self, market_id: int) -> VectorEmbedding:
        """Create embedding for a market and store it in database."""
        try:
            # Get market
            market = await self.db_service.get_market_by_id(market_id)
            if not market:
                raise ValueError(f"Market {market_id} not found")
            
            # Create text representation
            text_parts = [f"Question: {market.question}"]
            if market.description:
                text_parts.append(f"Description: {market.description}")
            if market.outcomes:
                text_parts.append(f"Outcomes: {', '.join(market.outcomes)}")
            
            text = " | ".join(text_parts)
            
            # Create embedding
            embedding = await self.openai_helper.create_text_embedding(text)
            
            # Store in database
            return await self.db_service.store_embedding(market_id, embedding)
            
        except Exception as e:
            logger.error(f"Error creating embedding for market {market_id}: {e}")
            raise
    
    async def batch_create_embeddings(self, market_ids: List[int], batch_size: int = 100) -> dict:
        """
        Create embeddings for multiple markets using batch API calls.
        Processes in batches for optimal performance.
        
        Returns:
            Dict with created/failed counts
        """
        created = 0
        failed = 0
        
        # Process in batches
        for i in range(0, len(market_ids), batch_size):
            batch_ids = market_ids[i:i+batch_size]
            
            try:
                # Get all markets in batch
                markets = []
                for mid in batch_ids:
                    market = await self.db_service.get_market_by_id(mid)
                    if market:
                        markets.append(market)
                
                if not markets:
                    continue
                
                # Create text representations
                texts = []
                market_map = {}
                for market in markets:
                    text_parts = [f"Question: {market.question}"]
                    if market.description:
                        text_parts.append(f"Description: {market.description}")
                    if market.outcomes:
                        text_parts.append(f"Outcomes: {', '.join(market.outcomes)}")
                    
                    text = " | ".join(text_parts)
                    texts.append(text)
                    market_map[len(texts) - 1] = market.id
                
                # Batch create embeddings via OpenAI
                embeddings = await self.openai_helper.create_text_embeddings(texts)
                
                # Store all embeddings
                for idx, embedding in enumerate(embeddings):
                    market_id = market_map[idx]
                    try:
                        await self.db_service.store_embedding(market_id, embedding)
                        created += 1
                    except Exception as e:
                        failed += 1
                        logger.error(f"Failed to store embedding for market {market_id}: {e}")
                
            except Exception as e:
                logger.error(f"Batch processing failed for batch {i}-{i+batch_size}: {e}")
                failed += len(batch_ids)
        
        return {"created": created, "failed": failed, "total": len(market_ids)}
    
    # ==================== SIMILARITY SEARCH ====================
    
    async def find_similar_markets(
        self,
        query_embedding: List[float],
        limit: int = 10
    ) -> List[Tuple[int, float]]:
        """
        Find similar markets using stored embeddings.
        Returns list of (market_id, similarity_score).
        """
        try:
            # Get all stored embeddings
            all_embeddings = await self.db_service.get_all_embeddings()
            
            if not all_embeddings:
                return []
            
            # Calculate similarities
            query_array = np.array(query_embedding)
            query_norm = np.linalg.norm(query_array)
            
            similarities = []
            for emb in all_embeddings:
                emb_array = np.array(emb.embedding)
                emb_norm = np.linalg.norm(emb_array)
                
                if emb_norm == 0:
                    continue
                
                # Cosine similarity
                dot_product = np.dot(query_array, emb_array)
                similarity = float(dot_product / (query_norm * emb_norm))
                similarities.append((emb.market_id, similarity))
            
            # Sort and return top results
            similarities.sort(key=lambda x: x[1], reverse=True)
            return similarities[:limit]
            
        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
            raise
    
    async def find_similar_to_market(
        self,
        market_id: int,
        limit: int = 10
    ) -> List[Tuple[int, float]]:
        """Find markets similar to a given market using stored embeddings."""
        try:
            # Get embedding for the market
            embedding = await self.db_service.get_embedding(market_id)
            if not embedding:
                raise ValueError(f"No embedding found for market {market_id}")
            
            # Find similar
            results = await self.find_similar_markets(embedding.embedding, limit=limit + 1)
            
            # Filter out the query market itself
            return [(mid, score) for mid, score in results if mid != market_id][:limit]
            
        except Exception as e:
            logger.error(f"Error finding similar markets: {e}")
            raise
    
    async def find_similar_to_text(
        self,
        query_text: str,
        limit: int = 10
    ) -> List[Tuple[int, float]]:
        """Find markets similar to a text query."""
        try:
            # Create embedding for query
            query_embedding = await self.openai_helper.create_text_embedding(query_text)
            
            # Find similar
            return await self.find_similar_markets(query_embedding, limit=limit)
            
        except Exception as e:
            logger.error(f"Error finding similar markets to text: {e}")
            raise
    
    # ==================== PROXIMITY SEARCH ====================
    
    async def find_markets_in_proximity(
        self,
        query_embedding: List[float],
        threshold: float = 0.7
    ) -> List[Tuple[int, float]]:
        """
        Find all markets within a certain proximity (similarity threshold).
        Returns all markets with similarity >= threshold.
        
        Args:
            query_embedding: Query vector embedding
            threshold: Minimum similarity score (0.0 to 1.0, default: 0.7)
        
        Returns:
            List of (market_id, similarity_score) tuples above threshold
        """
        try:
            # Get all stored embeddings
            all_embeddings = await self.db_service.get_all_embeddings()
            
            if not all_embeddings:
                return []
            
            # Calculate similarities
            query_array = np.array(query_embedding)
            query_norm = np.linalg.norm(query_array)
            
            results = []
            for emb in all_embeddings:
                emb_array = np.array(emb.embedding)
                emb_norm = np.linalg.norm(emb_array)
                
                if emb_norm == 0:
                    continue
                
                # Cosine similarity
                dot_product = np.dot(query_array, emb_array)
                similarity = float(dot_product / (query_norm * emb_norm))
                
                # Only include if above threshold
                if similarity >= threshold:
                    results.append((emb.market_id, similarity))
            
            # Sort by similarity (highest first)
            results.sort(key=lambda x: x[1], reverse=True)
            return results
            
        except Exception as e:
            logger.error(f"Error in proximity search: {e}")
            raise
    
    async def find_markets_in_proximity_to_market(
        self,
        market_id: int,
        threshold: float = 0.7
    ) -> List[Tuple[int, float]]:
        """
        Find all markets within proximity to a given market.
        
        Args:
            market_id: Reference market ID
            threshold: Minimum similarity score (0.0 to 1.0, default: 0.7)
        
        Returns:
            List of (market_id, similarity_score) tuples (excluding the query market)
        """
        try:
            # Get embedding for the market
            embedding = await self.db_service.get_embedding(market_id)
            if not embedding:
                raise ValueError(f"No embedding found for market {market_id}")
            
            # Find all in proximity
            results = await self.find_markets_in_proximity(embedding.embedding, threshold=threshold)
            
            # Filter out the query market itself
            return [(mid, score) for mid, score in results if mid != market_id]
            
        except Exception as e:
            logger.error(f"Error finding markets in proximity: {e}")
            raise
    
    async def find_markets_in_proximity_to_text(
        self,
        query_text: str,
        threshold: float = 0.7
    ) -> List[Tuple[int, float]]:
        """
        Find all markets within proximity to a text query.
        
        Args:
            query_text: Text query
            threshold: Minimum similarity score (0.0 to 1.0, default: 0.7)
        
        Returns:
            List of (market_id, similarity_score) tuples
        """
        try:
            # Create embedding for query
            query_embedding = await self.openai_helper.create_text_embedding(query_text)
            
            # Find all in proximity
            return await self.find_markets_in_proximity(query_embedding, threshold=threshold)
            
        except Exception as e:
            logger.error(f"Error finding markets in proximity to text: {e}")
            raise


# ==================== SINGLETON ====================

_vector_service: Optional[VectorService] = None


def get_vector_service() -> VectorService:
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorService()
    return _vector_service
