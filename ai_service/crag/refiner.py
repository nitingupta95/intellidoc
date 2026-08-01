import re
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from core.config import settings

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
    try:
        res = await chain.ainvoke({"question": question, "sentence": sentence})
        if res.keep:
            return sentence
    except Exception:
        pass
    return None

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
    elif verdict == "INCORRECT":
        docs_to_use = web_docs
    else:
        # AMBIGUOUS
        docs_to_use = good_docs + web_docs

    if not docs_to_use:
        return ""

    context_str = " ".join([_doc_text(d) for d in docs_to_use])
    sentences = decompose_to_sentences(context_str)
    
    if not sentences:
        return ""

    chain = _get_filter_chain(openai_api_key, gemini_api_key)
    
    tasks = [_filter_single_sentence(chain, question, s) for s in sentences]
    filtered_results = await asyncio.gather(*tasks)
    
    kept_sentences = [s for s in filtered_results if s is not None]
    return " ".join(kept_sentences)
