from .app import create_app, PORT

if __name__ == "__main__":
    app = create_app(start_simulator=True)
    print(f"IoT dashboard hazır: http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)
