from flask import Blueprint, jsonify, request, send_from_directory

from . import state

bp = Blueprint("api", __name__)


@bp.route("/", methods=["GET"])
def index():
    return send_from_directory(bp.frontend_dir, "index.html")


@bp.route("/<path:path>", methods=["GET"])
def static_assets(path):
    return send_from_directory(bp.frontend_dir, path)


@bp.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "message": "IoT dashboard backend çalışıyor.",
    })


@bp.route("/api/data", methods=["GET"])
def data():
    return jsonify({
        "data": state.get_data(),
        "devices": state.get_devices(),
    })


@bp.route("/api/history", methods=["GET"])
def history():
    return jsonify({"history": state.get_history()})


@bp.route("/api/control", methods=["GET", "POST"])
def control():
    if request.method == "GET":
        return jsonify({"devices": state.get_devices()})

    payload = request.get_json(silent=True) or {}
    device = payload.get("device")
    new_state = payload.get("state")

    if not device or not new_state:
        return jsonify({"error": "device ve state alanları zorunludur."}), 400

    ok, message = state.set_device(device, new_state)
    if not ok:
        return jsonify({"error": message}), 400

    return jsonify({
        "ok": True,
        "device": device,
        "state": new_state,
        "devices": state.get_devices(),
    })
