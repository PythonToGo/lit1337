from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func 
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class PushLog(Base):
    __tablename__ = "push_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    language = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="push_logs")


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    access_token = Column(String)
    last_push = Column(DateTime(timezone=True))
    last_login = Column(DateTime(timezone=True))
    solutions = relationship("Solution", back_populates="user")
    push_logs = relationship("PushLog", back_populates="user")


class Solution(Base):
    __tablename__ = "solutions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    problem_slug = Column(String, index=True)  # e.g. "two-sum"
    language = Column(String)
    code = Column(Text)
    explanation = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="solutions")


class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True)
    difficulty = Column(String)
    point = Column(Integer)