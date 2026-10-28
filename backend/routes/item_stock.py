from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

item_stock_bp = Blueprint("item_stock", __name__)


def _extract_total(count_row):
    if not count_row:
        return 0
    if isinstance(count_row, dict):
        return int(count_row.get("total", 0) or 0)
    if isinstance(count_row, (list, tuple)):
        return int(count_row[0] or 0) if len(count_row) > 0 else 0
    return int(count_row)


@item_stock_bp.route("", methods=["GET"])
@jwt_required()
def list_stock():
    search = request.args.get("search", "") or ""
    try:
        page = int(request.args.get("page", 1) or 1)
        limit = int(request.args.get("limit", 50) or 50)
    except ValueError:
        page, limit = 1, 50

    offset = (page - 1) * limit
    like = f"%{search}%"

    count_row = query(
        "SELECT COUNT(*) AS total FROM pharmacy_items WHERE name LIKE %s",
        (like,)
    )
    total = _extract_total(count_row)

    rows = query(
        """
        SELECT
            pi.id,
            pi.name AS item_name,
            pi.batch_no,
            pi.stock_qty AS available_stock,
            pi.original_stock,
            pi.mrp AS new_mrp,
            pi.old_mrp,
            pi.rate,
            pi.old_tax_percent,
            pi.new_tax_percent,
            pi.exp_date,
            pi.purchase_date,
            pi.hsn_code,
            pi.pack,
            pi.rack,
            pi.composition,
            pi.drug_combination,
            pi.avg_monthly_usage,
            pi.item_type,
            pi.manufacturer,
            s.name AS supplier_name,
            s.gst_no AS supplier_gst,
            pi.doctor_name,
            pi.is_active
        FROM pharmacy_items pi
        LEFT JOIN grn g ON g.id = pi.grn_id
        LEFT JOIN suppliers s ON s.id = g.supplier_id
        WHERE pi.name LIKE %s
        ORDER BY pi.name ASC, pi.exp_date ASC
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
        "total_pages": total_pages
    })


# --- NEW ENDPOINT: Used by Purchase Order autocomplete ---
@item_stock_bp.route("/all-names", methods=["GET"])
@jwt_required()
def all_stock_names():
    rows = query(
        """
        SELECT 
            id, name, batch_no, mrp, rate, 
            old_tax_percent, new_tax_percent, pack, hsn_code, 
            manufacturer, exp_date, item_type, composition, drug_combination
        FROM pharmacy_items
        WHERE is_active = 1
        ORDER BY name ASC
        """,
        many=True
    ) or []
    return jsonify(rows)
# ---------------------------------------------------------


@item_stock_bp.route("", methods=["POST"])
@jwt_required()
def create_stock_item():
    data = request.get_json() or {}
    name = (data.get("item_name") or "").strip()
    if not name:
        return jsonify({"error": "Item Name is required"}), 400

    # Find a valid store_id or create a default one
    store_row = query("SELECT id FROM pharmacy_stores LIMIT 1")
    if store_row:
        store_id = store_row["id"]
    else:
        query("INSERT INTO pharmacy_stores (name) VALUES ('Main Pharmacy Store')", fetch=False, commit=True)
        store_row = query("SELECT id FROM pharmacy_stores LIMIT 1")
        store_id = store_row["id"]

    query("""
        INSERT INTO pharmacy_items (
            store_id, name, batch_no, mrp, old_mrp, rate,
            old_tax_percent, new_tax_percent, stock_qty, original_stock,
            purchase_date, exp_date, hsn_code, manufacturer, item_type,
            pack, rack, composition, drug_combination, avg_monthly_usage,
            doctor_name, is_active
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, 1
        )
    """, (
        store_id, name, 
        data.get("batch_no") or None,
        data.get("new_mrp") or 0,
        data.get("old_mrp") or 0,
        data.get("rate") or 0,
        data.get("old_tax_percent") or 0,
        data.get("new_tax_percent") or 0,
        data.get("available_stock") or 0,
        data.get("original_stock") or 0,
        data.get("purchase_date") or None,
        data.get("exp_date") or None,
        data.get("hsn_code") or None,
        data.get("manufacturer") or None,
        data.get("item_type") or None,
        data.get("pack") or None,
        data.get("rack") or None,
        data.get("composition") or None,
        data.get("drug_combination") or None,
        data.get("avg_monthly_usage") or 0,
        data.get("doctor_name") or None
    ), fetch=False, commit=True)

    return jsonify({"message": "Stock item added successfully"}), 201