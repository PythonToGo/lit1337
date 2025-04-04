from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from fastapi import Depends

from sqlalchemy import create_engine
from sqlalchemy.future import select

from dotenv import load_dotenv
import os
import sys

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
print(f"[database.py] Loaded DATABASE_URL: {DATABASE_URL}", flush=True)

try:
    engine = create_async_engine(DATABASE_URL, future=True, echo=True)
except Exception as e:
    print(f"[database.py] Failed to create engine: {e}", flush=True)
    raise

SessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db():
    async with SessionLocal() as session:
        yield session