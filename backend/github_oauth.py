import os
import httpx
from fastapi import Request

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
    raise ValueError("❌ GitHub OAuth credentials not found")

print(f"🔑 GitHub OAuth Configuration: Client ID: {GITHUB_CLIENT_ID[:5]}...")

async def exchange_code_for_token(code: str):
    """Exchange GitHub OAuth code for token data"""
    try:
        async with httpx.AsyncClient() as client:
            print(f"🚀 Exchanging code for token with GitHub...")
            print(f"Using code: {code[:10]}...")
            
            # Log credentials being used (partially obscured for security)
            print(f"🔑 Using Client ID: {GITHUB_CLIENT_ID[:5]}...")
            print(f"🔑 Using Client Secret: {GITHUB_CLIENT_SECRET[:5]}...")
            
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={
                    "Accept": "application/json"
                },
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code
                }
            )
            
            print(f"✅ GitHub token exchange status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            try:
                response_text = response.text
                print(f"Raw response text: {response_text}")
                data = response.json()
                print(f"Parsed response data keys: {list(data.keys())}")
            except Exception as e:
                print(f"❌ Failed to parse JSON response: {response_text}")
                raise Exception(f"Failed to parse GitHub response: {str(e)}")
            
            if "error" in data:
                error_description = data.get("error_description", "No description provided")
                print(f"❌ GitHub OAuth error: {data['error']} - {error_description}")
                raise Exception(f"GitHub OAuth error: {data['error']} - {error_description}")
            
            if "access_token" not in data:
                print("❌ Access token is missing from response")
                print(f"Available fields in response: {list(data.keys())}")
                raise Exception("No access token in GitHub response")
            
            # Ensure token is properly stored and formatted
            access_token = data.get("access_token", "").strip()
            if not access_token:
                print("❌ Access token is empty")
                raise Exception("Empty access token received from GitHub")
                
            # Create a new clean data object to avoid any issues
            token_data = {
                "access_token": access_token,
                "token_type": data.get("token_type", "bearer"),
                "scope": data.get("scope", "")
            }
                
            print(f"🔑 Successfully obtained token data with fields: {list(token_data.keys())}")
            print(f"🔑 Access token value: {access_token[:10]}...")
            
            # Directly log the full token JUST FOR DEBUGGING (would remove in production)
            print(f"🔑 FULL TOKEN FOR DEBUG: {access_token}")
            
            # Verify token data is correctly formed
            if not token_data.get("access_token"):
                print("⚠️ WARNING: access_token field is empty or missing in final token_data")
                # Try once more to ensure it's set
                token_data["access_token"] = access_token
            
            return token_data
            
    except Exception as e:
        print(f"🔥 Error in token exchange: {str(e)}")
        raise

async def get_user_info(access_token: str):
    """Get GitHub user information using access token"""
    try:
        async with httpx.AsyncClient() as client:
            print(f"👤 Fetching user info from GitHub...")
            print(f"👤 Using token: {access_token[:10]}...")
            
            # Try both authentication methods
            headers = {
                "Authorization": f"token {access_token}",  # GitHub preferred format
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "LIT1337-App"
            }
            
            response = await client.get(
                "https://api.github.com/user",
                headers=headers
            )
            
            if response.status_code != 200:
                # Try alternative Bearer format if token format fails
                print(f"First attempt failed with status {response.status_code}, trying Bearer format")
                alt_headers = {
                    "Authorization": f"Bearer {access_token}",  # OAuth standard
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "LIT1337-App"
                }
                
                response = await client.get(
                    "https://api.github.com/user",
                    headers=alt_headers
                )
            
            print(f"GitHub API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_data = response.json()
                print(f"❌ GitHub API error response: {error_data}")
                raise Exception(f"GitHub API error: {response.status_code} - {error_data.get('message', 'Unknown error')}")
            
            data = response.json()
            print(f"✅ GitHub user info received for: {data.get('login')}")
            return data
            
    except Exception as e:
        print(f"❌ Error getting user info: {str(e)}")
        raise
