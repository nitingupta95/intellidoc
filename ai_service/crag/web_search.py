import logging
from typing import List, Dict, Any

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate 
from langchain_community.tools.tavily_search import TavilySearchResults

from core.config import settings
from .models import WebQuery

logger = logging.getLogger(__name__)

rewrite_prompt = ChatPromptTemplate.from_messages([
    ("system", "Rewrite the user question into a web search query composed of keywords. Rules: Keep it short (6-14 words). If the question implies recency (e.g. recent/latest/last week/last month), add a constraint like a year. Do NOT answer the question. Return JSON with a single key: query"),
    ("human", "{question}")
])

def _get_rewrite_chain(openai_api_key: str = None, gemini_api_key: str = None):
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
    return rewrite_prompt | llm.with_structured_output(WebQuery)

async def rewrite_query(question: str, openai_api_key: str = None, gemini_api_key: str = None) -> str:
    """
    Rewrites the user question into a search query.
    """
    chain = _get_rewrite_chain(openai_api_key, gemini_api_key)
    try:
        res = await chain.ainvoke({"question": question})
        return res.query
    except Exception as e:
        logger.warning(f"Query rewrite failed: {e}. Falling back to original question.")
        return question

import math
from embeddings.embedding_service import EmbeddingService

async def web_search(query: str, document_summaries: Dict[str, str] = None, openai_api_key: str = None, gemini_api_key: str = None) -> List[Dict[str, Any]]:
    """
    Invokes Tavily with the rewritten query and returns formatted docs,
    filtered by cosine similarity to the document auto-summaries.
    """
    if not settings.TAVILY_API_KEY:
        logger.warning("TAVILY_API_KEY is not set. Skipping web search.")
        return []

    try:
        search = TavilySearchResults(
            max_results=5,
            tavily_api_key=settings.TAVILY_API_KEY
        )
        
        # Tavily search is synchronous, so we should run it in an executor in a real async environment.
        # But we can use the ainvoke method if provided by langchain wrapper
        if hasattr(search, "ainvoke"):
            raw_results = await search.ainvoke({"query": query})
        else:
            raw_results = search.invoke({"query": query})

        # Sanity check: Compute similarity between web results and document summary
        if document_summaries and len(document_summaries) > 0:
            embedding_svc = EmbeddingService()
            combined_summary = " ".join(document_summaries.values())
            # Use sync embed_query since it's fast or mock async wrap
            summary_vector, _, _ = embedding_svc.embed_query(combined_summary, openai_api_key=openai_api_key, gemini_api_key=gemini_api_key)
            
            def cosine_sim(v1, v2):
                dot = sum(a*b for a,b in zip(v1, v2))
                norm1 = math.sqrt(sum(a*a for a in v1))
                norm2 = math.sqrt(sum(b*b for b in v2))
                if norm1 == 0 or norm2 == 0: return 0.0
                return dot / (norm1 * norm2)

            filtered_results = []
            for res in raw_results:
                content = res.get("content", "")
                if not content: continue
                # Embed result content
                res_vector, _, _ = embedding_svc.embed_query(content, openai_api_key=openai_api_key, gemini_api_key=gemini_api_key)
                sim = cosine_sim(summary_vector, res_vector)
                
                if sim >= 0.3:
                    logger.info(f"Web result '{res.get('title')}' passed sanity check (sim={sim:.3f})")
                    filtered_results.append(res)
                else:
                    logger.info(f"Dropped web result '{res.get('title')}' for being off-topic (sim={sim:.3f})")
                    
            raw_results = filtered_results

        if not raw_results:
            return []

        docs = []
        for res in raw_results:
            title = res.get("title", "Unknown Title")
            url = res.get("url", "Unknown URL")
            content = res.get("content", "")
            
            page_content = f"TITLE: {title}\nURL: {url}\nCONTENT:\n{content}"
            docs.append({
                "page_content": page_content,
                "metadata": {
                    "url": url,
                    "title": title
                }
            })
        return docs
    except Exception as e:
        logger.warning(f"Tavily search failed: {e}")
        return []
