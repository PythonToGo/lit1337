from init_db import init_db
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from routers import user, stats, auth, push, solution
from fastapi import FastAPI
import os

load_dotenv()

app = FastAPI()

ALLOWED_ORIGINS = [
    "https://leetcode.com",
    "https://leetcode.cn",
    "http://localhost:3000",
    "http://localhost:5173",
    "chrome-extension://*",  # Allow all Chrome extensions
    "https://lit1337-dev.up.railway.app"
]

if os.getenv("ADDITIONAL_ORIGINS"):
    ALLOWED_ORIGINS.extend(os.getenv("ADDITIONAL_ORIGINS").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers including Authorization
    expose_headers=["*"]
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

    
@app.get("/ping")
async def ping():
    return {"message": "pong"}    
