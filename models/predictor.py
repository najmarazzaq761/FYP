import torch
import numpy as np
import sys
import os

# Add model path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

class DepressionPredictor:
    def __init__(self, model_path, device='cpu'):
        self.device = torch.device(device)
        
        # Load model architecture
        try:
            from models.depressiondetector import DepressionDetector
            self.model = DepressionDetector(d=256, l=6, t_downsample=4)
        except:
            # Simplified model if original not available
            self.model = self._create_simple_model()
        
        # Load weights
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
    
    def _create_simple_model(self):
        """Fallback simple model"""
        import torch.nn as nn
        class SimpleModel(nn.Module):
            def __init__(self):
                super().__init__()
                self.fc1 = nn.Linear(25 + 136, 128)
                self.fc2 = nn.Linear(128, 64)
                self.fc3 = nn.Linear(64, 1)
                self.dropout = nn.Dropout(0.3)
            
            def forward(self, x):
                x = torch.relu(self.fc1(x))
                x = self.dropout(x)
                x = torch.relu(self.fc2(x))
                x = self.dropout(x)
                return self.fc3(x)
        return SimpleModel()
    
    def predict(self, audio_features, visual_features):
        """
        Predict depression from features
        
        Args:
            audio_features: numpy array (25,) or (1, 25)
            visual_features: numpy array (T, 136) or (1, T, 136)
        
        Returns:
            dict with prediction results
        """
        # Ensure visual is 3D: (1, T, 136)
        if len(visual_features.shape) == 2:
            visual_features = np.expand_dims(visual_features, axis=0)
            
        B, T, D_v = visual_features.shape
        
        # Ensure audio is 3D: (1, T, 25)
        audio_features = np.reshape(audio_features, (1, 1, 25))
        audio_features = np.repeat(audio_features, T, axis=1)
        
        # Combine: video first (136), then audio (25) -> shape (1, T, 161)
        combined = np.concatenate([visual_features, audio_features], axis=-1)
        combined = torch.FloatTensor(combined).to(self.device)
        
        with torch.no_grad():
            output = self.model(combined)
            if isinstance(output, tuple):
                output = output[0]
            probability = torch.sigmoid(output).item()
        
        if probability <= 0.65:
            label = 'Normal'
        # elif probability <= 0.70:
        #     label = 'Mild Depression'
        else:
            label = 'Depressed'
        
        return {
            'label': label,
            'probability': probability
        }

# Global predictor instance
_predictor = None

def get_predictor():
    global _predictor
    if _predictor is None:
        model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'depression_model.pt')
        _predictor = DepressionPredictor(model_path)
    return _predictor