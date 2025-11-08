from app.schemas.schemas import Dataset, Relation
from app.core.config import settings
from openai import OpenAI

client = OpenAI(api_key=settings.OPENAI_API_KEY)

class OpenAIService:
    """Service layer for OpenAI operations"""

    