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
    github_id = Column(Integer, unique=True)
    username = Column(String)
    access_token = Column(String)

    push_logs = relationship("PushLog", back_populates="user")
