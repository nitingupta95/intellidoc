import hashlib
import logging
import uuid
import psycopg2
from redis import Redis
from core.config import settings

logger = logging.getLogger(__name__)

class BloomFilterDedup:
    def __init__(self):
        self.enabled = settings.BLOOM_ENABLED
        self.redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=False)
        self.db_url = settings.DATABASE_URL
        # Note: error_rate and initial_capacity are unused for standard Sets, kept for config compatibility

    def normalize(self, text: str) -> str:
        """Lowercases and collapses whitespace for consistent hashing."""
        return " ".join(text.lower().split())

    def hash_chunk(self, text: str) -> str:
        """Generates SHA-256 hex digest of normalized chunk text."""
        normalized = self.normalize(text)
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    def _get_filter_key(self, workspace_id: str) -> str:
        # Changed prefix from bf: to set: to denote it's a standard set
        return f"set:ws:{workspace_id}"

    def verify_in_db(self, workspace_id: str, chunk_hash: str) -> bool:
        """Verifies if the chunk hash actually exists in PostgreSQL."""
        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'SELECT 1 FROM "ChunkHash" WHERE "workspaceId" = %s AND "chunkHash" = %s LIMIT 1',
                        (workspace_id, chunk_hash)
                    )
                    return cur.fetchone() is not None
        except Exception as e:
            logger.error(f"Error verifying hash in database: {e}")
            # If DB check fails, default to False to re-embed to be safe
            return False

    def filter_duplicates(self, chunks: list[dict], workspace_id: str, document_id: str) -> dict:
        """
        Filters chunks using Redis Sets and PostgreSQL verification.
        Returns a dict with "new" chunks to embed and "skipped" count.
        """
        if not self.enabled:
            return {"new": chunks, "skipped": 0}

        key = self._get_filter_key(workspace_id)
        
        new_chunks = []
        duplicate_chunks = []
        skipped_count = 0

        for chunk in chunks:
            text = chunk.get("content", "")
            if not text:
                continue

            chunk_hash = self.hash_chunk(text)
            
            # 1. Redis Set Check
            try:
                # sismember returns 1 if exists, 0 if not
                might_exist = self.redis_client.sismember(key, chunk_hash)
            except Exception as e:
                logger.error(f"Redis sismember check failed: {e}")
                might_exist = False # Default to processing

            if might_exist:
                # 2. Verification Layer (PostgreSQL)
                if self.verify_in_db(workspace_id, chunk_hash):
                    skipped_count += 1
                    # Ensure chunk hash is in metadata so Qdrant can copy it
                    chunk.setdefault("metadata", {})["chunk_hash"] = chunk_hash
                    duplicate_chunks.append(chunk)
                    logger.debug(f"Skipping duplicate chunk {chunk_hash}")
                    continue

            # 3. If new, inject hash to metadata and keep for embedding
            chunk.setdefault("metadata", {})["chunk_hash"] = chunk_hash
            new_chunks.append(chunk)

        return {
            "new": new_chunks,
            "duplicates": duplicate_chunks,
            "skipped": skipped_count
        }

    def record_new_hashes(self, chunks: list[dict], workspace_id: str, document_id: str):
        """Records hashes of successfully embedded chunks to Redis Set and PostgreSQL."""
        if not self.enabled or not chunks:
            return

        key = self._get_filter_key(workspace_id)
        
        # 1. Add to Redis Set
        hashes_to_add = [c["metadata"]["chunk_hash"] for c in chunks if "metadata" in c and "chunk_hash" in c["metadata"]]
        if hashes_to_add:
            try:
                self.redis_client.sadd(key, *hashes_to_add)
            except Exception as e:
                logger.error(f"Error adding to Redis Set: {e}")

        # 2. Record to PostgreSQL
        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    # Prepare bulk insert
                    # We use ON CONFLICT DO NOTHING just in case
                    args_str = ','.join(cur.mogrify("(%s,%s,%s,%s,%s)", (
                        str(uuid.uuid4()), workspace_id, document_id, h, psycopg2.extensions.AsIs('NOW()')
                    )).decode('utf-8') for h in hashes_to_add)
                    
                    if args_str:
                        cur.execute(f'''
                            INSERT INTO "ChunkHash" (id, "workspaceId", "documentId", "chunkHash", "createdAt") 
                            VALUES {args_str}
                            ON CONFLICT ("workspaceId", "chunkHash") DO NOTHING
                        ''')
        except Exception as e:
            logger.error(f"Error recording hashes to database: {e}")

    def get_stats(self, workspace_id: str) -> dict:
        """Returns stats about the Deduplicator for a given workspace."""
        key = self._get_filter_key(workspace_id)
        exists = self.redis_client.exists(key)
        stats = {
            "workspace_id": workspace_id,
            "redis_set_exists": bool(exists),
            "total_hashes": 0
        }
        
        if exists:
            try:
                stats["items_inserted"] = self.redis_client.scard(key)
                stats["capacity"] = "unlimited"
                stats["size_bytes"] = "unknown (dynamic)"
            except Exception as e:
                logger.error(f"Error getting Redis Set info: {e}")

        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute('SELECT COUNT(*) FROM "ChunkHash" WHERE "workspaceId" = %s', (workspace_id,))
                    stats["total_hashes"] = cur.fetchone()[0]
        except Exception as e:
            logger.error(f"Error getting DB count: {e}")

        return stats

    def rebuild_from_db(self, workspace_id: str):
        """Rebuilds the Redis Set from PostgreSQL records."""
        key = self._get_filter_key(workspace_id)
        
        # Delete existing
        self.redis_client.delete(key)
        
        count = 0
        try:
            with psycopg2.connect(self.db_url) as conn:
                # Use server side cursor for large tables
                with conn.cursor(name="fetch_hashes") as cur:
                    cur.itersize = 2000
                    cur.execute('SELECT "chunkHash" FROM "ChunkHash" WHERE "workspaceId" = %s', (workspace_id,))
                    
                    batch = []
                    pipeline = self.redis_client.pipeline()
                    for row in cur:
                        batch.append(row[0])
                        if len(batch) >= 1000:
                            pipeline.sadd(key, *batch)
                            pipeline.execute()
                            count += len(batch)
                            batch = []
                    if batch:
                        self.redis_client.sadd(key, *batch)
                        count += len(batch)
                        
            logger.info(f"Rebuilt Redis Set for workspace {workspace_id} with {count} items.")
            return {"status": "success", "rebuilt_items": count}
        except Exception as e:
            logger.error(f"Error rebuilding Redis Set: {e}")
            return {"status": "error", "message": str(e)}

# Singleton instance
bloom_dedup = BloomFilterDedup()
