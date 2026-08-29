"""
auth_service.py — Internal service authentication for the FastAPI AI backend.

Security model:
  All legitimate traffic reaches FastAPI through the Next.js API gateway.
  Next.js authenticates the user (NextAuth JWT cookie) and then forwards the
  request to FastAPI with a shared internal secret in the X-Internal-Secret header.

  FastAPI validates this header on every request.  Any call that does not include
  the correct secret is rejected with a 401 — even if it carries a valid user
  session, because it bypassed the gateway.

Why secrets.compare_digest:
  Regular string equality (==) is vulnerable to timing attacks: an attacker can
  measure the response time to infer how many characters of their guess are correct.
  secrets.compare_digest takes constant time regardless of where the strings differ.
"""

import json
import secrets
import logging
from typing import Optional
from fastapi import Header, HTTPException, Request
from core.config import settings

logger = logging.getLogger(__name__)


async def authenticate(
    request: Request,
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
):
    """
    Validates that the request originates from the trusted Next.js gateway.

    Raises HTTP 401 if:
    - The X-Internal-Secret header is missing entirely
    - The header value does not match INTERNAL_SERVICE_SECRET in config

    On success, returns a minimal context dict that route handlers can use
    if they need to log which service made the call.
    """
    if not x_internal_secret:
        logger.warning(
            "Rejected request: missing X-Internal-Secret header | path=%s",
            request.url.path,
        )
        raise HTTPException(
            status_code=401,
            detail="Missing internal secret header. This endpoint is only accessible via the application gateway.",
        )

    # Use secrets.compare_digest to prevent timing-based secret guessing
    if not secrets.compare_digest(x_internal_secret, settings.INTERNAL_SERVICE_SECRET):
        logger.warning(
            "Rejected request: invalid X-Internal-Secret | path=%s",
            request.url.path,
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid internal secret. Access denied.",
        )

    return {"authenticated": True, "gateway": "nextjs"}
