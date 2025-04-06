import logging
import os
from alembic.config import Config
from alembic import command
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    logger.info("🟡 [init_db] Starting Alembic DB migration...")

    try:
        # alembic settings
        alembic_cfg = Config("alembic.ini")
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL not found in environment variables.")

        alembic_cfg.set_main_option("sqlalchemy.url", db_url)

        command.upgrade(alembic_cfg, "head")
        logger.info("🟢 [init_db] Alembic migration applied successfully.")
        
    except Exception as e:
        logger.exception("🔴 [init_db] Alembic migration failed")


# local test
if __name__ == "__main__":
    asyncio.run(init_db())
