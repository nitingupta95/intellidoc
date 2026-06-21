import hashlib
import logging
import uuid
import psycopg2
from redis import Redis
from redis.commands.bf.info import BFInfo
from core.config import settings

logger = logging.getLogger(__name__)

class BloomFilterDedup:
    def __init__(self):
        self.enabled = settings.BLOOM_ENABLED
        self.redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=False)
        self.db_url = settings.DATABASE_URL
        self.error_rate = settings.BLOOM_ERROR_RATE
        self.initial_capacity = settings.BLOOM_INITIAL_CAPACITY

    def normalize(self, text: str) -> str:
        """Lowercases and collapses whitespace for consistent hashing."""
        return " ".join(text.lower().split())

    def hash_chunk(self, text: str) -> str:
        """Generates SHA-256 hex digest of normalized chunk text."""
        normalized = self.normalize(text)
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    def _get_filter_key(self, workspace_id: str) -> str:
        return f"bf:ws:{workspace_id}"

    def _ensure_filter_exists(self, workspace_id: str):
        """Ensures the Bloom Filter exists in Redis for the workspace."""
        key = self._get_filter_key(workspace_id)
        # Check if exists using generic redis EX command
        if not self.redis_client.exists(key):
            try:
                self.redis_client.bf().reserve(
                    key, 
                    self.error_rate, 
                    self.initial_capacity
                )
                logger.info(f"Created new Bloom Filter for workspace {workspace_id}")
            except Exception as e:
                # If it already exists (race condition), it will raise an error we can ignore
                if "Item exists" not in str(e):
                    logger.error(f"Error creating Bloom Filter: {e}")

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
        Filters chunks using the Bloom Filter and PostgreSQL verification.
        Returns a dict with "new" chunks to embed and "skipped" count.
        """
        if not self.enabled:
            return {"new": chunks, "skipped": 0}

        self._ensure_filter_exists(workspace_id)
        key = self._get_filter_key(workspace_id)
        bf = self.redis_client.bf()
        
        new_chunks = []
        duplicate_chunks = []
        skipped_count = 0

        for chunk in chunks:
            text = chunk.get("content", "")
            if not text:
                continue

            chunk_hash = self.hash_chunk(text)
            
            # 1. Bloom Filter Check
            try:
                # Check if hash is probably in the filter
                might_exist = bf.exists(key, chunk_hash)
            except Exception as e:
                logger.error(f"Bloom Filter exists check failed: {e}")
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
        """Records hashes of successfully embedded chunks to Redis and PostgreSQL."""
        if not self.enabled or not chunks:
            return

        key = self._get_filter_key(workspace_id)
        bf = self.redis_client.bf()
        
        # 1. Add to Redis Bloom Filter
        hashes_to_add = [c["metadata"]["chunk_hash"] for c in chunks if "metadata" in c and "chunk_hash" in c["metadata"]]
        if hashes_to_add:
            try:
                bf.madd(key, *hashes_to_add)
            except Exception as e:
                logger.error(f"Error adding to Bloom Filter: {e}")

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
        """Returns stats about the Bloom filter for a given workspace."""
        key = self._get_filter_key(workspace_id)
        exists = self.redis_client.exists(key)
        stats = {
            "workspace_id": workspace_id,
            "bloom_filter_exists": bool(exists),
            "total_hashes": 0
        }
        
        if exists:
            try:
                bf = self.redis_client.bf()
                info = bf.info(key)
                stats["items_inserted"] = info.get("insertedNum")
                stats["capacity"] = info.get("capacity")
                stats["size_bytes"] = info.get("size")
            except Exception as e:
                logger.error(f"Error getting Bloom Filter info: {e}")

        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute('SELECT COUNT(*) FROM "ChunkHash" WHERE "workspaceId" = %s', (workspace_id,))
                    stats["total_hashes"] = cur.fetchone()[0]
        except Exception as e:
            logger.error(f"Error getting DB count: {e}")

        return stats

    def rebuild_from_db(self, workspace_id: str):
        """Rebuilds the Redis Bloom filter from PostgreSQL records."""
        key = self._get_filter_key(workspace_id)
        
        # Delete existing
        self.redis_client.delete(key)
        self._ensure_filter_exists(workspace_id)
        
        bf = self.redis_client.bf()
        count = 0
        try:
            with psycopg2.connect(self.db_url) as conn:
                # Use server side cursor for large tables
                with conn.cursor(name="fetch_hashes") as cur:
                    cur.itersize = 2000
                    cur.execute('SELECT "chunkHash" FROM "ChunkHash" WHERE "workspaceId" = %s', (workspace_id,))
                    
                    batch = []
                    for row in cur:
                        batch.append(row[0])
                        if len(batch) >= 1000:
                            bf.madd(key, *batch)
                            count += len(batch)
                            batch = []
                    if batch:
                        bf.madd(key, *batch)
                        count += len(batch)
                        
            logger.info(f"Rebuilt Bloom Filter for workspace {workspace_id} with {count} items.")
            return {"status": "success", "rebuilt_items": count}
        except Exception as e:
            logger.error(f"Error rebuilding Bloom filter: {e}")
            return {"status": "error", "message": str(e)}

# Singleton instance
bloom_dedup = BloomFilterDedup()
