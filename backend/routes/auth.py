from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from db import query
import json

auth_bp = Blueprint("auth", __name__)

ALLOWED_ROLES = ["super_admin", "admin", "executive", "pharmacy", "doctor", "lab_technician"]


def _parse_permissions(raw):
    if not raw:
        return []
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return []


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get("name"); email = data.get("email")
    password = data.get("password"); role = data.get("role", "executive")

    if not all([name, email, password]):
        return jsonify({"error": "name, email, password are required"}), 400
    if role not in ALLOWED_ROLES:
        return jsonify({"error": "invalid role"}), 400
    if query("SELECT id FROM users WHERE email=%s", (email,)):
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = generate_password_hash(password)
    user_id = query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (%s,%s,%s,%s)",
        (name, email, pw_hash, role), fetch=False, commit=True
    )
    return jsonify({"message": "User registered", "id": user_id}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email"); password = data.get("password")
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = query(
        "SELECT id, name, email, password_hash, role, is_active, permissions, discount_percentage "
        "FROM users WHERE email=%s AND is_active=1",
        (email,)
    )
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    permissions = _parse_permissions(user.get("permissions"))
    discount = float(user.get("discount_percentage") or 0)

    token = create_access_token(
        identity=str(user["id"]),
        additional_claims={
            "role": user["role"],
            "name": user["name"],
            "email": user["email"],
            "permissions": permissions,
            "discount_percentage": discount,
        }
    )
    return jsonify({
        "access_token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "permissions": permissions,
            "discount_percentage": discount,
        }
    })


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    uid = get_jwt_identity()
    row = query(
        "SELECT id, name, email, role, permissions, discount_percentage "
        "FROM users WHERE id=%s", (uid,)
    )
    if not row:
        return jsonify({"error": "User not found"}), 404
    row["permissions"] = _parse_permissions(row.get("permissions"))
    row["discount_percentage"] = float(row.get("discount_percentage") or 0)
    return jsonify(row)