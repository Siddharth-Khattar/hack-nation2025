"""
Name Routes - API endpoints for shortened market names
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas.name_schema import (
    ShortenedName,
    ShortenedNameResponse,
    ShortenedNameListResponse
)
from app.services.name_service import get_name_service

router = APIRouter(prefix="/names", tags=["Shortened Names"])


@router.post("/{market_id}", response_model=ShortenedNameResponse, status_code=201)
async def create_shortened_name(market_id: int):
    """
    Create a shortened name (3 words) for a market using AI.
    
    Example: `/names/123`
    
    Returns:
        ShortenedName object with the 3-word shortened name
    """
    try:
        service = get_name_service()
        shortened_name = await service.create_and_store_shortened_name(market_id)
        return ShortenedNameResponse(shortened_name=shortened_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{market_id}", response_model=ShortenedNameResponse)
async def get_shortened_name(market_id: int):
    """
    Get the shortened name for a market.
    
    Example: `/names/123`
    
    Returns:
        ShortenedName if found, 404 if not found
    """
    try:
        service = get_name_service()
        shortened_name = await service.get_shortened_name(market_id)
        
        if not shortened_name:
            raise HTTPException(
                status_code=404,
                detail=f"Shortened name not found for market {market_id}"
            )
        
        return ShortenedNameResponse(shortened_name=shortened_name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=ShortenedNameListResponse)
async def get_all_shortened_names(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip")
):
    """
    Get all shortened names with pagination.
    
    Example: `/names/?limit=50&offset=0`
    
    Args:
        limit: Maximum number of results (default: 100, max: 1000)
        offset: Number of results to skip (default: 0)
    
    Returns:
        List of shortened names with pagination info
    """
    try:
        service = get_name_service()
        
        shortened_names = await service.get_all_shortened_names(limit=limit, offset=offset)
        total = await service.count_shortened_names()
        
        page = offset // limit if limit > 0 else 0
        
        return ShortenedNameListResponse(
            shortened_names=shortened_names,
            total=total,
            page=page,
            page_size=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", status_code=201)
async def batch_create_shortened_names(market_ids: List[int]):
    """
    Batch create shortened names for multiple markets.
    
    Example request body:
    ```json
    [123, 456, 789]
    ```
    
    Args:
        market_ids: List of market database IDs
    
    Returns:
        Dictionary with counts of successful, failed, and skipped operations
    """
    try:
        service = get_name_service()
        result = await service.batch_create_shortened_names(market_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/query", status_code=200)
async def batch_get_shortened_names(market_ids: List[int]):
    """
    Batch get shortened names for multiple markets.
    
    Example request body:
    ```json
    [123, 456, 789]
    ```
    
    Args:
        market_ids: List of market database IDs
    
    Returns:
        List of ShortenedName objects
    """
    try:
        service = get_name_service()
        shortened_names = await service.batch_get_shortened_names(market_ids)
        return {
            "shortened_names": shortened_names,
            "total": len(shortened_names)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count")
async def count_shortened_names():
    """
    Get total count of shortened names in database.
    
    Example: `/names/count`
    
    Returns:
        Total count of shortened names
    """
    try:
        service = get_name_service()
        count = await service.count_shortened_names()
        return {"total_shortened_names": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

