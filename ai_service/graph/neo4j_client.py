from neo4j import GraphDatabase
import logging
from core.config import settings

logger = logging.getLogger(__name__)

class Neo4jClient:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI, 
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
        logger.info(f"neo4j_driver_created URI: {settings.NEO4J_URI}")

    def close(self):
        if self.driver:
            self.driver.close()

    def run_query(self, cypher: str, parameters: dict = None):
        """Run a Cypher query and return the list of records."""
        with self.driver.session(database=getattr(settings, "NEO4J_DATABASE", "neo4j")) as session:
            try:
                result = session.run(cypher, parameters or {})
                return [record.data() for record in result]
            except Exception as e:
                logger.error(f"neo4j_query_error: {e} - query: {cypher[:100]}")
                raise e

    def init_graph_schema(self):
        """Create constraints and indexes required for the Knowledge Graph.
        Each statement is wrapped individually so one failure doesn't block the rest.
        Neo4j Community Edition does not support composite constraints, so we fall back gracefully.
        """
        logger.info("Creating Neo4j constraints and indexes...")
        
        statements = [
            "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
            "CREATE CONSTRAINT entity_name_user IF NOT EXISTS FOR (e:Entity) REQUIRE (e.name, e.userId) IS UNIQUE",
            "CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (e:Entity) ON EACH [e.name, e.description]",
            "CREATE INDEX entity_type_user IF NOT EXISTS FOR (e:Entity) ON (e.type, e.userId)",
            "CREATE INDEX entity_userid IF NOT EXISTS FOR (e:Entity) ON (e.userId)",
            "CREATE INDEX rel_docids IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.docIds)",
        ]
        
        for stmt in statements:
            try:
                self.run_query(stmt)
            except Exception as e:
                logger.warning(f"Schema statement skipped (may not be supported): {stmt[:60]}... — {e}")
        
        logger.info("✓ Neo4j schema initialisation complete")

neo4j_client = Neo4jClient()

