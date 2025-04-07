import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import argparse
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import User, PushLog, Solution
from database import Base

# Load environment variables
load_dotenv(".env.railway")

DATABASE_URL = os.getenv("DATABASE_URL").replace("+asyncpg", "")
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine)


def delete_user_by_id(user_id: int):
    db = SessionLocal()
    try:
        db.query(PushLog).filter(PushLog.user_id == user_id).delete()
        db.query(Solution).filter(Solution.user_id == user_id).delete()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()
        print("User data deletion completed.")
    except Exception as e:
        db.rollback()
        print("Error:", e)
    finally:
        db.close()

def delete_user_by_username(username: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            delete_user_by_id(user.id)
        else:
            print("User not found.")
    except Exception as e:
        db.rollback()
        print("Error:", e)
    finally:
        db.close()

# test
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete user and related data.")
    parser.add_argument("--id", type=int, help="User ID to delete")
    parser.add_argument("--username", type=str, help="Username to delete")
    
    args = parser.parse_args()
    
    if args.id:
        delete_user_by_id(args.id)
    elif args.username:
        delete_user_by_username(args.username)
    else:
        print("Please provide either a user ID or username.")
