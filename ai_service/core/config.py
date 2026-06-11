from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "IntelliDoc AI V2"
    OPENAI_API_KEY: str = ""
    QDRANT_URL: str = "http://qdrant:6333"
    REDIS_URL: str = "redis://redis:6379"
    RABBITMQ_URL: str = "amqp://guest:guest@rabbitmq:5672/"
    
    # S3 / MinIO
    AWS_ACCESS_KEY_ID: str = "admin"
    AWS_SECRET_ACCESS_KEY: str = "password"
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = "intellidoc-documents"
    S3_ENDPOINT: str = "http://minio:9000"
    
    class Config:
        env_file = "../.env"
        extra = "ignore"

settings = Settings()
