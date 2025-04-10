from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User, PushLog, Problem, Solution
from database import get_db
from auth import get_current_user
from github_push import push_code_to_github, repo_exists, create_repo
from github_oauth import get_user_info
from utils.leetcode import get_problem_difficulty
import base64
import httpx
from datetime import datetime

push_router = APIRouter()

@push_router.post("/push-code")
async def push_code(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        if not data.get("filename") or not data.get("code") or not data.get("selected_repo"):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        filename = data.get("filename")
        code = data.get("code")
        language = filename.split(".")[-1]
        selected_repo = data.get("selected_repo")

        github_id = user.get("github_id")
        result = await db.execute(select(User).where(User.github_id == github_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            raise HTTPException(status_code=404, detail="User not found")

        access_token = user_obj.access_token
        user_info = await get_user_info(access_token)
        github_username = user_info.get("login")

        # Check if repository exists
        if not await repo_exists(access_token, selected_repo):
            # If repository doesn't exist, create it
            repo_name = selected_repo.split("/")[1]  # Get repo name from full path
            if not await create_repo(access_token, repo_name):
                raise HTTPException(status_code=500, detail="Failed to create repository")

        # push to selected repository
        status, result = await push_code_to_github(access_token, selected_repo, filename, code)
        
        # 201, 200 OK
        if status not in [200, 201]:
            raise HTTPException(status_code=status, detail=result.get("message", "Failed to push code"))

        if result.get("message") == "No change":
            return {"message": "No change"}

        # Extract slug and calculate points
        slug = filename.split("_", 1)[-1].rsplit(".", 1)[0].replace("_", "-").lower()
        
        # Get difficulty info
        difficulty_info = await get_problem_difficulty(slug)
        difficulty = difficulty_info.get("difficulty") if difficulty_info else None
        point_map = {"Easy": 3, "Medium": 6, "Hard": 12}
        point = point_map.get(difficulty, 0)

        # Insert into Problem table if not exists
        existing_problem = await db.execute(select(Problem).where(Problem.slug == slug))
        if not existing_problem.scalar_one_or_none():
            db.add(Problem(slug=slug, difficulty=difficulty, point=point))
            await db.commit()

        # Insert into PushLog
        db.add(PushLog(user_id=user_obj.id, filename=filename, language=language))
        await db.commit()

        # Check if the solution was accepted
        if result.get("message") != "No change":
            # Insert into Solution table
            db.add(Solution(user_id=user_obj.id, problem_slug=slug, language=language, code=code))
            await db.commit()

        return {
            "message": "uploaded to github!",
            "difficulty": difficulty,
            "point": point,
            "pushed_at": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"Error in push_code: {str(e)}")
        await db.rollback()
        # 201=ok
        if "201" in str(e):
            return {
                "message": "uploaded to github!",
                "pushed_at": datetime.now().isoformat()
            }
        raise HTTPException(status_code=500, detail=str(e))
