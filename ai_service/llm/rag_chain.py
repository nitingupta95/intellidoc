from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
from core.config import settings

class RAGChain:
    def __init__(self):
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are IntelliDoc AI, an expert document intelligence assistant. Answer the user's question based strictly on the following context. If you don't know the answer based on the context, say so. Always cite your sources.\n\nContext:\n{context}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])

    def _get_chain(self, openai_api_key: str = None, gemini_api_key: str = None):
        if openai_api_key:
            llm = ChatOpenAI(
                model="gpt-4o", 
                temperature=0,
                openai_api_key=openai_api_key
            )
        elif gemini_api_key:
            llm = ChatGoogleGenerativeAI(
                model="gemini-1.5-pro",
                temperature=0,
                google_api_key=gemini_api_key
            )
        else:
            # Fallback
            key = settings.OPENAI_API_KEY
            llm = ChatOpenAI(
                model="gpt-4o", 
                temperature=0,
                openai_api_key=key
            )
            
        return self.prompt | llm | StrOutputParser()

    async def stream_answer(self, question: str, retrieved_docs: list[str], history: list[dict] = None, openai_api_key: str = None, gemini_api_key: str = None):
        """
        Streams the response back.
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

        chain = self._get_chain(openai_api_key, gemini_api_key)
        async for chunk in chain.astream({"context": context_str, "history": lc_history, "question": question}):
            yield chunk

