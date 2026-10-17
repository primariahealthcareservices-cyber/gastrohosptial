from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

pharmacy_item_types_bp = Blueprint("pharmacy_item_types", __name__)


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
@pharmacy_item_types_bp.route("", methods=["GET"])
@jwt_required()
def list_item_types():
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
        "SELECT COUNT(*) AS total FROM pharmacy_item_types WHERE name LIKE %s",
        (like,)
    )
    total = _extract_total(count_row)

    rows = query(
        """
        SELECT it.id, it.name, it.inventory_type_id, it.is_active,
               inv.name AS inventory_name
        FROM pharmacy_item_types it
        LEFT JOIN pharmacy_inventory_types inv ON inv.id = it.inventory_type_id
        WHERE it.name LIKE %s
        ORDER BY it.name ASC
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
@pharmacy_item_types_bp.route("", methods=["POST"])
@jwt_required()
def create_item_type():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    inventory_type_id = data.get("inventory_type_id")
    is_active = 1 if data.get("is_active", True) else 0

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not inventory_type_id:
        return jsonify({"error": "Inventory Type is required"}), 400

    existing = query(
        "SELECT id FROM pharmacy_item_types "
        "WHERE name=%s AND inventory_type_id=%s",
        (name, inventory_type_id)
    )
    if existing:
        return jsonify({"error": "Item Type already exists for this Inventory Type"}), 409

    query(
        "INSERT INTO pharmacy_item_types (name, inventory_type_id, is_active) "
        "VALUES (%s, %s, %s)",
        (name, inventory_type_id, is_active),
        commit=True
    )
    return jsonify({"message": "Item Type added successfully"}), 201


# ---------- PUT: update ----------
@pharmacy_item_types_bp.route("/<int:type_id>", methods=["PUT"])
@jwt_required()
def update_item_type(type_id):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    inventory_type_id = data.get("inventory_type_id")
    is_active = 1 if data.get("is_active", True) else 0

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not inventory_type_id:
        return jsonify({"error": "Inventory Type is required"}), 400

    query(
        "UPDATE pharmacy_item_types SET name=%s, inventory_type_id=%s, is_active=%s "
        "WHERE id=%s",
        (name, inventory_type_id, is_active, type_id),
        commit=True
    )
    return jsonify({"message": "Item Type updated successfully"})


# ---------- DELETE: soft delete ----------
@pharmacy_item_types_bp.route("/<int:type_id>", methods=["DELETE"])
@jwt_required()
def delete_item_type(type_id):
    query(
        "UPDATE pharmacy_item_types SET is_active=0 WHERE id=%s",
        (type_id,),
        commit=True
    )
    return jsonify({"message": "Item Type deleted successfully"})


# ---------- GET: dropdown for the Add/Edit modal ----------
@pharmacy_item_types_bp.route("/inventory-types-dropdown", methods=["GET"])
@jwt_required()
def inventory_types_dropdown():
    rows = query(
        "SELECT id, name FROM pharmacy_inventory_types "
        "WHERE is_active=1 ORDER BY name ASC",
        many=True
    ) or []
    return jsonify(rows)
@pharmacy_item_types_bp.route("/all-names", methods=["GET"])
@jwt_required()
def all_item_type_names():
    rows = query(
        """
        SELECT it.id, it.name, inv.name AS inventory_type
        FROM pharmacy_item_types it
        LEFT JOIN pharmacy_inventory_types inv ON inv.id = it.inventory_type_id
        WHERE it.is_active=1
        ORDER BY it.name ASC
        """,
        many=True
    ) or []
    return jsonify(rows)