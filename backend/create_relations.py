"""
Create relations for existing markets
"""
import asyncio
import sys
from app.core.config import settings
from app.services.relation_service import get_relation_service
from app.services.database_service import get_database_service
import logging
import numpy as np

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


async def create_all_relations(
    similarity_threshold: float = 0.8,
    correlation_threshold: float = 0.0,
    limit_per_market: int = 100,
    skip_existing: bool = True,
    batch_size: int = 500
):
    """
    Create relations for all markets in the database.
    Optimized to load all data into cache upfront and minimize Supabase requests.
    
    Args:
        similarity_threshold: Minimum similarity score (0.0-1.0) to create relation
        correlation_threshold: Minimum correlation score (0.0-1.0) to create relation
        limit_per_market: Maximum number of relations to check per market
        skip_existing: Skip markets that already have relations
        batch_size: Number of relations to create in each batch write
    """
    print()
    print("="*80)
    print("CREATING MARKET RELATIONS")
    print("="*80)
    print()
    
    # Check required services
    if not settings.SUPABASE_URL or not settings.SUPABASE_API_KEY:
        print("✗ ERROR: SUPABASE credentials not set!")
        print("  Add these to your .env file:")
        print("  SUPABASE_URL=your-url-here")
        print("  SUPABASE_API_KEY=your-key-here")
        print()
        return False
    
    print(f"✓ Supabase URL: {settings.SUPABASE_URL}")
    print(f"✓ Configuration:")
    print(f"  - Similarity threshold: {similarity_threshold}")
    print(f"  - Correlation threshold: {correlation_threshold}")
    print(f"  - Max relations per market: {limit_per_market}")
    print(f"  - Skip existing: {skip_existing}")
    print(f"  - Batch size: {batch_size}")
    print()
    
    try:
        rs = get_relation_service()
        db = get_database_service()
        
        # ==================== PHASE 1: LOAD ALL DATA INTO CACHE ====================
        print("="*80)
        print("PHASE 1: LOADING DATA INTO CACHE")
        print("="*80)
        print()
        
        # Load all markets
        print("📊 Loading all markets from database...")
        markets = await db.get_markets(limit=30000)
        print(f"✓ Loaded {len(markets)} markets")
        
        if not markets:
            print("⚠️  No markets found in database!")
            print("   Run the scraper first to populate markets")
            return False
        
        # Create market cache (id -> market object)
        market_cache = {m.id: m for m in markets}
        print(f"✓ Created market cache with {len(market_cache)} entries")
        print()
        
        # Load embedding market IDs
        print("🔍 Loading markets with embeddings...")
        embedding_market_ids = await db.get_embedding_market_ids()
        embedding_market_ids_set = set(embedding_market_ids)
        print(f"✓ Found {len(embedding_market_ids_set)} markets with embeddings")
        
        if not embedding_market_ids_set:
            print("⚠️  No markets have embeddings!")
            print("   Run create_embeddings.py first to generate embeddings")
            return False
        print()
        
        # Load ALL existing relations into cache
        print("🔍 Loading all existing relations into cache...")
        existing_relations_response = db.client.table('market_relations').select('*').execute()
        existing_relations = existing_relations_response.data if existing_relations_response.data else []
        print(f"✓ Loaded {len(existing_relations)} existing relations")
        
        # Build relation cache: market_id -> set of related market IDs
        relation_cache = {}
        for rel in existing_relations:
            mid1 = rel['market_id_1']
            mid2 = rel['market_id_2']
            
            if mid1 not in relation_cache:
                relation_cache[mid1] = set()
            if mid2 not in relation_cache:
                relation_cache[mid2] = set()
            
            relation_cache[mid1].add(mid2)
            relation_cache[mid2].add(mid1)
        
        print(f"✓ Built relation cache for {len(relation_cache)} markets")
        print()
        
        # Filter markets to process
        markets_with_embeddings = [market_cache[mid] for mid in embedding_market_ids_set if mid in market_cache]
        
        markets_to_process = []
        if skip_existing:
            print("🔍 Filtering markets that need relations...")
            for market in markets_with_embeddings:
                # Check if market has any relations in cache
                if market.id not in relation_cache or len(relation_cache[market.id]) == 0:
                    markets_to_process.append(market)
            
            print(f"✓ Markets with relations: {len(markets_with_embeddings) - len(markets_to_process)}")
            print(f"✓ Markets needing relations: {len(markets_to_process)}")
        else:
            markets_to_process = markets_with_embeddings
            print(f"✓ Processing all {len(markets_to_process)} markets (not skipping existing)")
        print()
        
        if not markets_to_process:
            print("✅ All markets already have relations!")
            return True
        
        print(f"✓ Cache loaded successfully!")
        print(f"  - {len(market_cache)} markets in cache")
        print(f"  - {len(relation_cache)} markets with existing relations")
        print(f"  - {len(markets_to_process)} markets to process")
        print()
        
        # ==================== PHASE 2: LOAD EMBEDDINGS & CALCULATE SIMILARITIES ====================
        print("="*80)
        print("PHASE 2: LOADING EMBEDDINGS & CALCULATING SIMILARITIES")
        print("="*80)
        print()
        
        print(f"📥 Loading embeddings from database in small batches...")
        print("   (Embedding vectors are 1536 dimensions each, so we use small page sizes)")
        print()
        
        # Load embeddings in small pages to avoid timeout
        # Embeddings are HUGE (1536 floats each), so we need small batches
        embedding_cache = {}
        embedding_matrix = []
        market_id_list = []
        
        page_size = 100  # Reduced to 100 to avoid timeout
        offset = 0
        total_loaded = 0
        failed_batches = 0
        
        while True:
            try:
                # Fetch a small page of embeddings
                response = db.client.table('vector_embeddings')\
                    .select('*')\
                    .range(offset, offset + page_size - 1)\
                    .execute()
                
                if not response.data:
                    break
                
                # Process this batch
                batch_count = 0
                for emb_data in response.data:
                    market_id = emb_data['market_id']
                    if market_id in embedding_market_ids_set:
                        embedding_vector = np.array(emb_data['embedding'])
                        embedding_cache[market_id] = embedding_vector
                        embedding_matrix.append(emb_data['embedding'])
                        market_id_list.append(market_id)
                        batch_count += 1
                
                total_loaded += len(response.data)
                
                # Show progress every 500 embeddings
                if total_loaded % 500 == 0 or len(response.data) < page_size:
                    pct = (len(embedding_cache) / len(embedding_market_ids_set)) * 100 if embedding_market_ids_set else 0
                    print(f"  ✓ Loaded {total_loaded} total ({len(embedding_cache)} relevant for processing - {pct:.1f}%)")
                
                # If we got fewer results than requested, we've reached the end
                if len(response.data) < page_size:
                    break
                
                offset += page_size
                
            except Exception as e:
                logger.error(f"Error loading embeddings at offset {offset}: {e}")
                failed_batches += 1
                
                # If too many failures, give up
                if failed_batches >= 3:
                    print(f"  ✗ Too many failed batches, stopping...")
                    break
                
                # Try to skip this batch and continue
                offset += page_size
                continue
        
        print(f"✓ Loaded {len(embedding_cache)} embeddings total")
        
        if not embedding_cache:
            print("⚠️  No embeddings found!")
            return False
        
        # Convert to numpy matrix for fast computation
        print("🔧 Building embedding matrix for vectorized operations...")
        embedding_matrix = np.array(embedding_matrix)
        market_id_array = np.array(market_id_list)
        
        print(f"✓ Built embedding matrix: {embedding_matrix.shape}")
        print(f"  - {len(market_id_list)} markets with embeddings")
        print()
        
        # Calculate similarities IN MEMORY using vectorized operations
        print(f"🔍 Calculating similarities for {len(markets_to_process)} markets...")
        print("   Using fast numpy operations (no database calls)...")
        print()
        
        # Normalize embedding matrix for cosine similarity
        norms = np.linalg.norm(embedding_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1  # Avoid division by zero
        normalized_embeddings = embedding_matrix / norms
        
        # Build similarity cache: market_id -> [(similar_market_id, similarity), ...]
        similarity_cache = {}
        markets_processed = 0
        
        for i, market in enumerate(markets_to_process):
            market_num = i + 1
            
            try:
                # Get embedding for this market
                if market.id not in embedding_cache:
                    similarity_cache[market.id] = []
                    continue
                
                query_embedding = embedding_cache[market.id]
                query_norm = np.linalg.norm(query_embedding)
                
                if query_norm == 0:
                    similarity_cache[market.id] = []
                    continue
                
                # Normalize query
                normalized_query = query_embedding / query_norm
                
                # Calculate cosine similarities with ALL markets at once (FAST!)
                similarities = np.dot(normalized_embeddings, normalized_query)
                
                # Find markets above threshold (excluding self)
                similar_indices = np.where(
                    (similarities >= similarity_threshold) & 
                    (market_id_array != market.id)
                )[0]
                
                # Sort by similarity and take top N
                similar_indices = similar_indices[np.argsort(-similarities[similar_indices])][:limit_per_market]
                
                # Build result list
                similar_markets = [
                    (int(market_id_array[idx]), float(similarities[idx]))
                    for idx in similar_indices
                ]
                
                similarity_cache[market.id] = similar_markets
                markets_processed += 1
                
                # Show progress every 100 markets
                if market_num % 100 == 0:
                    pct = (market_num / len(markets_to_process)) * 100
                    avg_similar = sum(len(v) for v in similarity_cache.values()) / len(similarity_cache) if similarity_cache else 0
                    print(f"  Progress: {market_num}/{len(markets_to_process)} ({pct:.1f}%) - Avg {avg_similar:.1f} similar markets/market")
                
            except Exception as e:
                logger.error(f"Error calculating similarities for {market.id}: {e}")
                similarity_cache[market.id] = []
        
        total_similar_pairs = sum(len(v) for v in similarity_cache.values())
        print()
        print(f"✓ Calculated {total_similar_pairs} potential similar market pairs")
        print()
        
        # ==================== PHASE 3: CALCULATE RELATIONS ====================
        print("="*80)
        print("PHASE 3: CALCULATING RELATIONS (in-memory processing)")
        print("="*80)
        print()
        
        print(f"🔗 Calculating relations from cached data...")
        print("   Processing everything in memory - no database calls...")
        print()
        
        relations_to_create = []
        total_skipped = 0
        
        for i, market in enumerate(markets_to_process):
            market_num = i + 1
            
            try:
                similar_markets = similarity_cache.get(market.id, [])
                
                if not similar_markets:
                    continue
                
                # Get existing relations for this market from cache
                existing_market_ids = relation_cache.get(market.id, set())
                
                # Process each similar market
                for similar_market_id, similarity in similar_markets:
                    # Skip if relation already exists (check cache)
                    if similar_market_id in existing_market_ids:
                        total_skipped += 1
                        continue
                    
                    # Skip self
                    if similar_market_id == market.id:
                        continue
                    
                    # Get the similar market from cache
                    similar_market = market_cache.get(similar_market_id)
                    if not similar_market:
                        continue
                    
                    # Calculate correlation using cached market data
                    correlation = rs.calculate_correlation(market, similar_market)
                    
                    # Skip if correlation is below threshold
                    if correlation < correlation_threshold:
                        total_skipped += 1
                        continue
                    
                    # Calculate pressure
                    pressure = rs.calculate_pressure(
                        similarity=similarity,
                        correlation=correlation,
                        market1=market,
                        market2=similar_market
                    )
                    
                    # Add to relations to create
                    # Ensure market_id_1 < market_id_2 to avoid duplicates
                    min_id = min(market.id, similar_market_id)
                    max_id = max(market.id, similar_market_id)
                    
                    relations_to_create.append({
                        'market_id_1': min_id,
                        'market_id_2': max_id,
                        'similarity': similarity,
                        'correlation': correlation,
                        'pressure': pressure
                    })
                
                # Show progress every 50 markets
                if market_num % 50 == 0:
                    pct = (market_num / len(markets_to_process)) * 100
                    print(f"  Progress: {market_num}/{len(markets_to_process)} ({pct:.1f}%) - {len(relations_to_create)} relations calculated")
                
            except Exception as e:
                logger.error(f"Error calculating relations for market {market.id}: {e}")
        
        print()
        print(f"✓ Calculated {len(relations_to_create)} relations")
        print(f"✓ Skipped {total_skipped} (already exist or below threshold)")
        
        # Deduplicate relations (same pair might be found from both sides)
        print()
        print("🔧 Deduplicating relations...")
        unique_relations = {}
        for rel in relations_to_create:
            key = (rel['market_id_1'], rel['market_id_2'])
            if key not in unique_relations:
                unique_relations[key] = rel
            else:
                # If duplicate, keep the one with higher similarity
                if rel['similarity'] > unique_relations[key]['similarity']:
                    unique_relations[key] = rel
        
        relations_to_create = list(unique_relations.values())
        print(f"✓ After deduplication: {len(relations_to_create)} unique relations")
        print()
        
        if not relations_to_create:
            print("✅ No new relations to create!")
            return True
        
        # ==================== PHASE 4: BATCH WRITE TO DATABASE ====================
        print("="*80)
        print("PHASE 4: BATCH WRITING RELATIONS TO DATABASE")
        print("="*80)
        print()
        
        print(f"💾 Writing {len(relations_to_create)} relations in batches of {batch_size}...")
        print()
        
        total_created = 0
        total_failed = 0
        
        for i in range(0, len(relations_to_create), batch_size):
            batch = relations_to_create[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(relations_to_create) + batch_size - 1) // batch_size
            
            try:
                # Batch upsert to database
                response = db.client.table('market_relations').upsert(
                    batch,
                    on_conflict='market_id_1,market_id_2'
                ).execute()
                
                created = len(response.data) if response.data else 0
                total_created += created
                
                pct = ((i + len(batch)) / len(relations_to_create)) * 100
                print(f"  ✓ Batch {batch_num}/{total_batches}: {created} relations written ({pct:.1f}% complete)")
                
            except Exception as e:
                total_failed += len(batch)
                logger.error(f"Error writing batch {batch_num}: {e}")
                print(f"  ✗ Batch {batch_num}/{total_batches} failed: {e}")
        
        print()
        print("="*80)
        print("✓ RELATION CREATION COMPLETE")
        print("="*80)
        print(f"✓ Markets processed: {len(markets_to_process)}")
        print(f"✓ Relations created: {total_created}")
        print(f"✓ Relations skipped: {total_skipped}")
        if total_failed > 0:
            print(f"✗ Relations failed: {total_failed}")
        
        # Get final count
        final_relation_count = await rs.count_relations()
        print(f"✓ Total relations in database: {final_relation_count}")
        print("="*80)
        print()
        return True
        
    except Exception as e:
        print()
        print("="*80)
        print(f"✗ ERROR: {e}")
        print("="*80)
        import traceback
        traceback.print_exc()
        print()
        return False


async def clear_all_relations():
    """Clear all relations from the database."""
    print()
    print("="*80)
    print("⚠️  CLEAR ALL RELATIONS")
    print("="*80)
    print()
    print("This will DELETE ALL relations from the database!")
    print()
    
    response = input("Are you sure? Type 'DELETE' to confirm: ").strip()
    if response != 'DELETE':
        print("Operation cancelled.")
        return False
    
    try:
        db = get_database_service()
        
        print()
        print("🗑️  Deleting all relations...")
        
        # Delete all relations using SQL
        response = db.client.table('market_relations').delete().neq('id', 0).execute()
        deleted_count = len(response.data) if response.data else 0
        
        print(f"✓ Deleted {deleted_count} relations")
        print()
        return True
        
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


async def show_relation_stats():
    """Show statistics about relations in the database."""
    print()
    print("="*80)
    print("RELATION STATISTICS")
    print("="*80)
    print()
    
    try:
        rs = get_relation_service()
        db = get_database_service()
        
        # Get total counts
        total_markets = await db.count_markets()
        total_relations = await rs.count_relations()
        
        print(f"Total markets: {total_markets}")
        print(f"Total relations: {total_relations}")
        
        if total_markets > 0 and total_relations > 0:
            avg_relations = total_relations * 2 / total_markets  # Each relation involves 2 markets
            print(f"Average relations per market: {avg_relations:.2f}")
        
        print()
        
        # Sample some relations
        print("Sample relations:")
        response = db.client.table('market_relations').select('*').limit(5).execute()
        
        if response.data:
            for rel in response.data:
                print(f"  - Market {rel['market_id_1']} <-> Market {rel['market_id_2']}")
                print(f"    Similarity: {rel['similarity']:.3f}, Correlation: {rel.get('correlation', 0):.3f}, Pressure: {rel.get('pressure', 0):.3f}")
        else:
            print("  No relations found")
        
        print()
        return True
        
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def print_usage():
    """Print usage information."""
    print()
    print("Usage: python create_relations.py [command] [options]")
    print()
    print("Commands:")
    print("  create         Create relations for all markets (default)")
    print("  stats          Show relation statistics")
    print("  clear          Clear all relations from database")
    print()
    print("Options for 'create' command:")
    print("  --similarity    Minimum similarity threshold (default: 0.7)")
    print("  --correlation   Minimum correlation threshold (default: 0.0)")
    print("  --limit         Max relations to check per market (default: 100)")
    print("  --batch-size    Number of relations to write per batch (default: 500)")
    print("  --no-skip       Process all markets, don't skip existing")
    print()
    print("Examples:")
    print("  python create_relations.py")
    print("  python create_relations.py create --similarity 0.8")
    print("  python create_relations.py create --correlation 0.5 --limit 50 --batch-size 1000")
    print("  python create_relations.py stats")
    print("  python create_relations.py clear")
    print()


if __name__ == "__main__":
    # Parse command line arguments
    command = "create"
    similarity_threshold = 0.7
    correlation_threshold = 0.0
    limit_per_market = 100
    batch_size = 500
    skip_existing = True
    
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        
        if arg in ['create', 'stats', 'clear', 'help']:
            command = arg
        elif arg == '--similarity' and i + 1 < len(sys.argv):
            similarity_threshold = float(sys.argv[i + 1])
            i += 1
        elif arg == '--correlation' and i + 1 < len(sys.argv):
            correlation_threshold = float(sys.argv[i + 1])
            i += 1
        elif arg == '--limit' and i + 1 < len(sys.argv):
            limit_per_market = int(sys.argv[i + 1])
            i += 1
        elif arg == '--batch-size' and i + 1 < len(sys.argv):
            batch_size = int(sys.argv[i + 1])
            i += 1
        elif arg == '--no-skip':
            skip_existing = False
        else:
            print(f"Unknown argument: {arg}")
            print_usage()
            sys.exit(1)
        
        i += 1
    
    # Execute command
    if command == 'help':
        print_usage()
        sys.exit(0)
    elif command == 'create':
        success = asyncio.run(create_all_relations(
            similarity_threshold=similarity_threshold,
            correlation_threshold=correlation_threshold,
            limit_per_market=limit_per_market,
            batch_size=batch_size,
            skip_existing=skip_existing
        ))
        sys.exit(0 if success else 1)
    elif command == 'stats':
        success = asyncio.run(show_relation_stats())
        sys.exit(0 if success else 1)
    elif command == 'clear':
        success = asyncio.run(clear_all_relations())
        sys.exit(0 if success else 1)
    else:
        print(f"Unknown command: {command}")
        print_usage()
        sys.exit(1)

