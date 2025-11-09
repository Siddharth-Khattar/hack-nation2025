from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ShortenedName(BaseModel):
    """Schema for a shortened market name"""
    id: int = Field(..., description="Database primary key")
    market_id: int = Field(..., description="Market ID")
    original_name: str = Field(..., description="Original market question")
    shortened_name: str = Field(..., description="Shortened name (3 words)")
    created_at: datetime = Field(..., description="When the shortened name was created")
    updated_at: datetime = Field(..., description="When the shortened name was last updated")
    
    class Config:
        from_attributes = True

class ShortenedNameResponse(BaseModel):
    """Response schema for shortened name"""
    shortened_name: ShortenedName

class ShortenedNameListResponse(BaseModel):
    """Response schema for list of shortened names"""
    shortened_names: list[ShortenedName]
    total: int
    page: int
    page_size: int

