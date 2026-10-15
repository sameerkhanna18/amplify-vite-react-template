import hmac
import secrets
import threading

from flask import Flask, jsonify, request
from agent import get_device_audit, AuditError

app = Flask(__name__)

HOST = "127.0.0.1"
PORT = 8765

# Only allow your deployed Amplify application.
ALLOWED_ORIGIN = (
    "https://portable-audit-agent.d3io5lnwh2u6as.amplifyapp.com"
)

# A temporary pairing token generated each time the service starts.
AGENT_TOKEN = secrets.token_urlsafe(32)

audit_lock = threading.Lock()


@app.after_request
def add_security_headers(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"

    origin = request.headers.get("Origin", "")

    if origin == ALLOWED_ORIGIN:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, OPTIONS"
        )
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, X-Agent-Token"
        )
        response.headers["Vary"] = "Origin"

    return response


@app.before_request
def validate_origin():
    # Permit command-line health checks without a browser Origin.
    if request.path == "/health" and not request.headers.get("Origin"):
        return None

    # Browser requests must originate from the deployed application.
    origin = request.headers.get("Origin", "")

    if origin and origin != ALLOWED_ORIGIN:
        return jsonify({"message": "Origin not allowed"}), 403

    return None


@app.get("/health")
def health():
    return jsonify({"status": "ready"})


@app.route("/audit", methods=["POST", "OPTIONS"])
def run_audit():
    # Handle the browser's CORS preflight request.
    if request.method == "OPTIONS":
        return "", 204

    origin = request.headers.get("Origin", "")

    if origin != ALLOWED_ORIGIN:
        return jsonify({"message": "Origin not allowed"}), 403

    supplied_token = request.headers.get("X-Agent-Token", "")

    if not hmac.compare_digest(supplied_token, AGENT_TOKEN):
        return jsonify({"message": "Unauthorized"}), 401

    if not audit_lock.acquire(blocking=False):
        return jsonify({"message": "Audit already running"}), 409

    try:
        audit = get_device_audit()

        # Serial is mandatory.
        serial = audit.get("Serial", "").strip()

        if not serial:
            return jsonify({
                "message": (
                    "A valid hardware serial number could not "
                    "be collected. The audit was not submitted."
                )
            }), 422

        return jsonify(audit), 200

    except AuditError as error:
        return jsonify({"message": str(error)}), 422

    except Exception:
        app.logger.exception("Audit failed")
        return jsonify({"message": "Audit failed"}), 500

    finally:
        audit_lock.release()


if __name__ == "__main__":
    print(f"Device audit service listening on {HOST}:{PORT}")
    print(f"Agent pairing token: {AGENT_TOKEN}")
    print("Keep this terminal open while using the service.")

    app.run(
        host=HOST,
        port=PORT,
        debug=False,
        threaded=True,
    )
