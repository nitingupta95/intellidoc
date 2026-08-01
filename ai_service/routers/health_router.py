from fastapi import APIRouter
from core.config import settings

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
