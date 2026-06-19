import os
import tempfile

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Prediction
from ..services.text_predictor import predict_mental_health

predict_bp = Blueprint("predict", __name__)


def _save_prediction(identity, source_type, label, probability):
    """Helper: persist a prediction record for authenticated users."""
    if not identity:
        return None
    user_id = int(identity)
    record = Prediction(
        user_id=user_id,
        source_type=source_type,
        result_label=label,
        probability=probability,
    )
    db.session.add(record)
    db.session.commit()
    return record.id


# ─────────────────────────────────────────────
# TEXT PREDICTION  →  /api/predict/text
# ─────────────────────────────────────────────
@predict_bp.post("/predict/text")
@jwt_required(optional=True)
def predict_text():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided in request"}), 400

    try:
        prediction = predict_mental_health(text)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        print(f"500 ERROR text prediction: {exc}")
        return jsonify({"error": "Model prediction failed, please try again."}), 500

    prediction_id = _save_prediction(
        get_jwt_identity(), "text", prediction["label"], prediction["probability"]
    )

    return jsonify({
        "message": "Prediction completed",
        "result": prediction["label"],
        "probability": prediction["probability"],
        "prediction_id": prediction_id,
    }), 200


# ─────────────────────────────────────────────
# VIDEO PREDICTION  →  /api/predict/video
# ─────────────────────────────────────────────
@predict_bp.post("/predict/video")
@jwt_required(optional=True)
def predict_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file found in request"}), 400

    video = request.files["video"]
    source_type = request.form.get("source_type", "upload")

    video_bytes = video.read()
    if not video_bytes:
        return jsonify({"error": "Uploaded video is empty"}), 400

    try:
        ext = os.path.splitext(video.filename)[1] if video.filename else ".webm"
        if not ext:
            ext = ".webm"

        gender_str = request.form.get("gender", "1")
        try:
            gender = int(gender_str)
        except ValueError:
            gender = 1

        # Import lazily so text-only startup doesn't require heavy video deps
        from ..services.predictor import predict_from_video_bytes
        prediction = predict_from_video_bytes(video_bytes, ext, gender)

    except ValueError as exc:
        print(f"400 ERROR video prediction: {exc}")
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        print(f"500 ERROR video prediction: {exc}")
        return jsonify({"error": "Video prediction failed, please try again."}), 500

    prediction_id = _save_prediction(
        get_jwt_identity(), source_type, prediction["label"], prediction["probability"]
    )

    return jsonify({
        "message": "Prediction completed",
        "result": prediction["label"],
        "probability": prediction["probability"],
        "prediction_id": prediction_id,
    }), 200
