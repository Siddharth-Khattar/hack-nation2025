"""
Relation Service - Manages stored market relationships in database
"""
from typing import List, Optional, Tuple
from app.schemas.relation_schema import MarketRelation, MarketRelationCreate
from app.services.database_service import get_database_service
import logging

logger = logging.getLogger(__name__)


class RelationService:
    """Manages stored market relationships in database."""
    
    def __init__(self):
        self.db = get_database_service()
    
    async def get_related_markets(
        self,
        market_id: int,
        limit: int = 10,
        min_similarity: float = 0.7
    ) -> List[Tuple[int, float, float, float]]:
        """
        Get related markets from stored relations.
        
        Args:
            market_id: Source market ID
            limit: Maximum number of results
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of (related_market_id, similarity, correlation, pressure) tuples
        """
        try:
            # Query relations where this market is involved
            response = self.db.client.table('market_relations')\
                .select('*')\
                .or_(f"market_id_1.eq.{market_id},market_id_2.eq.{market_id}")\
                .gte('similarity', min_similarity)\
                .order('similarity', desc=True)\
                .limit(limit)\
                .execute()
            
            results = []
            for relation in response.data:
                # Return the OTHER market ID
                related_id = (
                    relation['market_id_2'] 
                    if relation['market_id_1'] == market_id 
                    else relation['market_id_1']
                )
                results.append((
                    related_id,
                    float(relation['similarity']),
                    float(relation.get('correlation', 0.0)),
                    float(relation.get('pressure', 0.0))
                ))
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting related markets: {e}")
            raise
    
    async def get_relation_between(
        self,
        market_id_1: int,
        market_id_2: int
    ) -> Optional[MarketRelation]:
        """Get relation between two specific markets."""
        try:
            # Ensure market_id_1 < market_id_2 for query
            min_id = min(market_id_1, market_id_2)
            max_id = max(market_id_1, market_id_2)
            
            response = self.db.client.table('market_relations')\
                .select('*')\
                .eq('market_id_1', min_id)\
                .eq('market_id_2', max_id)\
                .execute()
            
            if response.data:
                return MarketRelation(**response.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Error getting relation between markets: {e}")
            raise
    
    async def create_relation(
        self,
        market_id_1: int,
        market_id_2: int,
        similarity: float,
        correlation: float = 0.0,
        pressure: float = 0.0
    ) -> MarketRelation:
        """
        Create or update a relation between two markets.
        
        Args:
            market_id_1: First market ID
            market_id_2: Second market ID
            similarity: Similarity score (0.0-1.0)
            correlation: Correlation score (default: 0.0)
            pressure: Pressure score (default: 0.0)
            
        Returns:
            Created MarketRelation
        """
        try:
            # Ensure market_id_1 < market_id_2
            min_id = min(market_id_1, market_id_2)
            max_id = max(market_id_1, market_id_2)
            
            data = {
                'market_id_1': min_id,
                'market_id_2': max_id,
                'similarity': similarity,
                'correlation': correlation,
                'pressure': pressure
            }
            
            # Upsert: update if exists, insert if not
            response = self.db.client.table('market_relations').upsert(
                data,
                on_conflict='market_id_1,market_id_2'
            ).execute()
            
            if response.data:
                return MarketRelation(**response.data[0])
            raise Exception("Failed to create relation")
            
        except Exception as e:
            logger.error(f"Error creating relation: {e}")
            raise
    
    async def create_relations_batch(
        self,
        relations: List[MarketRelationCreate]
    ) -> dict:
        """
        Create multiple relations in batch.
        
        Args:
            relations: List of relations to create
            
        Returns:
            Dictionary with success/failure counts
        """
        created = 0
        failed = 0
        
        for relation in relations:
            try:
                await self.create_relation(
                    relation.market_id_1,
                    relation.market_id_2,
                    relation.similarity,
                    relation.correlation or 0.0,
                    relation.pressure or 0.0
                )
                created += 1
            except Exception as e:
                failed += 1
                logger.error(f"Failed to create relation: {e}")
        
        return {
            "created": created,
            "failed": failed,
            "total": len(relations)
        }
    
    async def delete_relation(
        self,
        market_id_1: int,
        market_id_2: int
    ) -> bool:
        """Delete a relation between two markets."""
        try:
            min_id = min(market_id_1, market_id_2)
            max_id = max(market_id_1, market_id_2)
            
            response = self.db.client.table('market_relations')\
                .delete()\
                .eq('market_id_1', min_id)\
                .eq('market_id_2', max_id)\
                .execute()
            
            return len(response.data) > 0
            
        except Exception as e:
            logger.error(f"Error deleting relation: {e}")
            raise
    
    async def delete_all_relations_for_market(
        self,
        market_id: int
    ) -> int:
        """Delete all relations involving a specific market."""
        try:
            response = self.db.client.table('market_relations')\
                .delete()\
                .or_(f"market_id_1.eq.{market_id},market_id_2.eq.{market_id}")\
                .execute()
            
            return len(response.data)
            
        except Exception as e:
            logger.error(f"Error deleting relations for market: {e}")
            raise
    
    async def count_relations(
        self,
        market_id: Optional[int] = None
    ) -> int:
        """Count total relations, optionally for a specific market."""
        try:
            query = self.db.client.table('market_relations').select('id', count='exact')
            
            if market_id is not None:
                query = query.or_(f"market_id_1.eq.{market_id},market_id_2.eq.{market_id}")
            
            response = query.execute()
            return response.count if response.count is not None else 0
            
        except Exception as e:
            logger.error(f"Error counting relations: {e}")
            raise


_relation_service: Optional[RelationService] = None


def get_relation_service() -> RelationService:
    """Get or create the relation service singleton."""
    global _relation_service
    if _relation_service is None:
        _relation_service = RelationService()
    return _relation_service
