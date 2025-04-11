from fastapi import APIRouter, HTTPException, Header, Request
from github_oauth import exchange_code_for_token, get_user_info
from auth import create_access_token, verify_token
from fastapi.responses import JSONResponse
from models import User, PushLog, Problem, Solution
from database import SessionLocal
from sqlalchemy import select
from datetime import datetime
import logging

auth_router = APIRouter()
logger = logging.getLogger(__name__)

@auth_router.get("/login/github/callback")
async def github_callback(request: Request):
    try:
        code = request.query_params.get("code")
        logger.info(f"Received GitHub code: {code}")
        
        token_data = await exchange_code_for_token(code)
        logger.info(f"GitHub token response: {token_data}")
        
        access_token = token_data.get("access_token")
        if not access_token:
            logger.error(f"No access token in response: {token_data}")
            raise HTTPException(status_code=400, detail="Failed to get GitHub access token")

        user_info = await get_user_info(access_token)
        logger.info(f"GitHub user info: {user_info}")
        
        github_id = str(user_info.get("id"))  # Convert to string to match model
        username = user_info.get("login")
        
        if not github_id or not username:
            logger.error(f"Invalid user info: {user_info}")
            raise HTTPException(status_code=400, detail="Invalid GitHub user info")

        async with SessionLocal() as session:
            result = await session.execute(select(User).where(User.github_id == github_id))
            user = result.scalar_one_or_none()

            now = datetime.now()

            if not user:
                logger.info(f"Creating new user: {username}")
                user = User(
                    github_id=github_id,
                    username=username,
                    access_token=access_token,
                    last_login=now,
                    last_push=None
                )
                session.add(user)
            else:
                logger.info(f"Updating existing user: {username}")
                user.access_token = access_token
                user.last_login = now
            await session.commit()

        jwt_token = create_access_token({"github_id": github_id})
        
        response_data = {
            "message": "GitHub login successful",
            "token": jwt_token,
            "username": username,
            "last_push": user.last_push.isoformat() if user.last_push else None,
            "last_login": user.last_login.isoformat() if user.last_login else None
        }
        logger.info(f"Login successful for user: {username}")
        return JSONResponse(response_data)
        
    except Exception as e:
        logger.exception("Error in GitHub callback:")
        raise HTTPException(status_code=500, detail=str(e))
    
async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return payload