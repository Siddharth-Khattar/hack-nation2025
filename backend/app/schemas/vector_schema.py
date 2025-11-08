from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Vector(BaseModel):
    """Schema for a vector embedding"""
    vector: List[float] = Field(..., description="The vector embedding")

class VectorEmbedding(BaseModel):
    """Stored vector embedding linked to a market"""
    id: int = Field(..., description="Database ID")
    market_id: int = Field(..., description="Reference to market")
    embedding: List[float] = Field(..., description="Vector embedding")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")
    
    class Config:
        from_attributes = True

class VectorEmbeddingCreate(BaseModel):
    """Schema for creating a vector embedding"""
    market_id: int = Field(..., description="Market ID to create embedding for")

class Dataset(BaseModel):
    """Dataset with market and its embedding"""
    market_id: int
    embedding: List[float]

class SimilarityResult(BaseModel):
    """Result from similarity search"""
    market_id: int
    similarity: float

class SimilaritySearchResponse(BaseModel):
    """Response for similarity searches"""
    results: List[SimilarityResult]
    count: int
