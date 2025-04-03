from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User, PushLog, Problem, Solution
from database import get_db
from auth import get_current_user
from utils.leetcode import get_problem_difficulty


stats_router = APIRouter()

@stats_router.get("/stats")
async def get_stats(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    github_id = user.get("github_id")
    result = await db.execute(select(User).where(User.github_id == github_id))
    user_obj = result.scalar_one()
    logs = await db.execute(select(PushLog).where(PushLog.user_id == user_obj.id))
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

@stats_router.get("/ranking")
async def get_ranking(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    rankings = []

    for user in users:
        logs_result = await db.execute(select(PushLog).where(PushLog.user_id == user.id))
        logs = logs_result.scalars().all()
        lang_count = {}
        total_point = 0

        for log in logs:
            lang_count[log.language] = lang_count.get(log.language, 0) + 1
            # Extract slug from filename
            slug = log.filename.split("_", 1)[-1].rsplit(".", 1)[0].replace("_", "-").lower()
            prob_result = await db.execute(select(Problem).where(Problem.slug == slug))
            prob = prob_result.scalar_one_or_none()
            if prob:
                total_point += prob.point or 0

        rankings.append({
            "username": user.username,
            "total_solved": len(logs),
            "by_language": lang_count,
            "total_point": total_point
        })

    rankings.sort(key=lambda x: x["total_point"], reverse=True)
    return {"ranking": rankings}
