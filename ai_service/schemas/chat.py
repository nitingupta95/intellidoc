from pydantic import BaseModel
from typing import List, Optional, Dict

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

class ResolveRequest(BaseModel):
    pending_id: str
    consent: bool
