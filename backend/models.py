from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(Integer, unique=True, index=True)
    username = Column(String, unique=True)
    access_token = Column(String)

class PushLog(Base):
    __tablename__ = "push_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    language = Column(String)
    timestamp = Column(DateTime, default=func.now())
