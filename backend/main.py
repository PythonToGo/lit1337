from init_db import init_db
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from routers import user, stats, auth, push, solution
from fastapi import FastAPI

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # allow_origins=["https://leetcode.com", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(user.user_router)
app.include_router(stats.stats_router)
app.include_router(auth.auth_router)
app.include_router(push.push_router)
app.include_router(solution.solution_router)
# app.include_router(user.user_detail_router)


@app.on_event("startup")
async def startup_event():
    print("🟡 [startup] Running startup event...")
    # await init_db()

    
@app.get("/ping")
async def ping():
    return {"message": "pong"}    
