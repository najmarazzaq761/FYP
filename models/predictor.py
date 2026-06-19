import torch
import torch.nn as nn
import numpy as np
import sys
import os
import joblib

# Add model path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# ========== GATED MULTIMODAL FUSION MODEL ==========
class GatedFusionModel(nn.Module):
    def __init__(self, audio_dim, visual_dim):
        super(GatedFusionModel, self).__init__()

        # Audio Feature Extractor
        self.audio_net = nn.Sequential(
            nn.Linear(audio_dim, 128),
            nn.BatchNorm1d(128),
            nn.ELU(),
            nn.Dropout(0.4)
        )

        # Visual Feature Extractor
        self.visual_net = nn.Sequential(
            nn.Linear(visual_dim, 256),
            nn.BatchNorm1d(256),
            nn.ELU(),
            nn.Dropout(0.4),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ELU(),
            nn.Dropout(0.4)
        )

        # Gating Mechanism: Learns to weight modalities
        self.gate = nn.Sequential(
            nn.Linear(128 + 128, 128),
            nn.Sigmoid()
        )

        # Final Classifier
        self.classifier = nn.Sequential(
            nn.Linear(128 + 2, 64),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(64, 1)
        )

    def forward(self, audio, visual, gender, duration):
        a_feat = self.audio_net(audio)
        v_feat = self.visual_net(visual)

        # Simple weighted sum fusion based on learned gate
        gate_val = self.gate(torch.cat([a_feat, v_feat], dim=1))
        fused = gate_val * a_feat + (1 - gate_val) * v_feat

        combined = torch.cat([fused, gender, duration], dim=1)
        return self.classifier(combined)


def predict_with_tta(model, audio, visual, gender, duration, n_aug=5):
    """Test-time augmentation for robustness"""
    model.eval()
    probs = []
    with torch.no_grad():
        # Original prediction
        out = model(audio, visual, gender, duration)
        probs.append(torch.sigmoid(out).item())
        # Augmented predictions
        for _ in range(n_aug-1):
            a_aug = audio + torch.randn_like(audio) * 0.01
            v_aug = visual + torch.randn_like(visual) * 0.01
            out_aug = model(a_aug, v_aug, gender, duration)
            probs.append(torch.sigmoid(out_aug).item())
    return np.mean(probs)


class FinalDepressionPredictor:
    def __init__(self, ensemble_paths, scalers_path, threshold=0.55, device='cpu'):
        self.device = torch.device(device)
        self.threshold = threshold
        
        # Load scalers
        self.audio_scaler = joblib.load(os.path.join(scalers_path, 'audio_scaler.joblib'))
        self.visual_scaler = joblib.load(os.path.join(scalers_path, 'visual_scaler.joblib'))
        self.duration_scaler = joblib.load(os.path.join(scalers_path, 'duration_scaler.joblib'))
        
        audio_dim = self.audio_scaler.n_features_in_
        visual_dim = self.visual_scaler.n_features_in_
        
        self.ensemble_models = []
        for p in ensemble_paths:
            m = GatedFusionModel(audio_dim, visual_dim)
            m.load_state_dict(torch.load(p, map_location=self.device))
            m.to(self.device)
            m.eval()
            self.ensemble_models.append(m)

    def predict(self, audio_seq, visual_seq, gender, duration):
        """
        Predict depression from features
        
        Args:
            audio_seq: numpy array (T, 25)
            visual_seq: numpy array (T, 136)
            gender: int (1 for Male, 0 for Female)
            duration: float (in seconds)
        """
        
        # 1. Feature Aggregation (Mean + Std over time)
        if len(audio_seq) == 0 or np.all(audio_seq == 0):
            audio_ext = self.audio_scaler.mean_.copy().reshape(1, -1)
        else:
            a_mean = np.mean(audio_seq, axis=0)
            a_std = np.std(audio_seq, axis=0)
            if np.all(a_std == 0):
                a_std = self.audio_scaler.mean_[25:].copy()
            audio_ext = np.hstack([a_mean, a_std]).reshape(1, -1)
            
        if len(visual_seq) == 0 or np.all(visual_seq == 0):
            visual_ext = self.visual_scaler.mean_.copy().reshape(1, -1)
        else:
            v_mean = np.mean(visual_seq, axis=0)
            v_std = np.std(visual_seq, axis=0)
            if np.all(v_std == 0):
                v_std = self.visual_scaler.mean_[136:].copy()
            visual_ext = np.hstack([v_mean, v_std]).reshape(1, -1)

        # 2. Scale Features
        audio_norm = self.audio_scaler.transform(audio_ext)
        visual_norm = self.visual_scaler.transform(visual_ext)
        duration_norm = self.duration_scaler.transform(np.array([[duration]]))

        # 3. Convert to Tensors
        a_t = torch.FloatTensor(audio_norm).to(self.device)
        v_t = torch.FloatTensor(visual_norm).to(self.device)
        g_t = torch.FloatTensor([[gender]]).to(self.device)
        d_t = torch.FloatTensor(duration_norm).to(self.device)

        # 4. Ensemble Prediction with TTA
        prob = np.mean([predict_with_tta(m, a_t, v_t, g_t, d_t) for m in self.ensemble_models])

        label = "Depressed" if prob > self.threshold else "Normal"
        
        return {
            'label': label,
            'probability': float(prob)
        }

# Global predictor instance
_predictor = None

def get_predictor():
    global _predictor
    if _predictor is None:
        models_dir = os.path.dirname(__file__)
        ensemble_paths = [
            os.path.join(models_dir, 'ensemble_model_0.pt'),
            os.path.join(models_dir, 'ensemble_model_1.pt')
        ]
        _predictor = FinalDepressionPredictor(ensemble_paths, models_dir)
    return _predictor