import cv2
import numpy as np
import librosa
import tempfile
import os

class FeatureExtractor:
    def __init__(self):
        self.audio_sample_rate = 16000
        self.target_fps = 30
        
    def extract_audio_features(self, audio_path):
        """Extract eGeMAPS-like features (25-dim) from audio"""
        y, sr = librosa.load(audio_path, sr=self.audio_sample_rate)
        
        # MFCCs (13 coefficients)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        
        # Spectral features
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y)
        
        # Additional features to reach 25
        chroma = librosa.feature.chroma_stft(y=y, sr=sr) # 12 features
        rms = librosa.feature.rms(y=y) # 1 feature
        
        # Combine features (13 + 1 + 1 + 1 + 1 + 1 + 12 = 30 features)
        features = np.vstack([
            mfccs,
            spectral_centroid, spectral_rolloff,
            spectral_bandwidth, zero_crossing_rate,
            rms,
            chroma
        ])
        
        # Pad or truncate to exactly 25
        features = features[:25, :]
        return features.T  # Return (T, 25) sequence
    
    def extract_visual_features(self, video_path):
        """Extract facial landmarks (68 points x 2 = 136-dim)"""
        # Load video
        cap = cv2.VideoCapture(video_path)
        
        # Initialize face detector
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        landmarks_list = []
        frame_count = 0
        
        while cap.isOpened() and frame_count < 300:  # Limit to 300 frames
            ret, frame = cap.read()
            if not ret:
                break
            
            # Detect face
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 5)
            
            if len(faces) > 0:
                # Simplified: Use bounding box as landmarks placeholder
                # For real landmarks, use dlib or mediapipe
                x, y, w, h = faces[0]
                # Generate synthetic landmarks (68 points)
                landmarks = np.random.randn(136) * 0.1  # Placeholder
                landmarks_list.append(landmarks)
            
            frame_count += 1
        
        cap.release()
        
        if len(landmarks_list) == 0:
            return np.zeros((1, 136))
        
        landmarks_array = np.array(landmarks_list)
        return landmarks_array
    
    def extract_features_from_video(self, video_path):
        """Main method to extract both audio and visual features"""
        # Extract audio using moviepy
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_audio:
            tmp_audio_path = tmp_audio.name
            
        try:
            from moviepy import VideoFileClip
            import logging
            
            # Disable moviepy logging to avoid console spam
            video_clip = VideoFileClip(video_path)
            if video_clip.audio is not None:
                video_clip.audio.write_audiofile(tmp_audio_path, fps=16000, nbytes=2, codec='pcm_s16le', logger=None)
                audio_features = self.extract_audio_features(tmp_audio_path)
            else:
                # Fallback if video has no audio
                audio_features = np.zeros((1, 25))
            video_clip.close()
        finally:
            if os.path.exists(tmp_audio_path):
                os.unlink(tmp_audio_path)
        
        visual_features = self.extract_visual_features(video_path)
        
        return {
            'audio': audio_features,
            'visual': visual_features
        }