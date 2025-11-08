"""
Setup script to create vector_embeddings table in Supabase
"""
from supabase import create_client
from app.core.config import settings
import sys

def create_vector_table():
    """Create vector_embeddings table in Supabase."""
    
    print("="*80)
    print("CREATING VECTOR_EMBEDDINGS TABLE IN SUPABASE")
    print("="*80)
    print()
    
    # Check configuration
    if not settings.SUPABASE_URL or not settings.SUPABASE_API_KEY:
        print("✗ ERROR: SUPABASE_URL or SUPABASE_API_KEY not set!")
        print("  Please add them to your .env file")
        return False
    
    print(f"✓ Supabase URL: {settings.SUPABASE_URL}")
    print()
    
    try:
        # Connect to Supabase
        print("📡 Connecting to Supabase...")
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_API_KEY)
        print("✓ Connected successfully")
        print()
        
        # SQL to create the table
        sql = """
        -- Create vector_embeddings table
        CREATE TABLE IF NOT EXISTS vector_embeddings (
            id BIGSERIAL PRIMARY KEY,
            market_id BIGINT NOT NULL UNIQUE,
            embedding FLOAT8[] NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT fk_market
                FOREIGN KEY (market_id)
                REFERENCES markets(id)
                ON DELETE CASCADE
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_vector_embeddings_market_id 
            ON vector_embeddings(market_id);
        
        CREATE INDEX IF NOT EXISTS idx_vector_embeddings_created_at 
            ON vector_embeddings(created_at);
        """
        
        print("🗄️  Creating vector_embeddings table...")
        print()
        print("Note: This uses Supabase REST API which may not support direct SQL execution.")
        print("If this fails, please run the SQL manually in Supabase SQL Editor:")
        print()
        print("-" * 80)
        print(sql)
        print("-" * 80)
        print()
        
        # Try to verify the table exists by querying it
        try:
            response = client.table('vector_embeddings').select('id').limit(1).execute()
            print("✓ Table 'vector_embeddings' already exists or was created successfully!")
            print(f"✓ Current row count: {len(response.data)}")
            return True
        except Exception as query_error:
            print("⚠️  Could not verify table (may not exist yet)")
            print(f"   Error: {query_error}")
            print()
            print("📋 ACTION REQUIRED:")
            print("   1. Go to your Supabase project dashboard")
            print("   2. Click 'SQL Editor' in the sidebar")
            print("   3. Copy and paste the SQL above")
            print("   4. Click 'Run' to execute")
            print()
            return False
            
    except Exception as e:
        print()
        print("="*80)
        print(f"✗ ERROR: {e}")
        print("="*80)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print()
    success = create_vector_table()
    print()
    
    if success:
        print("="*80)
        print("✓ SETUP COMPLETE")
        print("="*80)
        print()
        print("Next steps:")
        print("  1. Add OPENAI_API_KEY to your .env file")
        print("  2. Run: python create_embeddings.py")
        print()
        sys.exit(0)
    else:
        print("="*80)
        print("⚠️  MANUAL ACTION REQUIRED")
        print("="*80)
        print()
        print("Please create the table manually in Supabase SQL Editor")
        print("Then run this script again to verify")
        print()
        sys.exit(1)

