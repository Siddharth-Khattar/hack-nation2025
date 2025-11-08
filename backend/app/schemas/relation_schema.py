from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class RelatedMarket(BaseModel):
    """Schema for a related market result"""
    market_id: int = Field(..., description="Related market ID")
    similarity: float = Field(..., description="Similarity score (0.0-1.0)")
    correlation: float = Field(0.0, description="Correlation score")
    pressure: float = Field(0.0, description="Pressure score")

class RelationSearchResponse(BaseModel):
    """Response for relation searches"""
    source_market_id: int = Field(..., description="The source market ID")
    related_markets: List[RelatedMarket] = Field(..., description="List of related markets")
    count: int = Field(..., description="Number of related markets found")

class MarketRelation(BaseModel):
    """Schema for a stored market relation"""
    id: int = Field(..., description="Relation ID")
    market_id_1: int = Field(..., description="First market ID")
    market_id_2: int = Field(..., description="Second market ID")
    similarity: float = Field(..., description="Similarity score (0.0-1.0)")
    correlation: float = Field(0.0, description="Correlation score")
    pressure: float = Field(0.0, description="Pressure score")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")
    
    class Config:
        from_attributes = True

class MarketRelationCreate(BaseModel):
    """Schema for creating a market relation"""
    market_id_1: int = Field(..., description="First market ID")
    market_id_2: int = Field(..., description="Second market ID")
    similarity: float = Field(..., ge=0.0, le=1.0, description="Similarity score (0.0-1.0)")
    correlation: Optional[float] = Field(0.0, description="Correlation score")
    pressure: Optional[float] = Field(0.0, description="Pressure score")

class MarketRelationBatchCreate(BaseModel):
    """Schema for batch creating market relations"""
    relations: List[MarketRelationCreate] = Field(..., description="List of relations to create")