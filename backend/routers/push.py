from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User, PushLog, Problem, Solution
from database import get_db
from auth import get_current_user
from github_push import push_code_to_github, get_existing_file_sha
from github_oauth import get_user_info
from utils.leetcode import get_problem_difficulty
import base64
import httpx
from datetime import datetime

push_router = APIRouter()

@push_router.post("/push-code")
async def push_code(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 캐싱 추가
    DIFFICULTY_CACHE = {}
    
    filename = data.get("filename")
    code = data.get("code")
    language = filename.split(".")[-1]

    github_id = user.get("github_id")
    result = await db.execute(select(User).where(User.github_id == github_id))
    user_obj = result.scalar_one_or_none()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user_obj.access_token
    user_info = await get_user_info(access_token)
    github_username = user_info.get("login")
    repo = f"{github_username}/leetcode_repo"

    # Check if the file content is the same before pushing
    no_change, message = await check_and_push_code(access_token, repo, filename, code)
    if no_change:
        return {"message": message}

    # Extract slug and calculate points
    slug = filename.split("_", 1)[-1].rsplit(".", 1)[0].replace("_", "-").lower()
    
    # 캐시된 difficulty 정보 사용
    if slug not in DIFFICULTY_CACHE:
        difficulty_info = await get_problem_difficulty(slug)
        DIFFICULTY_CACHE[slug] = difficulty_info
    
    difficulty_info = DIFFICULTY_CACHE[slug]
    difficulty = difficulty_info.get("difficulty") if difficulty_info else None
    number = difficulty_info.get("number") if difficulty_info else None
    point_map = {"Easy": 3, "Medium": 6, "Hard": 12}
    point = point_map.get(difficulty, 0)

    # Insert into Problem table if not exists
    existing_problem = await db.execute(select(Problem).where(Problem.slug == slug))
    if not existing_problem.scalar_one_or_none():
        db.add(Problem(slug=slug, difficulty=difficulty, point=point))
        await db.commit()

    # Insert into PushLog only if not already exists
    result = await db.execute(select(PushLog).where(PushLog.user_id == user_obj.id, PushLog.filename == filename))
    if not result.scalar_one_or_none():
        db.add(PushLog(user_id=user_obj.id, filename=filename, language=language))
        await db.commit()

    return {
        "message": "uploaded to github!",
        "difficulty": difficulty,
        "point": point,
        "pushed_at": datetime.now().isoformat()
    }
