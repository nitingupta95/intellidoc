from pydantic import BaseModel
from typing import List, Optional, Dict, Literal

class ChatRequest(BaseModel):
    query: str
    workspace_id: str
    knowledge_base_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    history: Optional[List[dict]] = None
    # Phase 3 metadata filters
    team_id: Optional[str] = None
    department: Optional[str] = None
    project: Optional[str] = None
    
    # Document auto-summaries passed from the Next.js backend
    document_summaries: Optional[Dict[str, str]] = None

    # Chat mode declared by the gateway.
    # "single_doc"      — user is chatting with exactly one document.
    # "knowledge_base"  — user is chatting across a KB (possibly many docs).
    # None              — legacy clients; controller infers from document_ids length.
    context_type: Optional[Literal["single_doc", "knowledge_base"]] = None

class ResolveRequest(BaseModel):
    pending_id: str
    consent: bool
