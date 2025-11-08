"""
Database Service - Main interface for Supabase database operations
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from supabase import create_client, Client
from app.core.config import settings
from app.schemas.market_schema import Market, MarketCreate, MarketUpdate
from app.schemas.vector_schema import VectorEmbedding
import logging

logger = logging.getLogger(__name__)


class DatabaseService:
    """
    Main database service for interacting with Supabase.
    Provides CRUD operations for markets and other entities.
    """
    
    def __init__(self):
        """Initialize Supabase client connection."""
        if not settings.SUPABASE_URL or not settings.SUPABASE_API_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_API_KEY must be set in environment")
        
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_API_KEY
        )
        logger.info("✓ Database service initialized with Supabase")
    
    # ==================== MARKET CRUD OPERATIONS ====================
    
    async def create_market(self, market_data: MarketCreate) -> Market:
        """
        Create a new market in the database.
        
        Args:
            market_data: Market data to create
            
        Returns:
            Created Market object with id and timestamps
        """
        try:
            data = market_data.model_dump()
            data['created_at'] = datetime.utcnow().isoformat()
            data['updated_at'] = datetime.utcnow().isoformat()
            
            response = self.client.table('markets').insert(data).execute()
            
            if response.data:
                return Market(**response.data[0])
            else:
                raise Exception("Failed to create market: No data returned")
                
        except Exception as e:
            logger.error(f"Error creating market: {e}")
            raise
    
    async def get_market_by_id(self, market_id: int) -> Optional[Market]:
        """
        Retrieve a market by its database ID.
        
        Args:
            market_id: Database ID of the market
            
        Returns:
            Market object if found, None otherwise
        """
        try:
            response = self.client.table('markets').select('*').eq('id', market_id).execute()
            
            if response.data:
                return Market(**response.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving market {market_id}: {e}")
            raise
    
    async def get_market_by_polymarket_id(self, polymarket_id: str) -> Optional[Market]:
        """
        Retrieve a market by its Polymarket ID.
        
        Args:
            polymarket_id: Polymarket identifier
            
        Returns:
            Market object if found, None otherwise
        """
        try:
            response = self.client.table('markets').select('*').eq('polymarket_id', polymarket_id).execute()
            
            if response.data:
                return Market(**response.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving market by polymarket_id {polymarket_id}: {e}")
            raise
    
    async def get_markets(
        self,
        limit: int = 100,
        offset: int = 0,
        is_active: Optional[bool] = None,
        order_by: str = 'created_at',
        ascending: bool = False
    ) -> List[Market]:
        """
        Retrieve multiple markets with filtering and pagination.
        
        Args:
            limit: Maximum number of markets to return
            offset: Number of markets to skip
            is_active: Filter by active status (None = all)
            order_by: Field to order by
            ascending: Sort order (False = descending)
            
        Returns:
            List of Market objects
        """
        try:
            query = self.client.table('markets').select('*')
            
            # Apply filters
            if is_active is not None:
                query = query.eq('is_active', is_active)
            
            # Apply ordering
            query = query.order(order_by, desc=not ascending)
            
            # Apply pagination
            query = query.range(offset, offset + limit - 1)
            
            response = query.execute()
            
            return [Market(**market) for market in response.data]
            
        except Exception as e:
            logger.error(f"Error retrieving markets: {e}")
            raise
    
    async def update_market(self, market_id: int, update_data: MarketUpdate) -> Optional[Market]:
        """
        Update an existing market.
        
        Args:
            market_id: Database ID of the market to update
            update_data: Fields to update
            
        Returns:
            Updated Market object if found, None otherwise
        """
        try:
            data = update_data.model_dump(exclude_none=True)
            data['updated_at'] = datetime.utcnow().isoformat()
            
            response = self.client.table('markets').update(data).eq('id', market_id).execute()
            
            if response.data:
                return Market(**response.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Error updating market {market_id}: {e}")
            raise
    
    async def upsert_market(self, market_data: MarketCreate) -> Market:
        """
        Insert or update a market based on polymarket_id.
        
        Args:
            market_data: Market data to upsert
            
        Returns:
            Upserted Market object
        """
        try:
            data = market_data.model_dump()
            data['updated_at'] = datetime.utcnow().isoformat()
            
            # Check if market exists
            existing = await self.get_market_by_polymarket_id(market_data.polymarket_id)
            
            if existing:
                # Update existing market
                update_data = MarketUpdate(**data)
                return await self.update_market(existing.id, update_data)
            else:
                # Create new market
                return await self.create_market(market_data)
                
        except Exception as e:
            logger.error(f"Error upserting market: {e}")
            raise
    
    async def batch_upsert_markets(self, markets: List[MarketCreate]) -> Dict[str, int]:
        """
        Batch upsert multiple markets.
        
        Args:
            markets: List of market data to upsert
            
        Returns:
            Dictionary with counts of successful and failed operations
        """
        successful = 0
        failed = 0
        
        for market_data in markets:
            try:
                await self.upsert_market(market_data)
                successful += 1
            except Exception as e:
                logger.error(f"Failed to upsert market {market_data.polymarket_id}: {e}")
                failed += 1
        
        return {
            "successful": successful,
            "failed": failed,
            "total": len(markets)
        }
    
    async def delete_market(self, market_id: int) -> bool:
        """
        Delete a market by ID.
        
        Args:
            market_id: Database ID of the market to delete
            
        Returns:
            True if deleted, False if not found
        """
        try:
            response = self.client.table('markets').delete().eq('id', market_id).execute()
            return len(response.data) > 0
            
        except Exception as e:
            logger.error(f"Error deleting market {market_id}: {e}")
            raise
    
    async def search_markets(self, query: str, limit: int = 20) -> List[Market]:
        """
        Search markets by question or description.
        Uses Supabase full-text search if available, otherwise filters.
        
        Args:
            query: Search query string
            limit: Maximum number of results
            
        Returns:
            List of matching Market objects
        """
        try:
            # Use ilike for case-insensitive partial match
            response = self.client.table('markets').select('*').or_(
                f"question.ilike.%{query}%,description.ilike.%{query}%"
            ).limit(limit).execute()
            
            return [Market(**market) for market in response.data]
            
        except Exception as e:
            logger.error(f"Error searching markets: {e}")
            raise
    
    async def get_markets_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        limit: int = 100
    ) -> List[Market]:
        """
        Get markets within a date range.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            limit: Maximum number of results
            
        Returns:
            List of Market objects
        """
        try:
            response = self.client.table('markets').select('*').gte(
                'end_date', start_date.isoformat()
            ).lte(
                'end_date', end_date.isoformat()
            ).limit(limit).execute()
            
            return [Market(**market) for market in response.data]
            
        except Exception as e:
            logger.error(f"Error getting markets by date range: {e}")
            raise
    
    async def get_active_markets(self, limit: int = 100) -> List[Market]:
        """
        Get all active markets.
        
        Args:
            limit: Maximum number of results
            
        Returns:
            List of active Market objects
        """
        return await self.get_markets(limit=limit, is_active=True)
    
    async def count_markets(self, is_active: Optional[bool] = None) -> int:
        """
        Count total number of markets.
        
        Args:
            is_active: Filter by active status (None = all)
            
        Returns:
            Total count of markets
        """
        try:
            query = self.client.table('markets').select('id', count='exact')
            
            if is_active is not None:
                query = query.eq('is_active', is_active)
            
            response = query.execute()
            return response.count if response.count is not None else 0
            
        except Exception as e:
            logger.error(f"Error counting markets: {e}")
            raise
    
    # ==================== VECTOR EMBEDDING OPERATIONS ====================
    
    async def store_embedding(self, market_id: int, embedding: List[float], topics: Optional[List[dict]] = None) -> VectorEmbedding:
        """Store a vector embedding for a market."""
        try:
            data = {
                'market_id': market_id,
                'embedding': embedding,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Add topics if provided
            if topics is not None:
                data['topics'] = topics
            
            # Upsert: update if exists, insert if not
            response = self.client.table('vector_embeddings').upsert(
                data,
                on_conflict='market_id'
            ).execute()
            
            if response.data:
                return VectorEmbedding(**response.data[0])
            raise Exception("Failed to store embedding")
        except Exception as e:
            logger.error(f"Error storing embedding: {e}")
            raise
    
    async def get_embedding(self, market_id: int) -> Optional[VectorEmbedding]:
        """Get vector embedding for a market."""
        try:
            response = self.client.table('vector_embeddings').select('*').eq('market_id', market_id).execute()
            if response.data:
                return VectorEmbedding(**response.data[0])
            return None
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            raise
    
    async def get_all_embeddings(self, limit: int = 1000) -> List[VectorEmbedding]:
        """Get all stored embeddings."""
        try:
            response = self.client.table('vector_embeddings').select('*').limit(limit).execute()
            return [VectorEmbedding(**emb) for emb in response.data]
        except Exception as e:
            logger.error(f"Error getting embeddings: {e}")
            raise
    
    async def delete_embedding(self, market_id: int) -> bool:
        """Delete embedding for a market."""
        try:
            response = self.client.table('vector_embeddings').delete().eq('market_id', market_id).execute()
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error deleting embedding: {e}")
            raise


# ==================== SINGLETON INSTANCE ====================

_db_service: Optional[DatabaseService] = None


def get_database_service() -> DatabaseService:
    """
    Get or create the database service singleton.
    
    Returns:
        DatabaseService instance
    """
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
    return _db_service

