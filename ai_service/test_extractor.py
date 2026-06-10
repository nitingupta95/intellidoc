import asyncio
import logging
import sys
from dotenv import load_dotenv

load_dotenv("../.env")

logging.basicConfig(level=logging.INFO)

from graph.extractor import extract_and_store_graph_from_chunk

async def main():
    text = "John Doe works for OpenAI in San Francisco. He is an engineer."
    entities, rels = await extract_and_store_graph_from_chunk(text, "test_doc_id", "test_user_id", 1)
    print(f"Entities: {entities}, Rels: {rels}")

if __name__ == "__main__":
    asyncio.run(main())
