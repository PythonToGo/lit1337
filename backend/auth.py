from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Header, HTTPException
import os
from dotenv import load_dotenv
import traceback

# Load environment variables
def get_database_url():
    env_path = os.getenv("ENV_PATH")
    if env_path:
        print(f"[auth.py] Loading environment from: {env_path}")
        load_dotenv(env_path)
        return os.getenv("DATABASE_URL", "").replace("+asyncpg", "").replace("@db", "@localhost")
    else:
        print("[auth.py] Loading from default .env file")
        load_dotenv(".env")
        return os.getenv("DATABASE_URL", "").replace("+asyncpg", "")

DATABASE_URL = get_database_url()

# Ensure required environment variables are present
if not os.getenv("JWT_SECRET"):
    raise ValueError("JWT_SECRET environment variable is not set")

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

def create_jwt_token(data: dict):
    """Create a new JWT token with expiration"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    jwt_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"[auth.py] Created JWT token: {jwt_token[:20]}...")
    return jwt_token

def create_access_token(data: dict):
    """Alias for create_jwt_token for backward compatibility"""
    return create_jwt_token(data)

def verify_token(token: str):
    """Verify and decode a JWT token"""

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if "exp" not in payload:
            return None
        if datetime.utcnow() > datetime.fromtimestamp(payload["exp"]):
            return None
        return payload
    except JWTError as e:
        print(f"JWT verification error: {str(e)}")
        return None
    except Exception as e:
        print(f"Token verification error: {str(e)}")

        return None

async def get_current_user(authorization: str = Header(...)):
    """Get current user from authorization header"""
    try:

        token = authorization.replace("Bearer ", "")
        payload = verify_token(token)
        if not payload:

            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired token"
            )

        return payload
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Authorization failed: {str(e)}"
        )

