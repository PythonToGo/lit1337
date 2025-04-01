import httpx
from datetime import datetime
import base64

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

async def push_code_to_github(access_token: str, repo: str, filename: str, content: str):
    repo_name = repo.split("/")[-1]
    repo_owner = repo.split("/")[0]

    if not await repo_exists(access_token, repo):
        created = await create_repo(access_token, repo_name)
        if not created:
            return 400, {"error": f"Repo {repo} creation failed"}

    path = filename
    commit_message = f"Add LeetCode solution: {filename}"
    encoded_content = base64.b64encode(content.encode()).decode()
    sha = await get_existing_file_sha(access_token, repo, path)

    payload = {
        "message": commit_message,
        "content": encoded_content
    }

    if sha:
        payload["sha"] = sha  # Add sha to allow overwrite

    url = f"{GITHUB_API_URL}/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json"
    }

    async with httpx.AsyncClient() as client:
        res = await client.put(url, headers=headers, json=payload)
        return res.status_code, res.json()