from database import engine
from models import Base, User, PushLog, Problem, Solution
import asyncio
import traceback
import sys

async def init_db():
    print("🟡 [init_db] Trying to initialize DB...", flush=True)

    try:
        async with engine.begin() as conn:
            print("🟡 [init_db] Connected to DB, creating tables...", flush=True)
            await conn.run_sync(Base.metadata.create_all)
            print("🟢 [init_db] DB tables created successfully.", flush=True)
    except Exception as e:
        print("🔴 [init_db] DB Initialization failed:", flush=True)
        print("🔍 [init_db] Tables in metadata:", Base.metadata.tables.keys(), flush=True)
        print(f"🔴 [init_db] Error: {e}", flush=True)
        traceback.print_exc(file=sys.stdout)


# local test
if __name__ == "__main__":
    asyncio.run(init_db())
