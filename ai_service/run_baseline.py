import asyncio
import httpx
import time
import json

async def run_baseline():
    url = "http://localhost:8000/api/v1/chat"
    payload = {
        "query": "What is IntelliDoc?",
        "workspace_id": "ws_test"
    }
    
    print("Starting 20 baseline queries...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(20):
            print(f"Query {i+1}/20...")
            start = time.perf_counter()
            try:
                # Use stream since the endpoint returns Server-Sent Events
                async with client.stream("POST", url, json=payload) as response:
                    async for chunk in response.aiter_text():
                        pass
                duration = time.perf_counter() - start
                print(f"  Finished in {duration:.3f}s")
            except Exception as e:
                print(f"  Failed: {e}")
            
            await asyncio.sleep(0.5)

if __name__ == "__main__":
    asyncio.run(run_baseline())
