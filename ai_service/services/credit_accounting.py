import math
import logging
import tiktoken
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Mirroring src/lib/creditRates.ts (costs per 1,000 tokens / per minute)
CREDIT_RATES = {
    "gpt-4o": {"input": 5, "output": 15},
    "gemini-2.0-flash": {"input": 1, "output": 3},
    "whisper-1": {"perMinute": 6},
    "embedding-default": {"input": 1},
}

def estimate_prompt_tokens(model: str, messages: List[Any], context_chunks: List[str]) -> int:
    """
    Estimates tokens for a given prompt (messages + context chunks).
    Used ONLY for pre-flight balance checking. This number is never billed.
    """
    total_text = ""
    for msg in messages:
        if isinstance(msg, dict):
            total_text += str(msg.get("content", ""))
        else:
            total_text += str(msg)
            
    for chunk in context_chunks:
        total_text += str(chunk)
        
    if "gpt" in model.lower() or "text-embedding" in model.lower():
        try:
            encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(total_text))
    else:
        # Heuristic for Gemini: approx 3.5 chars per token
        return int(len(total_text) / 3.5)

def credits_for_usage(model: str, prompt_tokens: int, completion_tokens: int) -> int:
    """
    Calculates the actual credit cost based on exact token usage.
    Always rounds up to protect margin.
    """
    rates = CREDIT_RATES.get(model, CREDIT_RATES.get("gpt-4o"))
    input_rate = rates.get("input", 5)
    output_rate = rates.get("output", 15)
    
    cost = (prompt_tokens * input_rate / 1000.0) + (completion_tokens * output_rate / 1000.0)
    return math.ceil(cost)

def credits_for_audio(model: str, duration_seconds: float) -> int:
    """
    Calculates the credit cost for audio processing (Whisper).
    """
    rates = CREDIT_RATES.get(model, CREDIT_RATES.get("whisper-1"))
    per_minute = rates.get("perMinute", 6)
    
    duration_minutes = duration_seconds / 60.0
    return math.ceil(duration_minutes * per_minute)

def extract_usage_openai(response: Any) -> Tuple[int, int]:
    """
    Extracts usage from an OpenAI response object or dict.
    Returns (prompt_tokens, completion_tokens)
    """
    try:
        if hasattr(response, "usage") and response.usage:
            return response.usage.prompt_tokens, response.usage.completion_tokens
        elif isinstance(response, dict) and "usage" in response:
            usage = response["usage"]
            if hasattr(usage, "prompt_tokens"):
                 return usage.prompt_tokens, usage.completion_tokens
            return usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
    except Exception as e:
        logger.warning(f"Failed to extract OpenAI usage: {e}")
    return 0, 0

def extract_usage_gemini(response: Any) -> Tuple[int, int]:
    """
    Extracts usage from a Gemini response.
    Returns (prompt_tokens, completion_tokens)
    """
    try:
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            return getattr(response.usage_metadata, "prompt_token_count", 0), getattr(response.usage_metadata, "candidates_token_count", 0)
        elif isinstance(response, dict) and "usage_metadata" in response:
            usage = response["usage_metadata"]
            return usage.get("prompt_token_count", 0), usage.get("candidates_token_count", 0)
    except Exception as e:
        logger.warning(f"Failed to extract Gemini usage: {e}")
    return 0, 0
