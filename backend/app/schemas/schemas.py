from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

class Vector(BaseModel):
    """Schema for a vector"""
    vector: List[float] = Field(..., description="The vector")

class Dataset(BaseModel):
    """Schema for a prediction market dataset"""
    id: int
    vector: Vector
    question: str = Field(..., description="The prediction market question")
    description: str = Field(..., description="Detailed description of the market")
    outcomes: List[str] = Field(..., description="Possible outcomes for the market")
    outcome_prices: List[float] = Field(..., description="Current prices for each outcome")
    end_date: datetime = Field(..., description="Market end/resolution date")
    volume: Decimal = Field(default=Decimal("0"), description="Total trading volume")
    is_active: bool = Field(default=True, description="Whether the market is currently active")
    polymarket_id: Optional[str] = Field(None, description="External Polymarket ID if applicable")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Relation(BaseModel):
    """Relation between a two datasets and a dataset"""
    dataset_1: Dataset
    dataset_2: Dataset
    relation_type: str
    probability: float
    created_at: datetime
    updated_at: datetime

class RelationResponse(BaseModel):
    """Schema for a relation response"""
    relation: Relation

class VectorResponse(BaseModel):
    """Schema for a vector response"""
    vector: Vector
    dataset: Dataset

class DatasetResponse(BaseModel):
    """Schema for a dataset response"""
    dataset: Dataset
