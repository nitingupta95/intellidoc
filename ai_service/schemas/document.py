from pydantic import BaseModel
from typing import Optional

class DocumentProcessRequest(BaseModel):
    document_id: str
    file_path: str
    workspace_id: str
    knowledge_base_id: Optional[str] = None
    uploaded_by: str
    metadata: dict = {}
