from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from fastapi import Depends

from sqlalchemy import create_engine
from sqlalchemy.future import select

from dotenv import load_dotenv
import os
import sys

# env load
env_path = os.getenv("ENV_PATH")
if env_path:
    print(f"[database.py] Loading custom ENV_PATH: {env_path}")
    load_dotenv(env_path)
else:
    print("[database.py] Loading default .env/.env.railway")
    load_dotenv(".env")  # Railway default

DATABASE_URL = os.getenv("DATABASE_URL")
print(f"[database.py] Loaded DATABASE_URL: {DATABASE_URL}", flush=True)

if "alembic" in sys.argv[0]:
    engine = create_engine(DATABASE_URL.replace("+asyncpg", ""), future=True, echo=True)
    SessionLocal = sessionmaker(bind=engine)
else:
    engine = create_async_engine(DATABASE_URL, future=True, echo=True)
    SessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    async with SessionLocal() as session:
        yield session