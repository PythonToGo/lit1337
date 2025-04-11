from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
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
import traceback
import logging

# Add prefix to the router
push_router = APIRouter(prefix="", tags=["push"])

# Define a model for the request body
class PushCodeRequest(BaseModel):
    filename: str = Field(..., description="Filename for the code file")
    code: str = Field(..., description="Code to be pushed")
    selected_repo: str = Field(..., description="Repository to push to (username/repo format)")

# Define a model for the save repository request
class SaveRepositoryRequest(BaseModel):
    repository: str = Field(..., description="Repository to save (username/repo format)")

@push_router.post("/save-repository")
async def save_repository(
    data: SaveRepositoryRequest = Body(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:

        if not data.get("filename") or not data.get("code") or not data.get("selected_repo"):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        filename = data.get("filename")
        code = data.get("code")
        language = filename.split(".")[-1]
        selected_repo = data.get("selected_repo")


        # Log operation
        print(f"[push.py] Saving repository '{repository}' for user")
        
        # Validate repository format
        repo_parts = repository.split("/")
        if len(repo_parts) != 2 or not repo_parts[0] or not repo_parts[1]:
            print(f"[push.py] Invalid repository format: {repository}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid repository format: {repository}. Should be 'username/repo'"
            )
        
        # Get GitHub ID from token
        github_id = user.get("github_id")
        if not github_id:
            print(f"[push.py] GitHub ID not found in token: {user}")
            raise HTTPException(status_code=401, detail="GitHub ID not found in token")
        
        # Find user in database
        result = await db.execute(select(User).where(User.github_id == github_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            print(f"[push.py] User not found in database for GitHub ID: {github_id}")
            raise HTTPException(status_code=404, detail="User not found in database")
        
        # Verify access token
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

        
        # Verify repository exists
        try:
            repo_check = await repo_exists(access_token, repository)
            if not repo_check:
                repo_owner, repo_name = repo_parts
                print(f"[push.py] Repository not found: {repository}")
                
                # Get GitHub username
                user_info = await get_user_info(access_token)
                github_username = user_info.get("login")
                
                if repo_owner == github_username:
                    # User is the owner, try to create the repo
                    print(f"[push.py] User owns this repo. Attempting to create: {repo_name}")
                    repo_created = await create_repo(access_token, repo_name)
                    
                    if repo_created:
                        print(f"[push.py] Successfully created repository {repo_name}")
                    else:
                        print(f"[push.py] Failed to create repository: {repo_name}")
                        raise HTTPException(
                            status_code=404,
                            detail=f"Repository '{repository}' does not exist and could not be created."
                        )
                else:
                    # User is not the owner
                    print(f"[push.py] User is not the owner of {repository}")
                    raise HTTPException(
                        status_code=404,
                        detail=f"Repository '{repository}' not found or not accessible."
                    )
        except HTTPException as e:
            raise
        except Exception as e:
            print(f"[push.py] Error verifying repository: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail=f"Repository verification error: {str(e)}"
            )
        
        # Update user's selected repository
        user_obj.selected_repo = repository
        await db.commit()
        
        return {
            "message": "Repository saved successfully",
            "repository": repository
        }
        
    except HTTPException as he:
        print(f"HTTP exception: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        print(f"Unhandled error in save_repository: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@push_router.post("/push-code")
async def push_code(
    request: Request,
    data: PushCodeRequest = Body(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Log the incoming request for debugging
        print(f"[push.py] Received push request from user: {user}")
        print(f"[push.py] Request data: {data}")
        
        # Get user from database
        github_id = user.get("github_id")
        if not github_id:
            raise HTTPException(status_code=401, detail="GitHub ID not found in token")
            
        result = await db.execute(select(User).where(User.github_id == github_id))
        user_obj = result.scalar_one_or_none()
        
        if not user_obj:
            raise HTTPException(status_code=404, detail="User not found in database")
            
        # Get access token
        access_token = user_obj.access_token
        if not access_token:
            raise HTTPException(status_code=401, detail="GitHub access token not found")
            
        # Use selected_repo from request or user's saved repo
        selected_repo = data.selected_repo or user_obj.selected_repo
        if not selected_repo:
            raise HTTPException(status_code=400, detail="No repository selected")
            
        # Push code to GitHub
        status, result = await push_code_to_github(
            access_token=access_token,
            repo=selected_repo,
            filename=data.filename,
            content=data.code
        )
        
        if status in [200, 201]:
            # Update last push time
            user_obj.last_push = datetime.utcnow()
            await db.commit()
            
            # Create push log
            push_log = PushLog(
                user_id=user_obj.id,
                filename=data.filename,
                language=data.filename.split('.')[-1]
            )
            db.add(push_log)
            await db.commit()
            
            return {"message": "Code pushed successfully", "repository": selected_repo}
        else:
            raise HTTPException(status_code=status, detail=result.get("message", "Failed to push code to GitHub"))
            
    except HTTPException as he:
        print(f"[push.py] HTTP Exception: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        print(f"[push.py] Unexpected error: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
