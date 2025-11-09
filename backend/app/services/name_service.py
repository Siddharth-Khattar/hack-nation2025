"""
Name Service - Handles shortened market names stored in database
Similar to vector service but for name shortening via AI
"""
from typing import List, Optional
from app.schemas.name_schema import ShortenedName
from app.core.config import settings
from app.utils.openai_service import get_openai_helper
from app.services.database_service import get_database_service
import logging
import asyncio
import time
from collections import deque

logger = logging.getLogger(__name__)


class BurstRateLimiter:
    """
    Burst rate limiter - schedules requests at once, then waits before next burst.
    Similar to vector service rate limiter.
    """
    def __init__(self, burst_size: int = 1000, wait_seconds: float = 65):
        self.burst_size = burst_size
        self.wait_seconds = wait_seconds
        self.burst_start_time = None
        self.requests_in_burst = 0
        self.total_requests = 0
        self.lock = asyncio.Lock()
    
    async def start_burst(self):
        """Mark the start of a new burst."""
        async with self.lock:
            self.burst_start_time = time.time()
            self.requests_in_burst = 0
            logger.info(f"🚀 Starting new burst of up to {self.burst_size} requests...")
    
    async def wait_for_next_burst(self):
        """Wait until we can start the next burst."""
        async with self.lock:
            if self.burst_start_time is None:
                return  # First burst, no waiting
            
            elapsed = time.time() - self.burst_start_time
            wait_time = self.wait_seconds - elapsed
            
            if wait_time > 0:
                logger.info(f"⏳ Waiting {wait_time:.1f}s before next burst...")
                await asyncio.sleep(wait_time)
            
            logger.info(f"✓ Ready for next burst! (Total requests so far: {self.total_requests})")
    
    def record_request(self):
        """Record a request in the current burst."""
        self.requests_in_burst += 1
        self.total_requests += 1
    
    def get_burst_count(self) -> int:
        """Get number of requests in current burst."""
        return self.requests_in_burst


