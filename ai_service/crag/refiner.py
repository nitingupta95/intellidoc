import re
import asyncio
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from core.config import settings

logger = logging.getLogger(__name__)

class KeepOrDrop(BaseModel):
    keep: bool

filter_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a strict relevance filter. Return keep=true only if the sentence directly helps answer the question. Use ONLY the sentence. Output JSON only."),
    ("human", "Question: {question}\n\nSentence:\n{sentence}")
])

def _get_filter_chain(openai_api_key: str = None, gemini_api_key: str = None):
    if openai_api_key:
        llm = ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=0,
            openai_api_key=openai_api_key
        )
    elif gemini_api_key:
        llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_FAST_MODEL,
            temperature=0,
            google_api_key=gemini_api_key
        )
    elif settings.OPENAI_API_KEY:
        llm = ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY
        )
    elif settings.GEMINI_API_KEY:
        llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_FAST_MODEL,
            temperature=0,
            google_api_key=settings.GEMINI_API_KEY
        )
    else:
        raise ValueError("No LLM API key available for CRAG refiner")
    return filter_prompt | llm.with_structured_output(KeepOrDrop)

def decompose_to_sentences(text: str) -> List[str]:
    """
    Simple dependency-free sentence splitter.
    Splits on periods, newlines, exclamation marks, and question marks.
    """
    if not text:
        return []
    # Split by newline or sentence-ending punctuation followed by space
    raw_sentences = re.split(r'(?<=[.!?])\s+|\n+', text)
    return [s.strip() for s in raw_sentences if s.strip()]

def _doc_text(d: Dict[str, Any]) -> str:
    """Extracts text from a document/citation dictionary in order of preference."""
    if "full_text" in d:
        return d["full_text"]
    if "page_content" in d:
        return d["page_content"]
    if "content" in d:
        return d["content"]
    return ""

async def _filter_single_sentence(chain, question: str, sentence: str) -> Optional[str]:
    res = await chain.ainvoke({"question": question, "sentence": sentence})
    return sentence if res.keep else None

async def refine(
    question: str, 
    verdict: str, 
    good_docs: List[Dict[str, Any]], 
    web_docs: Optional[List[Dict[str, Any]]] = None, 
    openai_api_key: str = None, 
    gemini_api_key: str = None
) -> str:
    if web_docs is None:
        web_docs = []
        
    if verdict == "CORRECT":
        docs_to_use = good_docs
    else:
        # For INCORRECT or AMBIGUOUS, mix both local and web search to provide maximum context!
        docs_to_use = good_docs + web_docs

    if not docs_to_use:
        return ""

    context_str = " ".join([_doc_text(d) for d in docs_to_use])
    
    # Bypass sentence filtering for meta-queries
    question_lower = question.lower()
    meta_keywords = [
        # Explicit summarization intent
        "summarize", "summarise", "summary", "overview", "summrsie", "sumarize",
        # Quiz / key-points
        "question", "questions", "quiz", "key point", "main idea",
        # Document-level broad queries
        "explain this", "what is this document", "what is this pdf",
        "all about", "about this", "about the document", "about the pdf",
        "tell me about", "what does this", "what does the",
        "explain the document", "explain the pdf", "explain this document",
        "what can you tell", "give me an overview", "give an overview",
        "what topics", "what information", "what is covered", "what are the",
        "describe this", "describe the document", "describe the pdf",
    ]
    is_meta_query = (
        any(kw in question_lower for kw in meta_keywords)
        or (len(question_lower) < 20 and ("doc" in question_lower or "pdf" in question_lower or "file" in question_lower))
    )
    if is_meta_query:
        return context_str

    sentences = decompose_to_sentences(context_str)
    
    if not sentences:
        return ""

    chain = _get_filter_chain(openai_api_key, gemini_api_key)
    
    tasks = [_filter_single_sentence(chain, question, s) for s in sentences]
    filtered_results = await asyncio.gather(*tasks, return_exceptions=True)

    errors = [r for r in filtered_results if isinstance(r, Exception)]
    if errors:
        logger.error("CRAG refiner: %d/%d sentence checks failed: %r", len(errors), len(sentences), errors[0])
        if len(errors) == len(sentences):
            # The filter only trims context; if the model is down, keep all of it
            # rather than returning "" (which reads as "your docs don't cover this").
            return context_str

    kept_sentences = [s for s in filtered_results if isinstance(s, str)]
    # If the sentence filter drops everything (e.g. broad/paraphrase queries),
    # fall back to the full unfiltered context so the LLM always has something
    # to work with rather than triggering the "not enough context" canned reply.
    return " ".join(kept_sentences) if kept_sentences else context_str
