from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

pharmacy_inventory_types_bp = Blueprint("pharmacy_inventory_types", __name__)

def _extract_total(count_row):
    if not count_row:
        return 0
    if isinstance(count_row, dict):
        return int(count_row.get("total", 0) or 0)
    if isinstance(count_row, (list, tuple)):
        return int(count_row[0] or 0) if len(count_row) > 0 else 0
    return int(count_row)

@pharmacy_inventory_types_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_active():
    rows = query(
        "SELECT id, name FROM pharmacy_inventory_types WHERE is_active=1 ORDER BY name ASC",
        many=True
    ) or []
    return jsonify(rows)

@pharmacy_inventory_types_bp.route("", methods=["GET"])
@jwt_required()
def list_inventory_types():
    search = request.args.get("search", "") or ""
    try:
        page = int(request.args.get("page", 1) or 1)
        limit = int(request.args.get("limit", 10) or 10)
    except ValueError:
        page, limit = 1, 10

    offset = (page - 1) * limit
    like = f"%{search}%"

    count_row = query("SELECT COUNT(*) AS total FROM pharmacy_inventory_types WHERE name LIKE %s", (like,))
    total = _extract_total(count_row)

    rows = query(
        "SELECT id, name, is_active FROM pharmacy_inventory_types WHERE name LIKE %s ORDER BY name ASC LIMIT %s OFFSET %s",
        (like, limit, offset),
        many=True
    ) or []

    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return jsonify({
        "data": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    })

@pharmacy_inventory_types_bp.route("", methods=["POST"])
@jwt_required()
def create_inventory_type():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    is_active = 1 if data.get("is_active", True) else 0

    if not name:
        return jsonify({"error": "Name is required"}), 400

    query(
        "INSERT INTO pharmacy_inventory_types (name, is_active) VALUES (%s, %s)",
        (name, is_active),
        fetch=False,
        commit=True
    )
    return jsonify({"message": "Created successfully"}), 201

@pharmacy_inventory_types_bp.route("/<int:id>", methods=["PUT"])
@jwt_required()
def update_inventory_type(id):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    is_active = 1 if data.get("is_active", True) else 0

    if not name:
        return jsonify({"error": "Name is required"}), 400

    query(
        "UPDATE pharmacy_inventory_types SET name=%s, is_active=%s WHERE id=%s",
        (name, is_active, id),
        fetch=False,
        commit=True
    )
    return jsonify({"message": "Updated successfully"}), 200

@pharmacy_inventory_types_bp.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_inventory_type(id):
    query(
        "DELETE FROM pharmacy_inventory_types WHERE id=%s",
        (id,),
        fetch=False,
        commit=True
    )
    return jsonify({"message": "Deleted successfully"}), 200