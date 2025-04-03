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

push_router = APIRouter()

@push_router.post("/push-code")
async def push_code(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
    
    # check if existing file is same code
    sha = await get_existing_file_sha(access_token, repo, filename)
    if sha:
        url = f"https://github.com/repos/{repo}/contnets/{filename}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                existing_data = res.json()
                existing_content = base64.b64decode(existing_data.get("content", "").decode())
                if existing_content.strip() == code.strip():
                    return {"message": "No change."}
    push_status, push_result = await push_code_to_github(access_token, repo, filename, code)

    # extract slug
    slug = filename.split("_", 1)[-1].rsplit(".", 1)[0].replace("_", "-").lower()
    difficulty_info = await get_problem_difficulty(slug)
    difficulty = difficulty_info.get("difficulty") if difficulty_info else None
    number = difficulty_info.get("number") if difficulty_info else None
    point_map = {"Easy": 3, "Medium": 6, "Hard": 12}
    point = point_map.get(difficulty, 0)

    # insert into Problem table if not exists
    existing_problem = await db.execute(select(Problem).where(Problem.slug == slug))
    if not existing_problem.scalar_one_or_none():
        db.add(Problem(slug=slug, difficulty=difficulty, point=point))
        await db.commit()

    # insert into PushLog only if not already exists
    result = await db.execute(select(PushLog).where(PushLog.user_id == user_obj.id, PushLog.filename == filename))
    if not result.scalar_one_or_none():
        db.add(PushLog(user_id=user_obj.id, filename=filename, language=language))
        await db.commit()

    return {
        "message": "uploaded to github!",
        "difficulty": difficulty,
        "point": point
    }
