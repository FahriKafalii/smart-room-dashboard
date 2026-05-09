import os

from flask import Flask

from . import simulator
from .routes import bp

FRONTEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
)

PORT = 1453


def create_app(start_simulator=True):
    app = Flask(__name__, static_folder=None)
    bp.frontend_dir = FRONTEND_DIR
    app.register_blueprint(bp)
    if start_simulator:
        simulator.start(interval=1.0)
    return app


if __name__ == "__main__":
    app = create_app(start_simulator=True)
    print(f"IoT dashboard hazir: http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)
