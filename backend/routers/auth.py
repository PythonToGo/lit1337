from fastapi import APIRouter, HTTPException, Header, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import User, PushLog, Problem, Solution
from database import SessionLocal, get_db
from github_oauth import exchange_code_for_token, get_user_info
from auth import create_access_token, verify_token, create_jwt_token
from fastapi.responses import JSONResponse, Response
import jwt
from datetime import datetime, timedelta
import json


auth_router = APIRouter()
logger = logging.getLogger(__name__)

@auth_router.get("/login/github/callback")

async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    try:
        print(f"🚀 Processing GitHub callback with code: {code[:10]}...")
        
        # Exchange code for GitHub access token
        token_data = await exchange_code_for_token(code)
        print(f"📦 Raw token data received: {token_data}")  # Log the raw token data
        
        access_token = token_data.get("access_token")
        if not access_token:
            print("❌ No access token received from GitHub")
            print(f"Available fields in token_data: {list(token_data.keys())}")
            raise HTTPException(status_code=400, detail="Failed to get GitHub access token")
        
        # Debug log the access token
        print(f"✅ DEBUG - FULL ACCESS TOKEN: {access_token}")

        # Get GitHub user info
        user_info = await get_user_info(access_token)
        if not user_info or "id" not in user_info:
            print(f"❌ Invalid user info received: {user_info}")
            raise HTTPException(status_code=400, detail="Failed to get GitHub user info")

        github_id = str(user_info["id"])  # Convert to string to ensure consistent type
        username = user_info["login"]
        print(f"👤 Processing user: {username} (ID: {github_id})")

        # Find or create user
        result = await db.execute(select(User).where(User.github_id == github_id))
        user = result.scalar_one_or_none()

        if user:
            print(f"🔄 Updating existing user: {username}")
            user.username = username
            user.access_token = access_token
            user.last_login = datetime.utcnow()
        else:
            print(f"➕ Creating new user: {username}")
            user = User(
                github_id=github_id,
                username=username,
                access_token=access_token,
                last_login=datetime.utcnow()
            )
            db.add(user)

        await db.commit()
        await db.refresh(user)

        # Create JWT token
        jwt_token = create_jwt_token({"github_id": github_id})
        
        # Format dates for the response
        last_login_str = user.last_login.isoformat() if user.last_login else None
        last_push_str = user.last_push.isoformat() if user.last_push else None
        
        # Log the final access token for verification
        print(f"✅ Final TOKEN: {jwt_token}")
        print(f"✅ Final ACCESS_TOKEN: {access_token}")
        print(f"✅ Final USERNAME: {username}")
        
        # ULTRA DIRECT APPROACH: Create the JSON with string concatenation to ensure exact control
        # This bypasses all JSON serialization frameworks and guarantees field order and inclusion 
        ultra_direct_json = """{
  "message": "GitHub login successful",
  "token": "TOKEN_VALUE",
  "access_token": "ACCESS_TOKEN_VALUE",
  "username": "USERNAME_VALUE",
  "last_login": "LAST_LOGIN_VALUE",
  "last_push": LAST_PUSH_VALUE
}""".replace("TOKEN_VALUE", jwt_token) \
   .replace("ACCESS_TOKEN_VALUE", access_token) \
   .replace("USERNAME_VALUE", username) \
   .replace("LAST_LOGIN_VALUE", last_login_str if last_login_str else "") \
   .replace("LAST_PUSH_VALUE", "null" if last_push_str is None else f'"{last_push_str}"')
        
        # Double-check our response has the access_token
        print(f"✅ Response size: {len(ultra_direct_json)} bytes")
        print(f"✅ Response contains access_token field: {'access_token' in ultra_direct_json}")
        print(f"✅ Response contains actual token: {access_token in ultra_direct_json}")
        print(f"✅ First 100 chars of response: {ultra_direct_json[:100]}")
        
        # Return the raw JSON string directly
        from fastapi.responses import Response
        return Response(
            content=ultra_direct_json,
            media_type="application/json",
            headers={"X-Contains-Access-Token": "true"}  # Add a marker header
        )

    except Exception as e:
        print(f"❌ Error in GitHub callback: {str(e)}")
        print(f"❌ Exception type: {type(e)}")
        print(f"❌ Exception args: {getattr(e, 'args', [])}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return payload