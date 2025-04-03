from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert
from models import User, Solution
from database import get_db
from auth import get_current_user
from utils.leetcode import get_problem_difficulty

solution_router = APIRouter()

@solution_router.post("/submit-solution")
async def submit_solution(
    data: dict,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    github_id = user.get("github_id")
    result = await db.execute(select(User).where(User.github_id == github_id))
    user_obj = result.scalar_one_or_none()

    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    new_sol = Solution(
        user_id=user_obj.id,
        problem_slug=data.get("slug"),
        language=data.get("language"),
        code=data.get("code"),
        explanation=data.get("explanation"),
        image_url=data.get("image_url")
    )
    db.add(new_sol)
    await db.commit()

    return {"message": "Solution submitted (mocked)"}
