from pydantic import BaseModel
from typing import List, Optional

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

class ResolveRequest(BaseModel):
    pending_id: str
    consent: bool
