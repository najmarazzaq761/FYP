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

# Set working directory
WORKDIR $HOME/app

# Copy requirements first to leverage Docker cache
COPY --chown=user requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY --chown=user . .

# Expose port 7860 (required by Hugging Face Docker Spaces)
EXPOSE 7860

# Run the application using gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:7860", "--workers=2", "--timeout=120", "run:app"]
