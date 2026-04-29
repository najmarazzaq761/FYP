from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Prediction
from ..services.predictor import predict_from_video_bytes

predict_bp = Blueprint("predict", __name__)


@predict_bp.post("/predict")
@jwt_required(optional=True)
def predict():
    if "video" not in request.files:
        print("400 ERROR: No video file found in request")
        return jsonify({"error": "No video file found in request"}), 400

    video = request.files["video"]
    source_type = request.form.get("source_type", "upload")

    video_bytes = video.read()
    if not video_bytes:
        print("400 ERROR: Uploaded video is empty")
        return jsonify({"error": "Uploaded video is empty"}), 400

    try:
        import os
        ext = os.path.splitext(video.filename)[1] if video.filename else ".webm"
        if not ext:
            ext = ".webm"
        prediction = predict_from_video_bytes(video_bytes, ext)
    except ValueError as exc:
        print(f"400 ERROR ValueError: {str(exc)}")
        return jsonify({"error": str(exc)}), 400
    
    identity = get_jwt_identity()
    prediction_id = None
    
    if identity:
        user_id = int(identity)
        record = Prediction(
            user_id=user_id,
            source_type=source_type,
            result_label=prediction["label"],
            probability=prediction["probability"],
        )
        db.session.add(record)
        db.session.commit()
        prediction_id = record.id

    return (
        jsonify(
            {
                "message": "Prediction completed",
                "result": prediction["label"],
                "probability": prediction["probability"],
                "prediction_id": prediction_id,
            }
        ),
        200,
    )
