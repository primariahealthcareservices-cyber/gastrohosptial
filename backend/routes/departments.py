from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit

departments_bp = Blueprint("departments", __name__)


# ============================================================
# LIST
# ============================================================
@departments_bp.route("", methods=["GET"])
@jwt_required()
def list_departments():
    rows = query("""
        SELECT id, name
        FROM departments
        ORDER BY name
    """, many=True)
    return jsonify(rows)


# ============================================================
# GET ONE
# ============================================================
@departments_bp.route("/<int:dept_id>", methods=["GET"])
@jwt_required()
def get_department(dept_id):
    row = query("SELECT id, name FROM departments WHERE id=%s", (dept_id,))
    if not row:
        return jsonify({"error": "Department not found"}), 404
    return jsonify(row)


# ============================================================
# CREATE / UPDATE
# ============================================================
@departments_bp.route("", methods=["POST"])
@jwt_required()
def upsert_department():
    d = request.get_json() or {}
    dept_id = d.get("id")
    name = (d.get("name") or d.get("department_name") or "").strip()
    actor_id = get_jwt_identity()

    if not name:
        return jsonify({"error": "Department Name is required"}), 400

    if dept_id:
        # Update existing
        existing = query("SELECT id FROM departments WHERE id=%s", (dept_id,))
        if not existing:
            return jsonify({"error": "Department not found"}), 404

        query(
            "UPDATE departments SET name=%s WHERE id=%s",
            (name, dept_id),
            fetch=False,
            commit=True,
        )
        log_audit(actor_id, "UPDATE_DEPARTMENT", "Department", dept_id)
        return jsonify({"id": dept_id, "name": name, "message": "Department updated"}), 200

    # Create new — guard against duplicates (case-insensitive)
    dup = query(
        "SELECT id FROM departments WHERE LOWER(name)=LOWER(%s)",
        (name,),
    )
    if dup:
        return jsonify({"error": "Department already exists"}), 409

    new_id = query(
        "INSERT INTO departments (name) VALUES (%s)",
        (name,),
        fetch=False,
        commit=True,
    )
    log_audit(actor_id, "CREATE_DEPARTMENT", "Department", new_id)
    return jsonify({"id": new_id, "name": name, "message": "Department created"}), 201


# ============================================================
# DELETE
# ============================================================
@departments_bp.route("/<int:dept_id>", methods=["DELETE"])
@jwt_required()
def delete_department(dept_id):
    row = query("SELECT id FROM departments WHERE id=%s", (dept_id,))
    if not row:
        return jsonify({"error": "Department not found"}), 404

    query(
        "DELETE FROM departments WHERE id=%s",
        (dept_id,),
        fetch=False,
        commit=True,
    )
    log_audit(get_jwt_identity(), "DELETE_DEPARTMENT", "Department", dept_id)
    return jsonify({"success": True, "message": "Department deleted"}), 200