import httpx
from datetime import datetime
import base64
from fastapi import HTTPException

GITHUB_API_URL = "https://api.github.com"

async def repo_exists(access_token: str, repo: str):
    url = f"{GITHUB_API_URL}/repos/{repo}"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        return res.status_code == 200

async def create_repo(access_token: str, repo_name: str):
    url = f"{GITHUB_API_URL}/user/repos"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json"
    }
    json = {
        "name": repo_name,
        "description": "LeetCode solutions pushed by LeetCode Pusher",
        "private": False,
        "auto_init": True
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=json)
        return res.status_code == 201

async def get_existing_file_sha(access_token: str, repo: str, path: str):
    url = f"{GITHUB_API_URL}/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json"
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            return data.get("sha")
        return None

async def get_existing_file_content(access_token: str, repo: str, path: str):
    url = f"{GITHUB_API_URL}/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json"
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            return base64.b64decode(data.get("content")).decode(), data.get("sha")
        return None, None


async def push_code_to_github(access_token: str, repo: str, filename: str, content: str):
    try:
        # 한 번의 API 호출로 처리
        url = f"{GITHUB_API_URL}/repos/{repo}/contents/{filename}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json"
        }
        
        async with httpx.AsyncClient() as client:
            # 파일 존재 여부와 내용을 한 번에 확인
            existing_file = await client.get(url, headers=headers)
            
            if existing_file.status_code == 200:
                existing_data = existing_file.json()
                existing_content = base64.b64decode(existing_data["content"]).decode()
                
                if existing_content.strip() == content.strip():
                    return 200, {"message": "No change"}
                    
                payload = {
                    "message": f"Update LeetCode solution: {filename}",
                    "content": base64.b64encode(content.encode()).decode(),
                    "sha": existing_data["sha"]
                }
            else:
                payload = {
                    "message": f"Add LeetCode solution: {filename}",
                    "content": base64.b64encode(content.encode()).decode()
                }
            
            response = await client.put(url, headers=headers, json=payload)
            return response.status_code, response.json()
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"GitHub API error: {str(e)}")

async def check_and_push_code(access_token: str, repo: str, filename: str, content: str):
    existing_content, sha = await get_existing_file_content(access_token, repo, filename)
    
    status, result = await push_code_to_github(access_token, repo, filename, content)
    if status != 200:
        raise Exception(f"Failed to push code: {result.get('error', 'Unknown error')}")

    return False, "Code pushed successfully"
