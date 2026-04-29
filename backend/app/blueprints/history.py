from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models import Prediction

history_bp = Blueprint("history", __name__)


@history_bp.get("/history")
@jwt_required()
def history():
    user_id = int(get_jwt_identity())
    rows = (
        Prediction.query.filter_by(user_id=user_id)
        .order_by(Prediction.created_at.asc())
        .all()
    )
    payload = [
        {
            "id": row.id,
            "source_type": row.source_type,
            "result_label": row.result_label,
            "probability": row.probability,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
    return jsonify({"history": payload}), 200
