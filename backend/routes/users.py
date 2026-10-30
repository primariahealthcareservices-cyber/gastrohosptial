from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit, role_required
import json

users_bp = Blueprint("users", __name__)

ALLOWED_ROLES = ["super_admin", "admin", "executive", "doctor", "lab_technician", "pharmacy"]


def blank_to_none(v):
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


# ============================================================
# LIST USERS — super_admin and admin
# ============================================================
@users_bp.route("", methods=["GET"])
@jwt_required()
@role_required("super_admin", "admin")
def list_users():
    rows = query("""
        SELECT id, name, email, role, gender, phone, address, user_belongs_to,
               discount_percentage, permissions, is_active, created_at
        FROM users
        ORDER BY id DESC
    """, many=True)

    for row in rows:
        if row.get("permissions"):
            try:
                row["permissions"] = json.loads(row["permissions"])
            except Exception:
                row["permissions"] = []
        else:
            row["permissions"] = []

    return jsonify(rows)


# ============================================================
# CREATE OR UPDATE USER — super_admin only
# ============================================================
@users_bp.route("", methods=["POST"])
@jwt_required()
@role_required("super_admin")
def upsert_user():
    d = request.get_json(silent=True) or {}
    user_id = d.get("id")
    name = d.get("name")
    email = d.get("email")
    password = d.get("password")
    role = d.get("role", "executive")
    gender = blank_to_none(d.get("gender"))
    phone = blank_to_none(d.get("phone"))
    address = blank_to_none(d.get("address"))
    user_belongs_to = blank_to_none(d.get("user_belongs_to"))
    discount_percentage = d.get("discount_percentage", 0)
    permissions = d.get("permissions", [])
    is_active = 1 if d.get("is_active") else 0

    if not name or not email:
        return jsonify({"error": "name and email are required"}), 400
    if role not in ALLOWED_ROLES:
        return jsonify({"error": "invalid role"}), 400

    permissions_json = json.dumps(permissions) if permissions else None
    actor_id = get_jwt_identity()

    if user_id:
        if not query("SELECT id FROM users WHERE id=%s", (user_id,)):
            return jsonify({"error": "User not found"}), 404

        if password:
            pw_hash = generate_password_hash(password)
            query("UPDATE users SET password_hash=%s WHERE id=%s",
                  (pw_hash, user_id), fetch=False, commit=True)

        query("""
            UPDATE users
            SET name=%s, email=%s, role=%s, gender=%s, phone=%s, address=%s,
                user_belongs_to=%s, discount_percentage=%s, permissions=%s, is_active=%s
            WHERE id=%s
        """, (name, email, role, gender, phone, address, user_belongs_to,
              discount_percentage, permissions_json, is_active, user_id),
        fetch=False, commit=True)

        log_audit(actor_id, "UPDATE_USER", "User Management", user_id, f"Updated {email}")
        return jsonify({"id": user_id, "message": "User updated"}), 200

    if not password:
        return jsonify({"error": "password is required for new user"}), 400
    if query("SELECT id FROM users WHERE email=%s", (email,)):
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = generate_password_hash(password)
    new_id = query("""
        INSERT INTO users (name, email, password_hash, role, gender, phone, address,
                           user_belongs_to, discount_percentage, permissions, is_active)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (name, email, pw_hash, role, gender, phone, address,
          user_belongs_to, discount_percentage, permissions_json, is_active),
    fetch=False, commit=True)

    log_audit(actor_id, "CREATE_USER", "User Management", new_id, f"Created {email} as {role}")
    return jsonify({"id": new_id, "message": "User created"}), 201


# ============================================================
# DELETE USER — super_admin only
# ============================================================
@users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
@role_required("super_admin")
def delete_user(user_id):
    actor_id = get_jwt_identity()
    if int(actor_id) == user_id:
        return jsonify({"error": "You cannot delete your own account"}), 400

    if not query("SELECT id FROM users WHERE id=%s", (user_id,)):
        return jsonify({"error": "User not found"}), 404

    query("DELETE FROM users WHERE id=%s", (user_id,), fetch=False, commit=True)
    log_audit(actor_id, "DELETE_USER", "User Management", user_id, "Deleted user")
    return jsonify({"success": True}), 200


# ============================================================
# DISCOUNT & PERMISSIONS — super_admin only
# ============================================================
@users_bp.route("/<int:user_id>/discount-permissions", methods=["PATCH"])
@jwt_required()
@role_required("super_admin")
def update_discount_permissions(user_id):
    """
    Super admin only.
    Super admin can edit everyone (including other admins and super_admins).
    """
    d = request.get_json(silent=True) or {}
    actor_id = get_jwt_identity()

    target = query("SELECT id, role FROM users WHERE id=%s", (user_id,))
    if not target:
        return jsonify({"error": "User not found"}), 404

    try:
        discount = float(d.get("discount_percentage", 0))
        if discount < 0 or discount > 100:
            return jsonify({"error": "Discount must be between 0 and 100"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid discount value"}), 400

    perms = d.get("permissions", [])
    if not isinstance(perms, list):
        return jsonify({"error": "permissions must be an array"}), 400

    perms_json = json.dumps(perms) if perms else None

    query(
        "UPDATE users SET discount_percentage=%s, permissions=%s WHERE id=%s",
        (discount, perms_json, user_id), fetch=False, commit=True
    )

    log_audit(
        actor_id,
        "UPDATE_DISCOUNT_PERMISSIONS",
        "User Management",
        user_id,
        f"role={target['role']} discount={discount}% permissions={len(perms)} items",
    )

    return jsonify({"message": "Discount and permissions updated"}), 200