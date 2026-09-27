import logging

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
from core.config import settings

logger = logging.getLogger(__name__)


def _is_openai_quota_error(exc: Exception) -> bool:
    """Return True if the exception is an OpenAI 429 / credit-exhausted error."""
    s = str(exc).lower()
    return "429" in s or "insufficient_quota" in s or "credit_balance_exhausted" in s

class RAGChain:
    def __init__(self):
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are IntelliDoc AI, an expert document intelligence assistant. Answer the user's question based strictly on the following context. The context may contain live web search results or internal documents; you MUST use this provided context to answer questions about recent events or real-time data instead of mentioning your knowledge cutoff date. If the user asks for a summary or overview of the document, provide a comprehensive summary based on the provided context chunks, even if they only represent a portion of the document, and do NOT complain about missing information. If you otherwise don't know the answer based on the context, say so. Always cite your sources. MUST format your response in rich Markdown, using newlines, bold text, and bullet points to make it highly readable and well-structured.\n\nContext:\n{context}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])
        
        self.conservative_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are IntelliDoc AI, an expert document intelligence assistant. The user has explicitly chosen to restrict your knowledge to the provided documents ONLY. Be extremely conservative. If the provided context does not fully answer the question, state exactly what is missing and what you CAN answer based on the context. EXCEPTION: If the user asks for a summary or overview of the document, provide a comprehensive summary based on the provided context chunks, even if they only represent a portion of the document, and do NOT complain about missing information. Answer strictly based on the following context. Always cite your sources. MUST format your response in rich Markdown.\n\nContext:\n{context}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])

        # ── Multi-hop / multi-doc synthesis prompt ───────────────────────────
        # Context arrives pre-grouped by source document so the model can draw
        # distinct facts from each doc without silently over-weighting one source.
        # Each section is introduced with a document label so the model can
        # inline-cite every factual claim precisely.
        self.multi_doc_prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are IntelliDoc AI, an expert document intelligence assistant.\n"
             "The context below was retrieved across MULTIPLE documents using "
             "multi-hop retrieval. Each section is clearly labelled with its source document name.\n\n"
             "STRICT RULES — follow every one of these:\n"
             "1. Draw facts from ALL labelled document sections. "
             "Do NOT favour the first section or whichever section appears longest.\n"
             "2. You MUST inline-cite the source document by name for EVERY individual factual "
             "claim you make. Format: \"[Document: <name>]\". Do not batch citations at the end — "
             "cite inline, immediately after the fact.\n"
             "3. If facts from different documents conflict, state BOTH versions with their "
             "source names and explicitly flag the discrepancy.\n"
             "4. If information needed to fully answer the question is absent from all sections, "
             "say so explicitly. Do not guess or hallucinate missing data.\n"
             "5. Format your response in rich Markdown: bold text, bullet points, and clear "
             "section headings where appropriate.\n"
             "6. If the context is prefixed with [PARTIAL_RETRIEVAL], prepend a ⚠️ callout: "
             "\"**Note:** This answer may be incomplete — retrieval stopped before every part of the question was confirmed.\"\n\n"
             "Context (grouped by source document):\n{context}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ])



    def _get_llm(self, openai_api_key: str = None, gemini_api_key: str = None):
        """Return the streaming LLM instance (shared by all chain variants).
        
        When an OpenAI key is provided, we try OpenAI first.  But if the key is
        credit-exhausted (429), the *calling* code may catch the error; here we
        simply return the best available LLM.  For eager fallback at query time,
        see _get_llm_with_fallback().
        """
        if openai_api_key:
            return ChatOpenAI(
                model="gpt-4o",
                temperature=0,
                openai_api_key=openai_api_key,
                stream_usage=True,
            )
        if gemini_api_key:
            return ChatGoogleGenerativeAI(
                model=settings.GEMINI_CHAT_MODEL,
                temperature=0,
                google_api_key=gemini_api_key,
            )
        # System-level fallback: prefer Gemini if OpenAI env key is empty/missing
        if settings.OPENAI_API_KEY:
            return ChatOpenAI(
                model="gpt-4o",
                temperature=0,
                openai_api_key=settings.OPENAI_API_KEY,
                stream_usage=True,
            )
        if settings.GEMINI_API_KEY:
            return ChatGoogleGenerativeAI(
                model=settings.GEMINI_CHAT_MODEL,
                temperature=0,
                google_api_key=settings.GEMINI_API_KEY,
            )
        raise ValueError("No LLM API key available (neither OpenAI nor Gemini)")

    def _get_fallback_llm(self, gemini_api_key: str = None, openai_api_key: str = None):
        """Return a Gemini LLM for use when OpenAI is quota-exhausted.

        A BYOK user's exhausted OpenAI key only falls back to THEIR Gemini key —
        never the system one, which would be unbilled system usage.
        """
        key = gemini_api_key or (None if openai_api_key else settings.GEMINI_API_KEY)
        if key:
            return ChatGoogleGenerativeAI(
                model=settings.GEMINI_CHAT_MODEL,
                temperature=0,
                google_api_key=key,
            )
        return None

    def _get_chain(self, openai_api_key: str = None, gemini_api_key: str = None, conservative: bool = False):
        llm = self._get_llm(openai_api_key, gemini_api_key)
        active_prompt = self.conservative_prompt if conservative else self.prompt
        return active_prompt | llm

    async def stream_answer(self, question: str, retrieved_docs: list[str], history: list[dict] = None, openai_api_key: str = None, gemini_api_key: str = None, conservative: bool = False):
        """
        Streams the response back.  Auto-falls-back to Gemini on OpenAI quota errors.
        """
        context_str = "\n\n---\n\n".join(retrieved_docs)
        
        # Convert raw history dicts to Langchain Message objects
        lc_history = []
        if history:
            for msg in history:
                if msg.get("role") == "user":
                    lc_history.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    lc_history.append(AIMessage(content=msg.get("content", "")))

        invoke_args = {"context": context_str, "history": lc_history, "question": question}
        active_prompt = self.conservative_prompt if conservative else self.prompt

        # Try primary LLM
        llm = self._get_llm(openai_api_key, gemini_api_key)
        chain = active_prompt | llm
        try:
            async for chunk in chain.astream(invoke_args):
                if chunk.content:
                    yield chunk.content
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                    yield {"usage_metadata": chunk.usage_metadata}
            return  # success — done
        except Exception as exc:
            if not _is_openai_quota_error(exc):
                raise

        # Fallback to Gemini
        fallback = self._get_fallback_llm(gemini_api_key, openai_api_key)
        if not fallback:
            raise ValueError("OpenAI credits exhausted and no Gemini API key available for fallback")
        logger.warning("OpenAI LLM quota exhausted — falling back to Gemini for answer generation")
        chain = active_prompt | fallback
        async for chunk in chain.astream(invoke_args):
            if chunk.content:
                yield chunk.content
            if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                yield {"usage_metadata": chunk.usage_metadata}

    async def stream_answer_multi_doc(
        self,
        question: str,
        chunks_by_doc: dict,          # {docLabel: [chunk_text, ...]}
        history: list[dict] = None,
        openai_api_key: str = None,
        gemini_api_key: str = None,
        partial: bool = False,        # True when the hop loop ended without judge done=True
    ):
        """
        Multi-hop / multi-doc synthesis variant.

        Formats context with explicit per-document headers so the model treats
        each source equally instead of silently favouring the first flat block.

        When partial=True the context block is prefixed with a PARTIAL_RETRIEVAL
        marker that the prompt's Rule 6 turns into a visible ⚠️ warning.

        Format fed to the prompt:
            ════════════════════════════════
            From Document: <label>
            ════════════════════════════════
            <chunk1>

            <chunk2>

            ════════════════════════════════
            From Document: <label2>
            ...
        """
        DIVIDER = "═" * 48
        sections = []
        for doc_label, texts in chunks_by_doc.items():
            header = f"{DIVIDER}\nFrom Document: {doc_label}\n{DIVIDER}"
            body = "\n\n".join(t for t in texts if t.strip())
            sections.append(f"{header}\n{body}")
        context_str = "\n\n".join(sections)

        # Prepend PARTIAL marker so Rule 6 fires inside the model
        if partial:
            context_str = "[PARTIAL_RETRIEVAL — hop loop stopped before the judge confirmed sufficiency]\n\n" + context_str

        # Convert history
        lc_history = []
        if history:
            for msg in history:
                if msg.get("role") == "user":
                    lc_history.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    lc_history.append(AIMessage(content=msg.get("content", "")))

        invoke_args = {"context": context_str, "history": lc_history, "question": question}

        # Try primary LLM
        llm = self._get_llm(openai_api_key, gemini_api_key)
        chain = self.multi_doc_prompt | llm
        try:
            async for chunk in chain.astream(invoke_args):
                if chunk.content:
                    yield chunk.content
                if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                    yield {"usage_metadata": chunk.usage_metadata}
            return  # success — done
        except Exception as exc:
            if not _is_openai_quota_error(exc):
                raise

        # Fallback to Gemini
        fallback = self._get_fallback_llm(gemini_api_key, openai_api_key)
        if not fallback:
            raise ValueError("OpenAI credits exhausted and no Gemini API key available for fallback")
        logger.warning("OpenAI LLM quota exhausted — falling back to Gemini for multi-doc synthesis")
        chain = self.multi_doc_prompt | fallback
        async for chunk in chain.astream(invoke_args):
            if chunk.content:
                yield chunk.content
            if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                yield {"usage_metadata": chunk.usage_metadata}

    async def generate_summary_and_questions(self, text: str, openai_api_key: str = None, gemini_api_key: str = None):
        """
        Generates a summary and 3-5 suggested questions from document text.
        """
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert document summarizer. Read the following text extracted from a document. Return a JSON object with exactly two keys:\n1. 'summary': A concise 3-5 sentence summary of the text.\n2. 'suggestedQuestions': A list of 3-5 questions a user might ask about this document.\nDo not return any markdown blocks or other text, ONLY valid JSON.\n\nText:\n{text}")
        ])
        
        llm = None
        if openai_api_key:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=openai_api_key)
        elif gemini_api_key:
            llm = ChatGoogleGenerativeAI(model=settings.GEMINI_FAST_MODEL, temperature=0, google_api_key=gemini_api_key)
        else:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=settings.OPENAI_API_KEY)
            
        chain = prompt | llm | StrOutputParser()
        response = await chain.ainvoke({"text": text})
        
        # Clean response in case LLM wraps it in markdown block
        clean_json = response.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
            
        import json
        try:
            return json.loads(clean_json.strip())
        except Exception as e:
            print("Failed to parse JSON for summary:", e)
            return {"summary": "Unable to generate summary.", "suggestedQuestions": []}

    async def summarize_history(self, history: list[dict], openai_api_key: str = None, gemini_api_key: str = None) -> str:
        """
        Compresses a long chat history into a single summary.
        """
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert conversation summarizer. Provide a concise summary of the following chat history. The summary should capture the user's main goals, key questions asked, and the assistant's core answers. Do not output anything other than the summary."),
            ("human", "Chat History:\n{history_str}")
        ])
        
        history_str = "\n".join([f"{msg.get('role')}: {msg.get('content')}" for msg in history])
        
        llm = None
        if openai_api_key:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=openai_api_key)
        elif gemini_api_key:
            llm = ChatGoogleGenerativeAI(model=settings.GEMINI_FAST_MODEL, temperature=0, google_api_key=gemini_api_key)
        else:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=settings.OPENAI_API_KEY)
            
        chain = prompt | llm | StrOutputParser()
        return await chain.ainvoke({"history_str": history_str})

