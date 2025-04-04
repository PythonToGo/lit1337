from database import engine
from models import Base
import asyncio

async def init_db():
    try:
        print("Initializing DB...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("DB Initialized successfully.")
    except Exception as e:
        print("DB Initialization failed:", e)

# for local testing
if __name__ == "__main__":
    asyncio.run(init_db())