class NameService:
    """Service for name shortening operations using stored shortened names."""
    
    def __init__(self):
        self._openai_helper = None
        self.db_service = get_database_service()
        self.rate_limiter = BurstRateLimiter(burst_size=1000, wait_seconds=65)  # 1000 RPM limit
    
    @property
    def openai_helper(self):
        """Lazy initialization of OpenAI helper - only when needed."""
        if self._openai_helper is None:
            self._openai_helper = get_openai_helper()
        return self._openai_helper
    
    # ==================== CREATE & STORE SHORTENED NAMES ====================
    
    async def create_and_store_shortened_name(self, market_id: int) -> ShortenedName:
        """
        Create shortened name for a market using AI and store it in database.
        
        Args:
            market_id: Market database ID
            
        Returns:
            ShortenedName object
        """
        try:
            # Get market
            market = await self.db_service.get_market_by_id(market_id)
            if not market:
                raise ValueError(f"Market {market_id} not found")
            
            # Check if already exists
            existing = await self.db_service.get_shortened_name(market_id)
            if existing:
                logger.info(f"Shortened name already exists for market {market_id}")
                return existing
            
            # Generate shortened name using AI
            logger.info(f"Generating shortened name for market {market_id}...")
            shortened_name = await self.openai_helper.shorten_market_name(market.question)
            
            # Store in database
            shortened = await self.db_service.store_shortened_name(
                market_id=market_id,
                original_name=market.question,
                shortened_name=shortened_name
            )
            
            logger.info(f"✓ Stored shortened name for market {market_id}: {shortened_name}")
            return shortened
            
        except Exception as e:
            logger.error(f"Error creating shortened name for market {market_id}: {e}")
            raise
    
    async def batch_create_shortened_names(
        self,
        market_ids: List[int],
        batch_size: int = 1000
    ) -> dict:
        """
        Batch create shortened names for multiple markets.
        Uses rate limiting to respect API limits.
        
        Args:
            market_ids: List of market IDs to process
            batch_size: Number of markets to process per burst (default: 1000)
            
        Returns:
            Dictionary with counts of successful and failed operations
        """
        try:
            logger.info(f"Starting batch shortened name creation for {len(market_ids)} markets...")
            
            # Filter out markets that already have shortened names
            existing_names = await self.db_service.batch_get_shortened_names(market_ids)
            existing_market_ids = {name.market_id for name in existing_names}
            markets_to_process = [mid for mid in market_ids if mid not in existing_market_ids]
            
            if not markets_to_process:
                logger.info("All markets already have shortened names!")
                return {
                    "successful": len(existing_names),
                    "failed": 0,
                    "skipped": 0,
                    "total": len(market_ids)
                }
            
            logger.info(f"Processing {len(markets_to_process)} markets (skipping {len(existing_market_ids)} existing)")
            
            # Get all markets
            markets = await self.db_service.batch_get_markets_by_ids(markets_to_process)
            market_dict = {m.id: m for m in markets}
            
            successful = 0
            failed = 0
            skipped = 0
            
            # Process in batches
            for batch_start in range(0, len(markets_to_process), batch_size):
                batch_end = min(batch_start + batch_size, len(markets_to_process))
                batch_ids = markets_to_process[batch_start:batch_end]
                batch_num = (batch_start // batch_size) + 1
                total_batches = (len(markets_to_process) + batch_size - 1) // batch_size
                
                logger.info(f"\n📦 Processing batch {batch_num}/{total_batches} ({len(batch_ids)} markets)...")
                
                # Wait for rate limit if needed
                if batch_start > 0:
                    await self.rate_limiter.wait_for_next_burst()
                
                await self.rate_limiter.start_burst()
                
                # Process all markets in batch concurrently
                async def shorten_name_for_market(market_id, idx):
                    try:
                        market = market_dict.get(market_id)
                        if not market:
                            logger.warning(f"Market {market_id} not found, skipping")
                            return (market_id, None, "not_found")
                        
                        # Generate shortened name
                        shortened_name = await self.openai_helper.shorten_market_name(market.question)
                        self.rate_limiter.record_request()
                        
                        # Store in database
                        await self.db_service.store_shortened_name(
                            market_id=market_id,
                            original_name=market.question,
                            shortened_name=shortened_name
                        )
                        
                        return (market_id, shortened_name, "success")
                        
                    except Exception as e:
                        logger.error(f"Error processing market {market_id}: {e}")
                        return (market_id, None, str(e))
                
                # Process all in parallel
                results = await asyncio.gather(*[
                    shorten_name_for_market(mid, idx)
                    for idx, mid in enumerate(batch_ids)
                ])
                
                # Count results
                for market_id, shortened_name, status in results:
                    if status == "success":
                        successful += 1
                    elif status == "not_found":
                        skipped += 1
                    else:
                        failed += 1
                
                logger.info(f"  ✓ Batch {batch_num} complete: {successful} successful, {failed} failed, {skipped} skipped")
            
            return {
                "successful": successful,
                "failed": failed,
                "skipped": skipped + len(existing_market_ids),
                "total": len(market_ids)
            }
            
        except Exception as e:
            logger.error(f"Error in batch shortened name creation: {e}")
            raise
    
    # ==================== RETRIEVE SHORTENED NAMES ====================
    
    async def get_shortened_name(self, market_id: int) -> Optional[ShortenedName]:
        """
        Get shortened name for a market.
        
        Args:
            market_id: Market database ID
            
        Returns:
            ShortenedName if found, None otherwise
        """
        return await self.db_service.get_shortened_name(market_id)
    
    async def batch_get_shortened_names(self, market_ids: List[int]) -> List[ShortenedName]:
        """
        Get shortened names for multiple markets.
        
        Args:
            market_ids: List of market database IDs
            
        Returns:
            List of ShortenedName objects
        """
        return await self.db_service.batch_get_shortened_names(market_ids)
    
    async def get_all_shortened_names(
        self,
        limit: int = 100,
        offset: int = 0
    ) -> List[ShortenedName]:
        """
        Get all shortened names with pagination.
        
        Args:
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            List of ShortenedName objects
        """
        return await self.db_service.get_all_shortened_names(limit=limit, offset=offset)
    
    async def count_shortened_names(self) -> int:
        """
        Count total number of shortened names.
        
        Returns:
            Total count
        """
        return await self.db_service.count_shortened_names()


# ==================== SINGLETON ====================

_name_service: Optional[NameService] = None


def get_name_service() -> NameService:
    """Get or create the name service singleton."""
    global _name_service
    if _name_service is None:
        _name_service = NameService()
    return _name_service

