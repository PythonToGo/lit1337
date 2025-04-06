from fastapi import APIRouter, HTTPException, Header, Request
from github_oauth import exchange_code_for_token, get_user_info
from auth import create_access_token, verify_token
from fastapi.responses import JSONResponse
from models import User, PushLog, Problem, Solution
from database import SessionLocal
from sqlalchemy import select
from datetime import datetime

auth_router = APIRouter()

@auth_router.get("/login/github/callback")
async def github_callback(request: Request):
    code = request.query_params.get("code")
    token_data = await exchange_code_for_token(code)
    access_token = token_data.get("access_token")

    user_info = await get_user_info(access_token)
    github_id = user_info.get("id")
    username = user_info.get("login")

    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.github_id == github_id))
        user = result.scalar_one_or_none()

        if not user:
            user = User(github_id=github_id, username=username, access_token=access_token)
            session.add(user)
        else:
            user.access_token = access_token
            user.last_push = datetime.now()
            user.last_login = datetime.now()
        await session.commit()

    jwt_token = create_access_token({"github_id": github_id})
    
    # chrome URL redirect with JWT
    return JSONResponse({
        "message": "GitHub login successful",
        "token": jwt_token,
        "username": username,
        "last_push": user.last_push
    })
async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return payload