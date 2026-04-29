import os
from dotenv import load_dotenv

# Load .env from backend folder properly
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-jwt-secret")
    db_url = os.getenv("DATABASE_URL", "sqlite:///depression_app.db")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # IMPORTANT: No fallback here
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    DEBUG = os.getenv("FLASK_ENV", "production").lower() == "development"
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")


# 🔍 DEBUG (temporary — baad me hata dena)
print("LOADED GROQ KEY:", "OK" if os.getenv("GROQ_API_KEY") else "MISSING")