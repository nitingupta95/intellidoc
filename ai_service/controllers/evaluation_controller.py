import logging
from fastapi.responses import JSONResponse
from schemas.evaluation import EvaluateRequest, EvaluateResponse
from evaluation.ragas_evaluator import evaluator as ragas_evaluator

logger = logging.getLogger(__name__)

async def handle_evaluate(
    request: EvaluateRequest,
    x_openai_api_key: str,
    x_gemini_api_key: str,
):
    logger.info(f"RAGAS evaluation request: question='{request.question[:60]}...'")

    try:
        scores = ragas_evaluator.evaluate(
            question=request.question,
            answer=request.answer,
            context_chunks=request.context_chunks,
            openai_api_key=x_openai_api_key,
            gemini_api_key=x_gemini_api_key,
        )

        dup_health = ragas_evaluator.detect_duplicate_chunks(request.context_chunks)

        return EvaluateResponse(
            faithfulness=scores["faithfulness"],
            answer_relevancy=scores["answer_relevancy"],
            context_precision=scores["context_precision"],
            context_recall=scores["context_recall"],
            overall=scores["overall"],
            metadata_health=None,
            duplicate_health=dup_health,
        )
    except Exception as e:
        logger.error(f"RAGAS evaluation error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Evaluation failed", "detail": str(e)}
        )
