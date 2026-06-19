import os
import tempfile
import sys

# Add models path to sys.path so we can import from the root models directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from models.feature_extractor import FeatureExtractor
from models.predictor import get_predictor

def predict_from_video_bytes(video_bytes: bytes, ext: str = '.webm', gender: int = 1) -> dict:
    if not video_bytes:
        raise ValueError("Video bytes are empty")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_video:
        tmp_video_path = tmp_video.name
        tmp_video.write(video_bytes)

    try:
        from moviepy import VideoFileClip
        # Calculate duration automatically
        clip = VideoFileClip(tmp_video_path)
        duration = clip.duration
        clip.close()

        extractor = FeatureExtractor()
        features = extractor.extract_features_from_video(tmp_video_path)
        
        predictor = get_predictor()
        prediction = predictor.predict(features['audio'], features['visual'], gender, duration)
        
        return prediction
    finally:
        if os.path.exists(tmp_video_path):
            os.unlink(tmp_video_path)
