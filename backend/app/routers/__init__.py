"""
API Routers Initialization
Registers all API routes with the main FastAPI application.
"""
from fastapi import APIRouter
from app.routers import market_routes, vector_routes, relation_routes

api_router = APIRouter()

# Register all routers (they already have prefixes and tags defined)
api_router.include_router(market_routes.router)
api_router.include_router(vector_routes.router)
api_router.include_router(relation_routes.router)
