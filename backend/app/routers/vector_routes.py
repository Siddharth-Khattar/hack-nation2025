"""
Vector Routes - API endpoints for vector embeddings
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.schemas.vector_schema import (
    VectorEmbedding,
    VectorEmbeddingCreate,
    SimilarityResult,
    SimilaritySearchResponse
)
from app.services.vector_service import get_vector_service
from app.services.database_service import get_database_service

router = APIRouter(prefix="/vectors", tags=["Vectors"])


@router.post("/embeddings", response_model=VectorEmbedding, status_code=201)
async def create_embedding(request: VectorEmbeddingCreate):
    """
    Create and store embedding for a market.
    
    Example:
    ```json
    {
        "market_id": 123
    }
    ```
    """
    try:
        service = get_vector_service()
        embedding = await service.create_and_store_embedding(request.market_id)
        return embedding
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings/batch", status_code=201)
async def create_embeddings_batch(market_ids: List[int]):
    """
    Create embeddings for multiple markets.
    
    Example:
    ```json
    [1, 2, 3, 4, 5]
    ```
    """
    try:
        service = get_vector_service()
        embeddings = await service.batch_create_embeddings(market_ids)
        return {
            "created": len(embeddings),
            "total": len(market_ids)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embeddings/{market_id}", response_model=VectorEmbedding)
async def get_embedding(market_id: int):
    """Get stored embedding for a market."""
    try:
        db = get_database_service()
        embedding = await db.get_embedding(market_id)
        
        if not embedding:
            raise HTTPException(status_code=404, detail="Embedding not found")
        
        return embedding
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/embeddings/{market_id}", status_code=204)
async def delete_embedding(market_id: int):
    """Delete embedding for a market."""
    try:
        db = get_database_service()
        deleted = await db.delete_embedding(market_id)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Embedding not found")
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/similar-to-market/{market_id}", response_model=SimilaritySearchResponse)
async def find_similar_to_market(
    market_id: int,
    limit: int = Query(10, ge=1, le=100)
):
    """
    Find markets similar to a specific market (uses stored embeddings).
    
    Example: `/vectors/search/similar-to-market/123?limit=5`
    """
    try:
        service = get_vector_service()
        results = await service.find_similar_to_market(market_id, limit=limit)
        
        return SimilaritySearchResponse(
            results=[
                SimilarityResult(market_id=mid, similarity=score)
                for mid, score in results
            ],
            count=len(results)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/similar-to-text", response_model=SimilaritySearchResponse)
async def find_similar_to_text(
    q: str = Query(..., description="Search query text"),
    limit: int = Query(10, ge=1, le=100)
):
    """
    Find markets similar to a text query (uses stored embeddings).
    
    Example: `/vectors/search/similar-to-text?q=bitcoin%20price&limit=5`
    """
    try:
        service = get_vector_service()
        results = await service.find_similar_to_text(q, limit=limit)
        
        return SimilaritySearchResponse(
            results=[
                SimilarityResult(market_id=mid, similarity=score)
                for mid, score in results
            ],
            count=len(results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/proximity-to-market/{market_id}", response_model=SimilaritySearchResponse)
async def find_markets_in_proximity_to_market(
    market_id: int,
    threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score (0.0-1.0)")
):
    """
    Find ALL markets within a certain proximity (similarity threshold) to a specific market.
    Returns all markets with similarity >= threshold (uses stored embeddings only).
    
    Example: `/vectors/search/proximity-to-market/123?threshold=0.8`
    
    Args:
        market_id: Reference market ID
        threshold: Minimum similarity score (default: 0.7, range: 0.0-1.0)
    """
    try:
        service = get_vector_service()
        results = await service.find_markets_in_proximity_to_market(market_id, threshold=threshold)
        
        return SimilaritySearchResponse(
            results=[
                SimilarityResult(market_id=mid, similarity=score)
                for mid, score in results
            ],
            count=len(results)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/proximity-to-text", response_model=SimilaritySearchResponse)
async def find_markets_in_proximity_to_text(
    q: str = Query(..., description="Search query text"),
    threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score (0.0-1.0)")
):
    """
    Find ALL markets within a certain proximity (similarity threshold) to a text query.
    Returns all markets with similarity >= threshold.
    
    Example: `/vectors/search/proximity-to-text?q=bitcoin%20price&threshold=0.8`
    
    Args:
        q: Search query text
        threshold: Minimum similarity score (default: 0.7, range: 0.0-1.0)
    """
    try:
        service = get_vector_service()
        results = await service.find_markets_in_proximity_to_text(q, threshold=threshold)
        
        return SimilaritySearchResponse(
            results=[
                SimilarityResult(market_id=mid, similarity=score)
                for mid, score in results
            ],
            count=len(results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
