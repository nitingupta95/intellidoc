import asyncio
from typing import List, Dict, Any

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from core.config import settings
from .models import DocEvalScore, EvalVerdict, EvalResult

doc_eval_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a strict retrieval evaluator for RAG. You will be given ONE retrieved chunk and a question. Return a relevance score in [0.0, 1.0]. 1.0 = chunk alone is sufficient to answer fully/mostly. 0.0 = chunk is irrelevant or only mentions the topic without answering the question. Be extremely conservative with high scores; if the question asks for a definition and the chunk only mentions applying for it, the score MUST be 0.0. EXCEPTION: If the question asks for a general summary, overview, or explanation of the entire document, consider the chunk highly relevant (score 1.0) as long as it contains valid content from the document. Also return a short reason. Output JSON only."),
    ("human", "Question: {question}\n\nChunk:\n{chunk}")
])

def _get_eval_chain(openai_api_key: str = None, gemini_api_key: str = None):
    if openai_api_key:
        llm = ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=0,
            openai_api_key=openai_api_key
        )
    elif gemini_api_key:
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0,
            google_api_key=gemini_api_key
        )
    else:
        # Fallback
        llm = ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY
        )
    return doc_eval_prompt | llm.with_structured_output(DocEvalScore)

async def _score_single_doc(chain, question: str, citation: Dict[str, Any]) -> DocEvalScore:
    chunk_text = citation.get("full_text", "")
    try:
        return await chain.ainvoke({"question": question, "chunk": chunk_text})
    except Exception as e:
        # Graceful fallback on LLM error
        return DocEvalScore(score=0.0, reason=f"Evaluation failed: {str(e)}")

async def evaluate_documents(
    question: str, 
    citations: List[Dict[str, Any]], 
    openai_api_key: str = None, 
    gemini_api_key: str = None
) -> EvalResult:
    """
    Evaluates retrieved documents against a question and returns a verdict.
    """
    if not citations:
        return EvalResult(
            verdict=EvalVerdict.INCORRECT,
            good_docs=[],
            all_scores=[],
            reason="No documents were retrieved."
        )

    chain = _get_eval_chain(openai_api_key, gemini_api_key)
    
    # Heuristic for summarization queries to bypass strict evaluation
    question_lower = question.lower()
    summary_keywords = ["summarize", "summarise", "summary", "overview", "summrsie", "sumarize"]
    if any(kw in question_lower for kw in summary_keywords) or len(question_lower) < 15 and "doc" in question_lower:
        return EvalResult(
            verdict=EvalVerdict.CORRECT,
            good_docs=citations,
            all_scores=[1.0] * len(citations),
            reason="Summarization/general query detected; bypassing strict relevance filtering."
        )

    # Run evaluation in parallel
    tasks = [_score_single_doc(chain, question, cit) for cit in citations]
    scores: List[DocEvalScore] = await asyncio.gather(*tasks)
    
    all_scores = [s.score for s in scores]
    
    good_docs = []
    for cit, score_obj in zip(citations, scores):
        if score_obj.score > settings.CRAG_LOWER_THRESHOLD:
            good_docs.append(cit)
            
    if any(s > settings.CRAG_UPPER_THRESHOLD for s in all_scores):
        verdict = EvalVerdict.CORRECT
        reason = f"{len(good_docs)} of {len(citations)} chunks scored above the lower confidence threshold, with at least one high confidence."
    elif all(s < settings.CRAG_LOWER_THRESHOLD for s in all_scores):
        verdict = EvalVerdict.INCORRECT
        reason = "No documents met the relevance threshold."
    else:
        verdict = EvalVerdict.AMBIGUOUS
        reason = f"{len(good_docs)} of {len(citations)} chunks had partial relevance, but none were highly confident."

    return EvalResult(
        verdict=verdict,
        good_docs=good_docs,
        all_scores=all_scores,
        reason=reason
    )
