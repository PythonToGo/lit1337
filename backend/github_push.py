import httpx
from datetime import datetime
import base64
from fastapi import HTTPException
import logging
import traceback

GITHUB_API_URL = "https://api.github.com"

async def repo_exists(access_token: str, repo: str):
    """Check if a repository exists and is accessible to the user"""
    print(f"[github_push.py] Checking if repository exists: {repo}")
    print(f"[github_push.py] Access token (first 10 chars): {access_token[:10]}...")
    
    if not repo or '/' not in repo:
        print(f"[github_push.py] Invalid repository format: {repo}")
        return False
        
    # Split the repository into owner and name
    try:
        owner, name = repo.split('/')
        if not owner or not name:
            print(f"[github_push.py] Invalid repository format (missing owner or name): {repo}")
            return False
    except ValueError:
        print(f"[github_push.py] Invalid repository format (couldn't split): {repo}")
        return False
        
    # First, verify user authentication
    # Try both token formats (GitHub supports 'token' prefix and 'Bearer' prefix)
    headers1 = {
        "Authorization": f"token {access_token}",  # GitHub's preferred format
        "Accept": "application/vnd.github+json",
        "User-Agent": "LIT1337-App/1.0",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    headers2 = {
        "Authorization": f"Bearer {access_token}",  # OAuth standard
        "Accept": "application/vnd.github+json",
        "User-Agent": "LIT1337-App/1.0",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # First try the token prefix format
            print(f"[github_push.py] First attempt with 'token' prefix")
            user_url = f"{GITHUB_API_URL}/user"
            user_res = await client.get(user_url, headers=headers1)
            
            if user_res.status_code != 200:
                print(f"[github_push.py] First attempt failed with status {user_res.status_code}, trying Bearer format")
                # Try Bearer format if token format fails
                user_res = await client.get(user_url, headers=headers2)
                
                if user_res.status_code != 200:
                    print(f"[github_push.py] Both authentication attempts failed: {user_res.status_code} - {user_res.text}")
                    if user_res.status_code == 401:
                        raise HTTPException(status_code=401, detail="GitHub authentication failed - token might be invalid or expired")
                    return False
                else:
                    # Bearer format worked, use these headers
                    print(f"[github_push.py] Bearer format worked. Using Bearer prefix for future requests.")
                    headers = headers2
            else:
                # Token format worked, use these headers
                print(f"[github_push.py] Token format worked. Using token prefix for future requests.")
                headers = headers1
                
            # Get authenticated username to verify repo access permissions
            username = user_res.json().get("login")
            if not username:
                print("[github_push.py] Could not get authenticated username")
                return False
                
            print(f"[github_push.py] Authenticated as: {username}")
            
            # Try to get the repository directly
            repo_url = f"{GITHUB_API_URL}/repos/{repo}"
            print(f"[github_push.py] Checking repository URL: {repo_url}")
            
            repo_res = await client.get(repo_url, headers=headers)
            
            # Log detailed info for debugging
            print(f"[github_push.py] Repo check status: {repo_res.status_code}")
            if repo_res.status_code != 200:
                print(f"[github_push.py] Repo check failed: {repo_res.status_code}")
                try:
                    error_json = repo_res.json()
                    print(f"[github_push.py] Error details: {error_json}")
                except:
                    print(f"[github_push.py] Error text: {repo_res.text}")
            
            # Repository exists and is accessible if status code is 200
            if repo_res.status_code == 200:
                print(f"[github_push.py] Repository {repo} exists and is accessible")
                return True
                
            # Handle specific error cases
            if repo_res.status_code == 404:
                print(f"[github_push.py] Repository not found: {repo}")
                
                # Try checking if owner exists
                user_profile_url = f"{GITHUB_API_URL}/users/{owner}"
                user_profile_res = await client.get(user_profile_url, headers=headers)
                
                if user_profile_res.status_code != 200:
                    print(f"[github_push.py] GitHub user '{owner}' may not exist")
                    return False
                    
                # If owner exists, check if repo might be private
                if owner != username:
                    print(f"[github_push.py] Repository owner {owner} is not the authenticated user {username}")
                    
                    # List public repos for this owner
                    user_repos_url = f"{GITHUB_API_URL}/users/{owner}/repos?per_page=100"
                    user_repos_res = await client.get(user_repos_url, headers=headers)
                    
                    if user_repos_res.status_code == 200:
                        repos = user_repos_res.json()
                        repo_names = [r.get("name") for r in repos if r.get("name")]
                        
                        if repo_names and name not in repo_names:
                            print(f"[github_push.py] Repository '{name}' not found in public repos of user '{owner}'")
                            print(f"[github_push.py] Available repos: {repo_names[:5]}")
                        else:
                            print(f"[github_push.py] Repository exists but may be private")
                            
                        # Try to fetch the exact repository info directly
                        specific_repo_url = f"{GITHUB_API_URL}/repos/{owner}/{name}"
                        specific_repo_res = await client.get(specific_repo_url, headers=headers)
                        
                        if specific_repo_res.status_code == 200:
                            print(f"[github_push.py] Direct repository check succeeded!")
                            return True
                        else:
                            print(f"[github_push.py] Direct repository check failed: {specific_repo_res.status_code}")
                
                return False
                
            else:
                print(f"[github_push.py] GitHub API error: {repo_res.status_code} - {repo_res.text}")
                return False
                
    except httpx.RequestError as e:
        print(f"[github_push.py] Request error checking repository: {str(e)}")
        return False
    except Exception as e:
        print(f"[github_push.py] Unexpected error checking repository: {str(e)}")
        print(traceback.format_exc())
        return False

async def create_repo(access_token: str, repo_name: str):
    """Create a new repository for the authenticated user"""
    print(f"Creating new repository: {repo_name}")
    url = f"{GITHUB_API_URL}/user/repos"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    json = {
        "name": repo_name,
        "description": "LeetCode solutions pushed by LeetCode Pusher",
        "private": False,
        "auto_init": True
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, headers=headers, json=json)
            
            if res.status_code == 201:
                print(f"Repository created successfully: {repo_name}")
                return True
            else:
                error_message = f"Failed to create repository: {res.status_code}"
                try:
                    error_json = res.json()
                    if "message" in error_json:
                        error_message = f"GitHub error: {error_json['message']}"
                except Exception:
                    error_message = f"GitHub returned status {res.status_code}: {res.text}"
                
                print(error_message)
                return False
    except Exception as e:
        print(f"Error creating repository: {str(e)}")
        return False

async def get_existing_file_sha(access_token: str, repo: str, path: str):
    url = f"{GITHUB_API_URL}/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            return data.get("sha")
        return None

async def get_existing_file_content(access_token: str, repo: str, path: str):
    url = f"{GITHUB_API_URL}/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                return base64.b64decode(data.get("content")).decode('utf-8'), data.get("sha")
            return None, None
    except Exception as e:
        print(f"Error getting file content: {str(e)}")
        return None, None


async def push_code_to_github(access_token: str, repo: str, filename: str, content: str):
    try:
        # Log request info (without sensitive data)
        print(f"[github_push.py] Pushing to GitHub repo: {repo}, file: {filename}, content length: {len(content)}")
        print(f"[github_push.py] Access token (first 10 chars): {access_token[:10]}...")
        
        # Try both token formats (GitHub supports 'token' prefix and 'Bearer' prefix)
        headers1 = {
            "Authorization": f"token {access_token}",  # GitHub's preferred format
            "Accept": "application/vnd.github+json",
            "User-Agent": "LIT1337-App/1.0",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        headers2 = {
            "Authorization": f"Bearer {access_token}",  # OAuth standard
            "Accept": "application/vnd.github+json",
            "User-Agent": "LIT1337-App/1.0",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        # Ensure repo format is correct (username/repo)
        if '/' not in repo:
            error_msg = f"Invalid repository format: {repo}. Should be 'username/repo'"
            print(f"[github_push.py] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
            
        # Split the repository into owner and name
        try:
            owner, name = repo.split('/')
            if not owner or not name:
                error_msg = f"Invalid repository format (missing owner or name): {repo}"
                print(f"[github_push.py] {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
        except ValueError:
            error_msg = f"Invalid repository format (couldn't split): {repo}"
            print(f"[github_push.py] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
            
        # Verify user authentication and determine which header format works
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # First try the token prefix format
                print(f"[github_push.py] Auth test - first attempt with 'token' prefix")
                user_url = f"{GITHUB_API_URL}/user"
                user_res = await client.get(user_url, headers=headers1)
                
                if user_res.status_code != 200:
                    print(f"[github_push.py] Auth test - first attempt failed with status {user_res.status_code}, trying Bearer format")
                    # Try Bearer format if token format fails
                    user_res = await client.get(user_url, headers=headers2)
                    
                    if user_res.status_code != 200:
                        print(f"[github_push.py] Auth test - both authentication attempts failed: {user_res.status_code} - {user_res.text}")
                        if user_res.status_code == 401:
                            raise HTTPException(status_code=401, detail="GitHub authentication failed - token might be invalid or expired")
                        raise HTTPException(status_code=user_res.status_code, detail=f"GitHub API error: {user_res.text}")
                    else:
                        # Bearer format worked, use these headers
                        print(f"[github_push.py] Auth test - Bearer format worked. Using Bearer prefix for future requests.")
                        headers = headers2
                else:
                    # Token format worked, use these headers
                    print(f"[github_push.py] Auth test - Token format worked. Using token prefix for future requests.")
                    headers = headers1
                    
                # Authentication succeeded, we now have a working headers object
                print(f"[github_push.py] Authentication successful")
                
                # Get authenticated username
                username = user_res.json().get("login")
                print(f"[github_push.py] Authenticated as: {username}")
                
                # Extra validation check for the repository before proceeding
                repo_exists_check = await repo_exists(access_token, repo)
                if not repo_exists_check:
                    error_msg = f"Repository '{repo}' not found or not accessible. Please check if it exists and you have permissions."
                    print(f"[github_push.py] {error_msg}")
                    # Return 404 directly to ensure proper error propagation
                    raise HTTPException(status_code=404, detail=error_msg)
                    
                # URL for GitHub API
                url = f"{GITHUB_API_URL}/repos/{repo}/contents/{filename}"
                print(f"[github_push.py] GitHub API URL: {url}")
            
                # Encode content properly
                try:
                    encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
                except Exception as e:
                    print(f"[github_push.py] Content encoding error: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"Failed to encode content: {str(e)}")
                
                # Check if file exists first
                print(f"[github_push.py] Checking if file exists: {url}")
                client.timeout = 30.0  # 30 seconds timeout
                existing_file = await client.get(url, headers=headers)
                
                # Handle status codes explicitly
                if existing_file.status_code == 200:
                    # File exists, get its content and SHA
                    existing_data = existing_file.json()
                    
                    try:
                        existing_content = base64.b64decode(existing_data["content"]).decode('utf-8')
                        
                        if existing_content.strip() == content.strip():
                            print("[github_push.py] File content unchanged")
                            return 200, {"message": "No change"}
                    except Exception as e:
                        print(f"[github_push.py] Error decoding existing content: {str(e)}")
                    
                    payload = {
                        "message": f"Update LeetCode solution: {filename}",
                        "content": encoded_content,
                        "sha": existing_data["sha"]
                    }
                    print(f"[github_push.py] Updating existing file {filename} in {repo}")
                    
                elif existing_file.status_code == 404:
                    # File doesn't exist, create new file
                    # This is an expected case - create a new file
                    payload = {
                        "message": f"Add LeetCode solution: {filename}",
                        "content": encoded_content
                    }
                    print(f"[github_push.py] Creating new file {filename} in {repo}")
                else:
                    # For other unexpected status codes, return the error
                    error_text = existing_file.text
                    print(f"[github_push.py] Unexpected status checking file: {existing_file.status_code} - {error_text}")
                    
                    # Parse response as JSON if possible
                    try:
                        error_json = existing_file.json()
                        error_detail = error_json.get("message", error_text)
                    except:
                        error_detail = error_text
                        
                    # Return the actual status code directly
                    raise HTTPException(
                        status_code=existing_file.status_code, 
                        detail=f"GitHub API error: {error_detail}"
                    )
                
                # Push to GitHub
                print(f"[github_push.py] Sending PUT request to GitHub API")
                response = await client.put(url, headers=headers, json=payload)
                
                print(f"[github_push.py] GitHub API response: {response.status_code}")
                if response.status_code in [200, 201]:
                    result = response.json()
                    print(f"[github_push.py] Successfully pushed file!")
                    return response.status_code, result
                else:
                    error_text = response.text
                    print(f"[github_push.py] GitHub API error: {response.status_code} - {error_text}")
                    
                    # Parse response as JSON if possible
                    try:
                        error_json = response.json()
                        # Preserve the actual status code
                        return response.status_code, error_json
                    except:
                        return response.status_code, {"message": f"GitHub API error: {error_text}"}
                
        except httpx.HTTPStatusError as e:
            print(f"[github_push.py] HTTP error: {e.response.status_code} - {e.response.text}")
            
            # Special handling for 404 (file or repo not found)
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Resource not found: {e.response.text}")
            else:
                # For other HTTP errors, preserve the status code
                raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
                
        except HTTPException:
            raise
                
        except Exception as e:
            print(f"[github_push.py] Unexpected error: {str(e)}")
            traceback_str = traceback.format_exc()
            print(traceback_str)
            raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
            
    except httpx.TimeoutException:
        print(f"[github_push.py] Timeout error when contacting GitHub API")
        raise HTTPException(status_code=504, detail="GitHub API request timed out")
        
    except httpx.RequestError as e:
        print(f"[github_push.py] GitHub API request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GitHub API request error: {str(e)}")
        
    except HTTPException:
        # Re-raise HTTP exceptions directly to preserve status codes
        raise
        
    except Exception as e:
        traceback_str = traceback.format_exc()
        print(f"[github_push.py] Unexpected error: {str(e)}")
        print(traceback_str)
        
        # Check for 404 patterns in the error message
        error_message = str(e).lower()
        if "not found" in error_message or "404" in error_message or "not accessible" in error_message:
            raise HTTPException(status_code=404, detail=f"Repository '{repo}' or file not found: {str(e)}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to push code: {str(e)}")

async def check_and_push_code(access_token: str, repo: str, filename: str, content: str):
    existing_content, sha = await get_existing_file_content(access_token, repo, filename)
    
    status, result = await push_code_to_github(access_token, repo, filename, content)
    if status not in [200, 201]:
        error_msg = result.get('message', f"Failed to push code: {result}")
        print(f"Error in check_and_push_code: {error_msg}")
        raise Exception(error_msg)

    return False, "Code pushed successfully"
