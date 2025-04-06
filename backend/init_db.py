import logging
import os
from alembic.config import Config
from alembic import command
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migrations():
    logger.info("🟡 [init_db] Starting Alembic DB migration...")

    try:
        alembic_cfg = Config("alembic.ini")
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL not found.")

        # asyncpg → psycopg2 용 동기 드라이버로 변경
        sync_db_url = db_url.replace("postgresql+asyncpg", "postgresql")

        alembic_cfg.set_main_option("sqlalchemy.url", sync_db_url)

        command.upgrade(alembic_cfg, "head")
        logger.info("🟢 [init_db] Alembic migration applied successfully.")
    except Exception as e:
        logger.exception("🔴 [init_db] Alembic migration failed")


# async 함수에서 동기 함수로 분리
async def init_db():
    run_migrations()


# local test
if __name__ == "__main__":
    asyncio.run(init_db())
