from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

pharmacy_inventory_types_bp = Blueprint("pharmacy_inventory_types", __name__)


def _extract_total(count_row):
    """Normalize a COUNT(*) result regardless of how db.query returns it."""
    if not count_row:
        return 0
    if isinstance(count_row, dict):
        for k in ("total", "COUNT(*)", "count", "count(*)"):
            if k in count_row:
                return int(count_row[k] or 0)
        return int(next(iter(count_row.values()), 0) or 0)
    if isinstance(count_row, (list, tuple)):
        if len(count_row) == 0:
            return 0
        first = count_row[0]
        if isinstance(first, dict):
            return _extract_total(first)
        return int(first or 0)
    try:
        return int(count_row)
    except (TypeError, ValueError):
        return 0


# ---------- GET: list ----------
@pharmacy_inventory_types_bp.route("", methods=["GET"])
@jwt_required()
def list_inventory_types():
    search = request.args.get("search", "") or ""
    try:
        page = int(request.args.get("page", 1) or 1)
    except ValueError:
        page = 1
    try:
        limit = int(request.args.get("limit", 10) or 10)
    except ValueError:
        limit = 10

    if page < 1:
        page = 1
    if limit < 1:
        limit = 10
    if limit > 200:
        limit = 200

    offset = (page - 1) * limit
    like = f"%{search}%"

    count_row = query(
        "SELECT COUNT(*) AS total FROM pharmacy_inventory_types WHERE name LIKE %s",
        (like,)
    )
    total = _extract_total(count_row)

    rows = query(
        """
        SELECT id, name, is_active
        FROM pharmacy_inventory_types
        WHERE name LIKE %s
        ORDER BY name ASC
        LIMIT %s OFFSET %s
        """,
        (like, limit, offset),
        many=True
    ) or []

    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return jsonify({
        "data": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages if total_pages > 0 else 1,
    })


# ---------- POST: create ----------
@pharmacy_inventory_types_bp.route("", methods=["POST"])
@jwt_required()
def create_inventory_type():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    is_active = 1 if data.get("is_active", True) else 0

    if not name:
        return jsonify({"error": "Name is required"}), 400

    existing = query(
        "SELECT id FROM pharmacy_inventory_types WHERE name=%s",
        (name,)
    )
    if existing:
        return jsonify({"error": "Inventory Type already exists"}), 409

    query(
        "INSERT INTO pharmacy_inventory_types (name, is_active) VALUES (%s, %s)",
        (name, is_active),
        commit=True
    )
    return jsonify({"message": "Inventory Type added successfully"}), 201


# ---------- PUT: update ----------
@pharmacy_inventory_types_bp.route("/<int:type_id>", methods=["PUT"])
@jwt_required()
def update_inventory_type(type_id):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    is_active = 1 if data.get("is_active", True) else 0

    if not name:
        return jsonify({"error": "Name is required"}), 400

    query(
        "UPDATE pharmacy_inventory_types SET name=%s, is_active=%s WHERE id=%s",
        (name, is_active, type_id),
        commit=True
    )
    return jsonify({"message": "Inventory Type updated successfully"})


# ---------- DELETE: soft delete ----------
@pharmacy_inventory_types_bp.route("/<int:type_id>", methods=["DELETE"])
@jwt_required()
def delete_inventory_type(type_id):
    query(
        "UPDATE pharmacy_inventory_types SET is_active=0 WHERE id=%s",
        (type_id,),
        commit=True
    )
    return jsonify({"message": "Inventory Type deleted successfully"})
# ---------- GET: all active inventory types (for dropdown / checkbox lists) ----------
@pharmacy_inventory_types_bp.route("/all", methods=["GET"])
@jwt_required()
def all_inventory_types():
    rows = query(
        "SELECT id, name FROM pharmacy_inventory_types "
        "WHERE is_active=1 ORDER BY name ASC",
        many=True
    ) or []
    return jsonify(rows)