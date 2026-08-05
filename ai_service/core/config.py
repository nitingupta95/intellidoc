from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "IntelliDoc AI V2"
    OPENAI_API_KEY: str = ""
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: str = ""
    REDIS_URL: str = "redis://redis:6379"
    RABBITMQ_URL: str = "amqp://guest:guest@rabbitmq:5672/"
    ALLOWED_ORIGIN: str = "http://localhost:3000"

    # S3 / MinIO
    AWS_ACCESS_KEY_ID: str = "admin"
    AWS_SECRET_ACCESS_KEY: str = "password"
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = "intellidoc-documents"
    S3_ENDPOINT: str = "http://minio:9000"

    AI_SERVICE_URL: str = "http://localhost:8000"
    APP_URL: str = "http://localhost:3000"
    INTERNAL_SERVICE_SECRET: str = "default_internal_secret_for_dev"
    GEMINI_API_KEY: str = ""
    LOW_BALANCE_THRESHOLD: int = 5000
    NEGATIVE_GRACE_CREDITS: int = 2000

    # ── CRAG + Tavily ─────────────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""
    CRAG_PENDING_TTL_SECONDS: int = 600

    # Master on/off switch for synthesis-aware CRAG (Phase 1–3 fix).
    # Set CRAG_SYNTHESIS_ENABLED=false to fall back to the old per-chunk
    # exact-match behavior without a code revert.
    CRAG_SYNTHESIS_ENABLED: bool = True

    # ── Blended confidence score weights (Phase 2) ────────────────────────────
    # Final score = retrieval_weight * avg_qdrant_score
    #             + llm_topic_weight * topic_relevance
    #             + synthesis_bonus  (if answerability == SYNTHESIZABLE)
    #
    # Calibration (from failing query "vertical vs horizontal scaling"):
    #   avg_retrieval ≈ 0.49, topic_relevance ≈ 0.90, SYNTHESIZABLE
    #   blended = 0.4*0.49 + 0.4*0.90 + 0.20 = 0.196 + 0.36 + 0.20 = 0.756
    #   → above CRAG_UPPER_THRESHOLD → correctly CORRECT
    #
    # Calibration (from failing query "best platforms for a db"):
    #   avg_retrieval ≈ 0.53, topic_relevance ≈ 0.30 (patterns ≠ vendor list),
    #   INSUFFICIENT (no synthesis bonus)
    #   blended = 0.4*0.53 + 0.4*0.30 + 0.0 = 0.212 + 0.12 = 0.332
    #   → above LOWER but below UPPER → AMBIGUOUS, routed to web-search confirm
    #   (correct: doc doesn't name vendors, web search is appropriate)

    # Weight of the Qdrant cosine similarity in the blended score.
    # Increase to trust vector search more; decrease if embedding false-positives
    # are swinging CORRECT scores on unrelated queries.
    CRAG_RETRIEVAL_WEIGHT: float = 0.4

    # Weight of the LLM's topic_relevance judgment in the blended score.
    # Increase to give the LLM topic judge more authority over final routing.
    CRAG_LLM_TOPIC_WEIGHT: float = 0.4

    # Flat bonus added when the LLM judges the set as SYNTHESIZABLE.
    # Reflects that synthesis is a valid answer path and should count toward CORRECT.
    # Increasing this makes synthesis queries easier to qualify as CORRECT.
    CRAG_SYNTHESIS_BONUS: float = 0.2

    # Verdict thresholds applied to the blended score:
    #   blended >= UPPER → CORRECT
    #   LOWER <= blended < UPPER → AMBIGUOUS
    #   blended < LOWER → INCORRECT
    #
    # Re-tuned from old values (0.7 / 0.3) to work with the new composite score.
    # The old thresholds assumed a raw LLM 0–1 score; new ones work on the weighted blend.
    CRAG_UPPER_THRESHOLD: float = 0.55   # was 0.7
    CRAG_LOWER_THRESHOLD: float = 0.25   # was 0.3

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
