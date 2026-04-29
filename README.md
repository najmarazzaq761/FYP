# Depression Detection Web Application

Production-ready full-stack starter with modular Flask backend and responsive neon frontend.

## Project Structure

```
depression_fyp/
  backend/
    app/
      blueprints/
      services/
      __init__.py
      config.py
      extensions.py
      models.py
    .env.example
    requirements.txt
    run.py
  frontend/
    index.html
    styles.css
    app.js
  models/
    README.md
```

## Features

- Register/Login with hashed passwords (bcrypt)
- JWT-based auth for protected APIs
- Depression prediction from webcam recording or uploaded video
- Chatbot endpoint integrated with Gemini API
- Prediction history persistence in SQLite
- Bar chart trend visualization using Chart.js

## Setup (Step by Step)

1. Create Python venv and install backend dependencies:
   - `cd backend`
   - `python -m venv .venv`
   - Windows: `.venv\Scripts\activate`
   - `pip install -r requirements.txt`
2. Configure environment:
   - Copy `.env.example` to `.env`
   - Set `SECRET_KEY`, `JWT_SECRET_KEY`, and `GEMINI_API_KEY`
3. Run backend:
   - `python run.py`
4. Run frontend:
   - Open `frontend/index.html` in a browser (or serve with any static server)
5. Use app:
   - Register/Login
   - Predict from webcam/upload
   - Chat with bot
   - View history trend

## API Endpoints

- `POST /api/register`
- `POST /api/login`
- `POST /api/predict` (JWT required, multipart with `video`)
- `POST /api/chat` (JWT required)
- `GET /api/history` (JWT required)

## Deployment Notes

- No hardcoded secrets; all keys come from `.env`.
- `DATABASE_URL` can be swapped to PostgreSQL/MySQL without changing route logic.
- Keep CORS origins restricted in production by setting `CORS_ORIGINS`.
