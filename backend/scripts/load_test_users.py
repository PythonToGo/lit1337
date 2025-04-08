import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import json
from datetime import datetime, timezone
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, PushLog, Solution
from database import Base

# Load environment variables
load_dotenv(".env.railway")

# Remove asyncpg from DATABASE_URL for sync usage
DATABASE_URL = os.getenv("DATABASE_URL").replace("+asyncpg", "")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Load JSON file
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "test_data", "test_users.json")

def load_test_users():
    db = SessionLocal()
    try:
        with open(JSON_PATH, "r") as f:
            users = json.load(f)

        for u in users:
            existing_user = db.query(User).filter(User.github_id == u["github_id"]).first()
            if existing_user:
                print(f"🔁 Updating existing user: {u['username']} (github_id: {u['github_id']})")
                # delete push logs and solutions
                db.query(PushLog).filter(PushLog.user_id == existing_user.id).delete()
                db.query(Solution).filter(Solution.user_id == existing_user.id).delete()
                db.delete(existing_user)
                db.flush()

        
            user = User(
                github_id=u["github_id"],
                username=u["username"],
                access_token=u["access_token"],
                last_push=datetime.now(timezone.utc),
                last_login=datetime.now(timezone.utc)
            )
            db.add(user)
            db.flush()  # get user.id

            for p in u.get("push_logs", []):
                db.add(PushLog(
                    user_id=user.id,
                    filename=p["filename"],
                    language=p["language"],
                    timestamp=datetime.utcnow()
                ))

            for s in u.get("solutions", []):
                db.add(Solution(
                    user_id=user.id,
                    problem_slug=s["problem_slug"],
                    language=s["language"],
                    code=s["code"],
                    explanation=s.get("explanation"),
                ))

        db.commit()
        print("Test users loaded into the database.")
    except Exception as e:
        db.rollback()
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    load_test_users()
