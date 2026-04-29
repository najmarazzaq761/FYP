from flask import Flask, jsonify

from .blueprints.auth import auth_bp
from .blueprints.chat import chat_bp
from .blueprints.history import history_bp
from .blueprints.predict import predict_bp
from .config import Config
from .extensions import bcrypt, cors, db, jwt


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(predict_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(history_bp, url_prefix="/api")

    @app.get("/api/health")
    def health_check():
        return jsonify({"status": "ok"})

    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print(f"Note: db.create_all() encountered an error (likely concurrent creation): {e}")

    return app
