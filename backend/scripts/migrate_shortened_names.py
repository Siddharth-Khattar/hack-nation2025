"""
Migration script to create shortened names for existing markets.
Uses AI to generate 3-word shortened names for all markets.
Respects API rate limits and stores in shortened_names table.
"""
import asyncio
import logging
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from supabase import create_client
from app.services.name_service import get_name_service
from app.services.database_service import get_database_service
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def migrate_shortened_names():
    """
    Migrate shortened names for all markets.
    Only calculates if not already in shortened_names table.
    """
    try:
        logger.info("=" * 80)
        logger.info("STARTING SHORTENED NAMES MIGRATION")
        logger.info("=" * 80)
        
        # Initialize services
        db = get_database_service()
        name_service = get_name_service()
        
        # Get all markets
        logger.info("Fetching markets from database...")
        all_markets = await db.get_markets(limit=10000, is_active=None)
        
        if not all_markets:
            logger.warning("No markets found in database!")
            return
        
        logger.info(f"Found {len(all_markets)} total markets")
        
        # Get markets that already have shortened names
        existing_names = await db.get_all_shortened_names(limit=100000)
        existing_market_ids = {name.market_id for name in existing_names}
        
        # Filter out markets that already have shortened names
        markets_to_process = [m for m in all_markets if m.id not in existing_market_ids]
        
        if not markets_to_process:
            logger.info("All markets already have shortened names!")
            logger.info(f"Total markets: {len(all_markets)}")
            logger.info(f"Markets with shortened names: {len(existing_market_ids)}")
            return
        
        logger.info(f"Markets needing shortened names: {len(markets_to_process)}")
        logger.info(f"Markets already processed: {len(existing_market_ids)}")
        logger.info("")
        
        # Process in batches
        market_ids = [m.id for m in markets_to_process]
        
        logger.info("Starting batch processing...")
        logger.info("This will use AI to generate 3-word shortened names for each market.")
        logger.info("Rate limiting: 1000 requests per 65 seconds (burst mode)")
        logger.info("")
        
        result = await name_service.batch_create_shortened_names(
            market_ids=market_ids,
            batch_size=1000
        )
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("MIGRATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"✓ Successfully created: {result['successful']}")
        logger.info(f"✗ Failed: {result['failed']}")
        logger.info(f"⊘ Skipped (already existed): {result['skipped']}")
        logger.info(f"📊 Total processed: {result['total']}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(migrate_shortened_names())

