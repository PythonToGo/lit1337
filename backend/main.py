import os
import models
from init_db import init_db
from dotenv import load_dotenv
from urllib.parse import urlencode
from fastapi import FastAPI, Header, HTTPException, Depends, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from auth import create_access_token, verify_token, get_current_user
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, PushLog
from database import SessionLocal, get_db
from github_oauth import exchange_code_for_token, get_user_info
from github_push import push_code_to_github
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # allow_origins=["https://leetcode.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await init_db()
    
@app.get("/me")
async def read_me(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return {"users": [u.username for u in users]}


@app.get("/login/github/callback")
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

        await session.commit()

    jwt_token = create_access_token({"github_id": github_id})
    
    # chrome URL redirect with JWT
    return JSONResponse({
        "message": "GitHub login successful",
        "token": jwt_token,
        "username": username
    })
async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return payload

from fastapi import status  # 상단에 추가

@app.post("/push-code")
async def push_code(data: dict, user=Depends(get_current_user)):
    filename = data.get("filename")
    code = data.get("code")
    language = filename.split(".")[-1]

    github_id = user.get("github_id")

    # 유저 조회
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.github_id == github_id))
        user_obj = result.scalar_one_or_none()

        if not user_obj:
            raise HTTPException(status_code=404, detail="User not found")

        access_token = user_obj.access_token

    user_info = await get_user_info(access_token)
    github_username = user_info.get("login")

    repo = f"{github_username}/leetcode_repo"

    # GitHub에 코드 푸시
    push_status, push_result = await push_code_to_github(access_token, repo, filename, code)

    # 이미 푼 문제인지 확인 (선택 사항)
    async with SessionLocal() as session:
        result = await session.execute(
            select(PushLog).where(PushLog.user_id == user_obj.id, PushLog.filename == filename)
        )
        existing_log = result.scalar_one_or_none()

        if existing_log:
            return {
                "message": "Already pushed!",
                "status": status.HTTP_200_OK
            }

        # 새로운 푸시 기록 저장
        log = PushLog(user_id=user_obj.id, filename=filename, language=language)
        session.add(log)
        await session.commit()

    return {
        "message": "uploaded to github!",
        "status": status.HTTP_201_CREATED
    }


@app.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    github_id = user.get("github_id")

    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.github_id == github_id))
        user_obj = result.scalar_one()
        logs = await session.execute(
            select(PushLog).where(PushLog.user_id == user_obj.id)
        )
        log_list = logs.scalars().all()

    return {
        "total_solved": len(log_list),
        "by_language": {
            lang: sum(1 for l in log_list if l.language == lang)
            for lang in set(l.language for l in log_list)
        },
        "recent": [
            {"filename": l.filename, "timestamp": l.timestamp.isoformat()}
            for l in sorted(log_list, key=lambda x: x.timestamp, reverse=True)[:5]
        ]
    }

@app.get("/ping")
async def ping():
    return {"message": "pong"}