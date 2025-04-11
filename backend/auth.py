from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Header, HTTPException
import os
from dotenv import load_dotenv
import traceback

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    jwt_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"[auth.py] Created JWT token: {jwt_token[:20]}...")
    return jwt_token

def verify_token(token: str):
<<<<<<< Updated upstream
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user
=======
    """Verify and decode a JWT token"""
    print(f"[auth.py] Verifying token: {token[:20]}...")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"[auth.py] Token decoded successfully: {payload}")
        
        if "exp" not in payload:
            print("[auth.py] Token missing 'exp' field")
            return None
            
        # Check if token has expired
        expiration_timestamp = payload["exp"]
        try:
            # Print both values for comparison
            current_timestamp = datetime.utcnow().timestamp()
            print(f"[auth.py] Current time: {current_timestamp}, Token expiration: {expiration_timestamp}")
            
            # Check expiration
            if current_timestamp > expiration_timestamp:
                print("[auth.py] Token has expired")
                return None
                
        except Exception as e:
            print(f"[auth.py] Error comparing timestamps: {str(e)}")
            return None
            
        return payload
    except JWTError as e:
        print(f"[auth.py] JWT verification error: {str(e)}")
        return None
    except Exception as e:
        print(f"[auth.py] Token verification error: {str(e)}")
        print(traceback.format_exc())
        return None

async def get_current_user(authorization: str = Header(...)):
    """Get current user from authorization header"""
    try:
        print(f"[auth.py] Authorization header: {authorization[:30]}...")
        
        if not authorization or not authorization.startswith("Bearer "):
            print(f"[auth.py] Invalid authorization header format: {authorization[:15]}...")
            raise HTTPException(
                status_code=401, 
                detail="Invalid authorization header format"
            )
            
        token = authorization.replace("Bearer ", "")
        print(f"[auth.py] Processing token: {token[:20]}... (length: {len(token)})")
        
        if not token:
            print("[auth.py] Empty token after Bearer prefix")
            raise HTTPException(
                status_code=401, 
                detail="Empty token"
            )
            
        payload = verify_token(token)
        if not payload:
            print(f"[auth.py] Token verification failed for token: {token[:20]}...")
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired token"
            )
            
        # Verify essential fields
        if "github_id" not in payload:
            print(f"[auth.py] Missing required field 'github_id' in token payload: {payload}")
            raise HTTPException(
                status_code=401,
                detail="Token missing required fields"
            )
            
        print(f"[auth.py] Authenticated user with GitHub ID: {payload.get('github_id')}")
        return payload
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"[auth.py] Authentication error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=401,
            detail=f"Authorization failed: {str(e)}"
        )
>>>>>>> Stashed changes
