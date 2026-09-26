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
    # Shared secret between Next.js gateway and this service.
    # MUST be set explicitly in every environment — no default is provided
    # so that a misconfigured deployment fails loudly at startup rather than
    # running with an insecure placeholder.
    # Generate: openssl rand -hex 32
    INTERNAL_SERVICE_SECRET: str
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

    # ── Multi-hop retrieval (feat/mult-hop-retrival) ───────────────────────────
    # When True, the query route runs an iterative hop loop instead of a single
    # vector search.  Each hop asks the LLM "can you fully answer the original
    # question with what we have so far?"; if not, it extracts a *specific*
    # missing entity/fact and uses that as the next search query.
    #
    # Set ENABLE_MULTI_HOP=false to preserve old single-shot behaviour without
    # any code changes.
    ENABLE_MULTI_HOP: bool = True

    # Hard cap on the number of retrieval hops (hop 1 = existing retrieval).
    # Increasing this beyond 3 is rarely useful and adds latency.
    MULTI_HOP_MAX_HOPS: int = 3

    # Hard wall-clock latency budget for the entire hop loop (seconds).
    # If the loop exceeds this, it cuts off immediately and returns best-available
    # chunks with done_reason="latencyBudget" (partial=True in the response).
    # Set to 0 to disable the budget check.
    MULTI_HOP_LATENCY_BUDGET_S: float = 8.0

    # Credit cost multiplier applied to knowledge_base queries that reach hop 2+.
    # Reflects the extra LLM judge calls and retrieval work.  2.5 = 2.5x normal cost.
    # Set to 1.0 to disable the multiplier.
    MULTI_HOP_COST_MULTIPLIER: float = 2.5

    # Redis TTL (seconds) for per-hop retrieval caches.
    # Key = docSetId:sha256(subQuery).  Repeat cross-doc queries against the
    # same KB hit this cache instead of re-running Qdrant + embedding.
    MULTI_HOP_HOP_CACHE_TTL: int = 3600  # 1 hour

    # ── Retrieval floor / diversity (per-doc floor + MMR) ─────────────────────
    # Minimum number of chunks guaranteed from each document in the active
    # KB / document_ids scope.  After the global top-k search, any doc not
    # represented in the result set gets a small targeted search (top-N) so
    # every document has at least RETRIEVAL_PER_DOC_FLOOR chunks.
    # Set to 0 to disable the floor-fill pass.
    RETRIEVAL_PER_DOC_FLOOR: int = 2

    # Hard ceiling on total chunks after the floor-fill merge.  Keeps token
    # cost predictable regardless of how many docs are in scope.
    RETRIEVAL_TOTAL_CAP: int = 15

    # MMR lambda: 0.0 = pure diversity, 1.0 = pure similarity.
    # 0.7 keeps top results accurate while penalising same-doc redundancy.
    RETRIEVAL_MMR_LAMBDA: float = 0.7

    # When True, logs a structured DEBUG line per query that lists which
    # doc_ids appear in the final chunk set (doc_coverage_log event).
    RETRIEVAL_DEBUG: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
