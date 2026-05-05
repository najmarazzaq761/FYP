# Use a slim Python 3.9 image
FROM python:3.9-slim

# Install system dependencies required by OpenCV and others
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up a non-root user (required by Hugging Face Spaces)
RUN useradd -m -u 1000 user
USER user

# Set environment variables
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production

# Set working directory to the home directory
WORKDIR $HOME/app

# Copy the backend requirements first to leverage Docker cache
COPY --chown=user backend/requirements.txt ./backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend, models, and rag_docs folders
COPY --chown=user backend ./backend
COPY --chown=user models ./models
COPY --chown=user rag_docs ./rag_docs

# Run the RAG document ingestion script to build the chroma_db
RUN python backend/scripts/ingest_docs.py

# Change working directory to backend where run.py is
WORKDIR $HOME/app/backend

# Expose port 7860 (required by Hugging Face Docker Spaces)
EXPOSE 7860

# Run the application using gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:7860", "--workers=2", "--timeout=120", "run:app"]
