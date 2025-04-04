from database import engine
from models import Base, User, PushLog, Problem, Solution
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    logger.info("🟡 [init_db] Trying to initialize DB...")

    try:
        async with engine.begin() as conn:
            logger.info("🟡 [init_db] Connected to DB, creating tables...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("🟢 [init_db] DB tables created successfully.")
    except Exception as e:
        logger.exception("🔴 [init_db] DB Initialization failed")  # ← 전체 에러 트레이스 찍힘
        logger.info("🔍 [init_db] Tables in metadata: %s", Base.metadata.tables.keys())


# local test
if __name__ == "__main__":
    asyncio.run(init_db())
