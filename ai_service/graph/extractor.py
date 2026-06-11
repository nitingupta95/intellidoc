import json
import logging
from typing import List, Dict, Any, Tuple
import asyncio
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from graph.neo4j_client import neo4j_client
from core.config import settings

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """You are a knowledge graph extraction engine.
Extract all named entities and relationships from the provided text.

Entity types to extract:
PERSON, ORGANIZATION, LOCATION, CONCEPT, PRODUCT, EVENT, DATE, METRIC, TOPIC

Relationship types to use:
RELATED_TO, PART_OF, CAUSES, MENTIONS, WORKS_FOR, LOCATED_IN, CREATED_BY, DEFINES, CONTRADICTS, SUPPORTS

Rules:
- Normalise entity names: capitalise properly, resolve pronouns if possible
- Only extract relationships that are EXPLICITLY stated in the text
- Each entity needs: name, type, description (1 sentence)
- Each relationship needs: source entity name, target entity name, type, context sentence
- Minimum entity name length: 2 characters
- Maximum entities per chunk: 15
- Maximum relationships per chunk: 20

Return ONLY valid JSON matching this schema exactly:
{{
  "entities": [
    {{ "name": "string", "type": "ENTITY_TYPE", "description": "string" }}
  ],
  "relationships": [
    {{ "source": "entity name", "target": "entity name", "type": "REL_TYPE", "context": "sentence from text" }}
  ]
}}"""

async def with_retry(func, retries=3):
    import time
    for attempt in range(retries + 1):
        try:
            return await func()
        except Exception as e:
            if attempt == retries:
                raise e
            logger.warning(f"Retry {attempt + 1}/{retries} due to error: {e}")
            await asyncio.sleep(2 ** attempt)

async def extract_and_store_graph_from_chunk(chunk_text: str, doc_id: str, user_id: str, chunk_idx: int, api_key: str = None) -> Tuple[int, int]:
    # 1. Skip very short chunks
    if len(chunk_text.strip()) < 50:
        return 0, 0

    # 2. Extract via LLM
    key = api_key or settings.OPENAI_API_KEY
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=key)
    parser = JsonOutputParser()
    prompt = ChatPromptTemplate.from_messages([
        ("system", EXTRACTION_SYSTEM_PROMPT),
        ("human", "Extract entities and relationships from:\n\n{text}")
    ])
    chain = prompt | model | parser

    try:
        async def _invoke():
            return await chain.ainvoke({"text": chunk_text[:3000]})
        extraction = await with_retry(_invoke)
    except Exception as e:
        logger.warning(f"graph_extraction_failed — skipping chunk {chunk_idx} of doc {doc_id}: {e}")
        return 0, 0

    entities = extraction.get("entities", [])
    relationships = extraction.get("relationships", [])

    if not entities:
        return 0, 0

    # 3. Store entities in Neo4j
    entities_added = 0
    for entity in entities:
        name = entity.get("name")
        ent_type = entity.get("type")
        description = entity.get("description", "")
        
        if not name or not ent_type:
            continue
            
        norm_name = str(name).strip()[:200]
        
        query = """
        MERGE (e:Entity { name: $name, userId: $userId })
        ON CREATE SET
          e.id          = randomUUID(),
          e.type        = $type,
          e.description = $description,
          e.frequency   = 1,
          e.docIds      = [$docId],
          e.createdAt   = datetime()
        ON MATCH SET
          e.frequency   = e.frequency + 1,
          e.docIds      = CASE WHEN $docId IN e.docIds THEN e.docIds
                               ELSE e.docIds + [$docId] END,
          e.updatedAt   = datetime()
        """
        try:
            neo4j_client.run_query(query, {
                "name": norm_name, "userId": user_id, "type": ent_type, 
                "description": description, "docId": doc_id
            })
            entities_added += 1
        except Exception as e:
            logger.warning(f"entity_merge_failed for {norm_name}: {e}")

    # 4. Store relationships
    relationships_added = 0
    for rel in relationships:
        source = rel.get("source")
        target = rel.get("target")
        rel_type = rel.get("type")
        context = rel.get("context", "")
        
        if not source or not target or not rel_type:
            continue
            
        query = """
        MATCH (a:Entity { name: $source, userId: $userId })
        MATCH (b:Entity { name: $target, userId: $userId })
        MERGE (a)-[r:RELATES { type: $relType }]->(b)
        ON CREATE SET
          r.weight  = 1,
          r.docIds  = [$docId],
          r.context = $context,
          r.createdAt = datetime()
        ON MATCH SET
          r.weight  = r.weight + 1,
          r.docIds  = CASE WHEN $docId IN r.docIds THEN r.docIds
                           ELSE r.docIds + [$docId] END,
          r.updatedAt = datetime()
        """
        try:
            neo4j_client.run_query(query, {
                "source": str(source).strip(), "target": str(target).strip(),
                "userId": user_id, "relType": rel_type, 
                "docId": doc_id, "context": context
            })
            relationships_added += 1
        except Exception as e:
            logger.warning(f"relationship_merge_failed for {source}->{target}: {e}")

    logger.info(f"graph_extraction_complete: doc={doc_id} chunk={chunk_idx} entities={entities_added} rels={relationships_added}")
    return entities_added, relationships_added

async def extract_graph_from_document(doc_id: str, user_id: str, chunks: List[Dict[str, Any]], api_key: str = None):
    total_entities = 0
    total_rels = 0
    
    batch_size = 5
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        tasks = []
        for chunk in batch:
            chunk_text = chunk.get("text", "")
            chunk_idx = chunk.get("chunk_idx", 0)
            tasks.append(extract_and_store_graph_from_chunk(chunk_text, doc_id, user_id, chunk_idx, api_key))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, tuple) and len(r) == 2:
                total_entities += r[0]
                total_rels += r[1]
                
        if i + batch_size < len(chunks):
            await asyncio.sleep(0.5)
            
    logger.info(f"document_graph_extraction_done: doc={doc_id} user={user_id} entities={total_entities} rels={total_rels}")
