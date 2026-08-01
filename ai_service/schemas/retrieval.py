from pydantic import BaseModel

class RetrieveRequest(BaseModel):
    query: str
    workspace_id: str
    limit: int = 5
