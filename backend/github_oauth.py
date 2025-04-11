import os
import httpx
import logging
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
    logger.error("GitHub OAuth credentials missing!")
    logger.error(f"GITHUB_CLIENT_ID: {'present' if GITHUB_CLIENT_ID else 'missing'}")
    logger.error(f"GITHUB_CLIENT_SECRET: {'present' if GITHUB_CLIENT_SECRET else 'missing'}")
    raise ValueError("❌ GitHub OAuth credentials not found")

async def exchange_code_for_token(code: str):
    if not code:
        raise HTTPException(status_code=400, detail="GitHub code is required")
        
    try:
        async with httpx.AsyncClient() as client:
            logger.info(f"Exchanging code for token with GitHub")
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code
                }
            )
            response.raise_for_status()
            data = response.json()
            logger.info("Successfully exchanged code for token")
            return data
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during token exchange: {str(e)}")
        logger.error(f"Response status: {e.response.status_code if hasattr(e, 'response') else 'unknown'}")
        logger.error(f"Response body: {e.response.text if hasattr(e, 'response') else 'unknown'}")
        raise HTTPException(status_code=500, detail=f"GitHub API error: {str(e)}")
    except Exception as e:
        logger.exception("Error exchanging code for token:")
        raise HTTPException(status_code=500, detail=str(e))

async def get_user_info(access_token: str):
    if not access_token:
        raise HTTPException(status_code=400, detail="Access token is required")
        
    try:
        async with httpx.AsyncClient() as client:
            logger.info("Fetching user info from GitHub")
            response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            data = response.json()
            logger.info("Successfully fetched user info")
            return data
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching user info: {str(e)}")
        logger.error(f"Response status: {e.response.status_code if hasattr(e, 'response') else 'unknown'}")
        logger.error(f"Response body: {e.response.text if hasattr(e, 'response') else 'unknown'}")
        raise HTTPException(status_code=500, detail=f"GitHub API error: {str(e)}")
    except Exception as e:
        logger.exception("Error fetching user info:")
        raise HTTPException(status_code=500, detail=str(e))
