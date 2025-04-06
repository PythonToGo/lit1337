from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User, PushLog, Problem, Solution
from database import get_db
from auth import get_current_user
from datetime import datetime, timedelta

user_router = APIRouter()

@user_router.get("/me")
@user_router.get("/me")
async def read_me(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    github_id = user.get("github_id")

    result = await db.execute(select(User).where(User.github_id == github_id))
    user_obj = result.scalar_one_or_none()

    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "username": user_obj.username,
        "last_login": user_obj.last_login.isoformat() if user_obj.last_login else None,
        "last_push": user_obj.last_push.isoformat() if user_obj.last_push else None
    }


@user_router.get("/search")
async def search_user(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username.ilike(f"%{username}%")))
    users = result.scalars().all()

    return {
        "results": [
            {
                "username": u.username,
                "total_solved": len(u.push_logs) if u.push_logs else 0
            } for u in users
        ]
    }

@user_router.get("/streak")
async def get_streak(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    github_id = user.get("github_id")
    result = await db.execute(select(User).where(User.github_id == github_id))
    user_obj = result.scalar_one_or_none()

    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    logs = await db.execute(select(PushLog).where(PushLog.user_id == user_obj.id))
    log_list = logs.scalars().all()
    solved_dates = set(log.timestamp.date() for log in log_list)

    streak, frozen = 0, 0
    day = datetime.today().date()

    while True:
        if day in solved_dates:
            streak += 1
        else:
            frozen += 1
            if frozen > 4:
                break
        day -= timedelta(days=1)

    return {"streak": streak, "frozen_used": min(frozen, 4)}


@user_router.get("/user/{username}")
async def get_user_detail(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logs = await db.execute(select(PushLog).where(PushLog.user_id == user.id))
    log_list = logs.scalars().all()

    return {
        "username": user.username,
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