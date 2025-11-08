# Database Services Documentation

Complete guide for interacting with Supabase database using the service layer.

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [Services](#services)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)

## Overview

The application uses a service-oriented architecture to interact with Supabase (PostgreSQL database):

```
API Routes → Services → Supabase Database
```

### Key Services

1. **DatabaseService** - Core CRUD operations for markets
2. **VectorService** - Embeddings and similarity search
3. **RelationService** - Market relationships and correlations

## Architecture

```
app/
├── routers/           # FastAPI route handlers
│   ├── market_routes.py
│   ├── vector_routes.py
│   └── relation_routes.py
├── services/          # Business logic layer
│   ├── database_service.py    # Supabase CRUD
│   ├── vector_service.py      # Embeddings & similarity
│   └── relation_service.py    # Relationships
├── schemas/           # Pydantic models
│   ├── market_schema.py
│   └── vector_schema.py
└── utils/            # Helper utilities
    └── openai_service.py
```

## Setup

### 1. Environment Variables

Create `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your-api-key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here

# Optional
SCRAPE_INTERVAL_HOURS=1
```

### 2. Database Schema

Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS markets (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    description TEXT,
    outcomes TEXT[],
    outcome_prices TEXT[],
    end_date TIMESTAMPTZ,
    volume NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    polymarket_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_scraped_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_markets_is_active ON markets(is_active);
CREATE INDEX IF NOT EXISTS idx_markets_end_date ON markets(end_date);
CREATE INDEX IF NOT EXISTS idx_markets_polymarket_id ON markets(polymarket_id);
CREATE INDEX IF NOT EXISTS idx_markets_question ON markets USING gin(to_tsvector('english', question));
```

### 3. Install Dependencies

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

## Services

### DatabaseService

Core database operations for markets.

```python
from app.services.database_service import get_database_service

db = get_database_service()

# Create a market
market = await db.create_market(market_data)

# Get by ID
market = await db.get_market_by_id(123)

# Get multiple with filters
markets = await db.get_markets(
    limit=50,
    offset=0,
    is_active=True,
    order_by='created_at',
    ascending=False
)

# Update
updated = await db.update_market(123, update_data)

# Upsert (insert or update)
market = await db.upsert_market(market_data)

# Search
results = await db.search_markets("bitcoin", limit=10)

# Delete
deleted = await db.delete_market(123)
```

### VectorService

Vector embeddings and similarity search.

```python
from app.services.vector_service import get_vector_service

vs = get_vector_service()

# Create vector from text
vector = await vs.create_vector_from_text("Will Bitcoin reach $100k?")

# Create vector from market
market = await db.get_market_by_id(123)
vector = await vs.create_vector_from_market(market)

# Create dataset (market + vector)
dataset = await vs.create_dataset(market)

# Find similar markets
results = await vs.find_similar_markets(
    query_text="cryptocurrency predictions",
    limit=10,
    is_active=True
)

# Find markets similar to another market
similar = await vs.find_similar_to_market(
    market_id=123,
    limit=5
)

# Get closest match to prompt
vector, market, similarity = await vs.retrieve_closest_vector_from_prompt(
    "Will crypto prices rise?"
)
```

### RelationService

Market relationships and correlations.

```python
from app.services.relation_service import get_relation_service

rs = get_relation_service()

# Find related markets
relations = await rs.find_related_markets(
    market_id=123,
    limit=10,
    min_similarity=0.7
)

# Get relation between two markets
relation = await rs.retrieve_relation(
    dataset_1_id=123,
    dataset_2_id=456
)

# Find correlated markets
correlated = await rs.find_correlated_markets(
    market_id=123,
    limit=10
)

# Batch find relations
results = await rs.batch_find_relations(
    market_ids=[1, 2, 3, 4, 5],
    limit_per_market=5
)
```

## API Endpoints

### Market Endpoints

```bash
# Create market
POST /api/markets/
Body: MarketCreate

# Get market by ID
GET /api/markets/{market_id}

# Get market by Polymarket ID
GET /api/markets/polymarket/{polymarket_id}

# List markets with pagination
GET /api/markets/?limit=100&offset=0&is_active=true

# Update market
PUT /api/markets/{market_id}
Body: MarketUpdate

# Delete market
DELETE /api/markets/{market_id}

# Search markets
GET /api/markets/search/query?q=bitcoin&limit=10

# Get active markets
GET /api/markets/filter/active?limit=100

# Batch upsert
POST /api/markets/batch/upsert
Body: List[MarketCreate]

# Get stats
GET /api/markets/stats/overview
```

### Vector Endpoints

```bash
# Create vector from text
POST /api/vectors/embed/text
Body: {"text": "Will Bitcoin reach $100k?"}

# Get dataset (market + vector)
GET /api/vectors/dataset/{market_id}

# Search similar markets
POST /api/vectors/search/similar
Body: {
  "query": "crypto predictions",
  "limit": 10,
  "min_similarity": 0.7
}

# Find similar to specific market
GET /api/vectors/search/similar-to-market/{market_id}?limit=5

# Get closest match
GET /api/vectors/closest-match?prompt=bitcoin%20price
```

### Relation Endpoints

```bash
# Get market relations
GET /api/relations/market/{market_id}?limit=10&min_similarity=0.7

# Get relation between two markets
GET /api/relations/between/{market_1_id}/{market_2_id}

# Get correlated markets
GET /api/relations/correlated/{market_id}?limit=10

# Batch find relations
POST /api/relations/batch/find?market_ids=1&market_ids=2
```

## Usage Examples

### Example 1: Create and Search Markets

```python
from app.schemas.market_schema import MarketCreate
from app.services.database_service import get_database_service
from app.services.vector_service import get_vector_service

# Create a market
market_data = MarketCreate(
    polymarket_id="btc-100k-2025",
    question="Will Bitcoin reach $100,000 by end of 2025?",
    description="Market for Bitcoin price prediction",
    outcomes=["Yes", "No"],
    outcome_prices=["0.65", "0.35"],
    volume=1000000.0,
    is_active=True
)

db = get_database_service()
market = await db.create_market(market_data)

# Search for similar markets
vs = get_vector_service()
similar = await vs.find_similar_markets(
    query_text="cryptocurrency price predictions",
    limit=5
)

for market, similarity in similar:
    print(f"{market.question} - Similarity: {similarity:.2f}")
```

### Example 2: Find Related Markets

```python
from app.services.relation_service import get_relation_service

rs = get_relation_service()

# Find markets related to market ID 123
relations = await rs.find_related_markets(
    market_id=123,
    limit=10,
    min_similarity=0.75
)

for relation in relations:
    print(f"Related Market: {relation.dataset_2.market.question}")
    print(f"Similarity: {relation.probability:.2%}")
    print(f"Type: {relation.relation_type}")
    print("---")
```

### Example 3: Batch Operations

```python
from app.services.database_service import get_database_service

# Batch upsert markets
markets_data = [
    MarketCreate(
        polymarket_id=f"market-{i}",
        question=f"Question {i}?",
        # ... other fields
    )
    for i in range(100)
]

db = get_database_service()
result = await db.batch_upsert_markets(markets_data)

print(f"Successful: {result['successful']}")
print(f"Failed: {result['failed']}")
```

### Example 4: Using with FastAPI

```python
from fastapi import FastAPI, HTTPException
from app.services.database_service import get_database_service
from app.services.vector_service import get_vector_service

app = FastAPI()

@app.get("/api/search")
async def search_markets(query: str, limit: int = 10):
    try:
        vs = get_vector_service()
        results = await vs.find_similar_markets(
            query_text=query,
            limit=limit
        )
        
        return {
            "query": query,
            "results": [
                {
                    "id": market.id,
                    "question": market.question,
                    "similarity": similarity
                }
                for market, similarity in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Best Practices

### 1. Use Async/Await

All service methods are async:

```python
# Good
market = await db.get_market_by_id(123)

# Bad
market = db.get_market_by_id(123)  # Won't work
```

### 2. Handle Exceptions

```python
try:
    market = await db.get_market_by_id(123)
    if not market:
        # Handle not found
        pass
except Exception as e:
    logger.error(f"Error: {e}")
    # Handle error
```

### 3. Use Singletons

Services are singletons - use getter functions:

```python
# Good
db = get_database_service()
vs = get_vector_service()

# Bad
db = DatabaseService()  # Creates new instance
```

### 4. Batch When Possible

```python
# Good - Batch operation
embeddings = await vs.create_vectors_batch(markets)

# Less efficient - Individual operations
embeddings = [await vs.create_vector_from_market(m) for m in markets]
```

### 5. Filter at Database Level

```python
# Good - Filter in query
markets = await db.get_markets(is_active=True, limit=100)

# Bad - Filter after fetching
all_markets = await db.get_markets(limit=1000)
active = [m for m in all_markets if m.is_active]
```

## Troubleshooting

### Connection Issues

```python
# Check Supabase connection
from app.services.database_service import get_database_service

try:
    db = get_database_service()
    markets = await db.get_markets(limit=1)
    print("✓ Connected to Supabase")
except Exception as e:
    print(f"✗ Connection failed: {e}")
```

### Embedding Issues

```python
# Check OpenAI service
from app.utils.openai_service import get_openai_helper

try:
    helper = get_openai_helper()
    embedding = await helper.create_text_embedding("test")
    print(f"✓ Embeddings working - dimension: {len(embedding)}")
except Exception as e:
    print(f"✗ Embedding failed: {e}")
```

## Performance Tips

1. **Pagination**: Use `limit` and `offset` for large datasets
2. **Indexing**: Ensure database indexes are created
3. **Batch Operations**: Use batch methods for multiple items
4. **Caching**: Cache embeddings when possible
5. **Filtering**: Filter at database level, not in Python

## API Documentation

Start the server and visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Support

For issues or questions:
1. Check logs for error details
2. Verify environment variables are set
3. Ensure database schema is up to date
4. Check Supabase dashboard for database status

