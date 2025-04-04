from database import engine
from models import Base
import asyncio

async def init_db():
    print("🟡 [init_db] Trying to initialize DB...")

    try:
        async with engine.begin() as conn:
            print("🟡 [init_db] Connected to DB, creating tables...")
            await conn.run_sync(Base.metadata.create_all)
            print("🟢 [init_db] DB tables created successfully.")
    except Exception as e:
        print("🔴 [init_db] DB Initialization failed:", e)

# local test
if __name__ == "__main__":
    asyncio.run(init_db())
