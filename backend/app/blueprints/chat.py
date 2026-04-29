from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..services.chatbot_service import get_chat_response

chat_bp = Blueprint("chat", __name__)


@chat_bp.post("/chat")
@jwt_required(optional=True)
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        reply = get_chat_response(message)
        return jsonify({"reply": reply}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
