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


@item_stock_bp.route("", methods=["POST"])
@jwt_required()
def create_stock_item():
    data = request.get_json() or {}
    name = (data.get("item_name") or "").strip()
    if not name:
        return jsonify({"error": "Item Name is required"}), 400

    store_row = query("SELECT id FROM pharmacy_stores LIMIT 1")
    if store_row:
        store_id = store_row["id"]
    else:
        query("INSERT INTO pharmacy_stores (name) VALUES ('Main Pharmacy Store')", fetch=False, commit=True)
        store_row = query("SELECT id FROM pharmacy_stores LIMIT 1")
        store_id = store_row["id"]

    # Robust date formatter
    def format_date(val):
        if not val or str(val).strip() == "":
            return None
        val = str(val).strip()
        if len(val) == 10 and val[4] == '-' and val[7] == '-':
            return val
        if 'T' in val:
            return val[:10]
        return None

    def safe_num(val, default=0):
        if val == "" or val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    try:
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
            safe_num(data.get("new_mrp")),
            safe_num(data.get("old_mrp")),
            safe_num(data.get("rate")),
            safe_num(data.get("old_tax_percent")),
            safe_num(data.get("new_tax_percent")),
            safe_num(data.get("available_stock")),
            safe_num(data.get("original_stock")),
            format_date(data.get("purchase_date")),
            format_date(data.get("exp_date")),
            data.get("hsn_code") or None,
            data.get("manufacturer") or None,
            data.get("item_type") or None,
            data.get("pack") or None,
            data.get("rack") or None,
            data.get("composition") or None,
            data.get("drug_combination") or None,
            safe_num(data.get("avg_monthly_usage")),
            data.get("doctor_name") or None
        ), fetch=False, commit=True)
        return jsonify({"message": "Stock item added successfully"}), 201
    except Exception as e:
        print("\n--- DATABASE INSERT ERROR ---")
        print(str(e))
        print("-----------------------------\n")
        return jsonify({"error": "Database error", "details": str(e)}), 500


# --- UPDATE STOCK ITEM ---
@item_stock_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def update_stock_item(item_id):
    data = request.get_json() or {}
    name = (data.get("item_name") or "").strip()
    if not name:
        return jsonify({"error": "Item Name is required"}), 400

    existing = query("SELECT id FROM pharmacy_items WHERE id=%s", (item_id,))
    if not existing:
        return jsonify({"error": "Item not found"}), 404

    # Robust date formatter
    def format_date(val):
        if not val or str(val).strip() == "":
            return None
        val = str(val).strip()
        if len(val) == 10 and val[4] == '-' and val[7] == '-':
            return val
        if 'T' in val:
            return val[:10]
        return None

    def safe_num(val, default=0):
        if val == "" or val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    try:
        query("""
            UPDATE pharmacy_items SET
                name=%s, batch_no=%s, mrp=%s, old_mrp=%s, rate=%s,
                old_tax_percent=%s, new_tax_percent=%s, stock_qty=%s, original_stock=%s,
                purchase_date=%s, exp_date=%s, hsn_code=%s, manufacturer=%s, item_type=%s,
                pack=%s, rack=%s, composition=%s, drug_combination=%s, avg_monthly_usage=%s,
                doctor_name=%s
            WHERE id=%s
        """, (
            name,
            data.get("batch_no") or None,
            safe_num(data.get("new_mrp")),
            safe_num(data.get("old_mrp")),
            safe_num(data.get("rate")),
            safe_num(data.get("old_tax_percent")),
            safe_num(data.get("new_tax_percent")),
            safe_num(data.get("available_stock")),
            safe_num(data.get("original_stock")),
            format_date(data.get("purchase_date")),
            format_date(data.get("exp_date")),
            data.get("hsn_code") or None,
            data.get("manufacturer") or None,
            data.get("item_type") or None,
            data.get("pack") or None,
            data.get("rack") or None,
            data.get("composition") or None,
            data.get("drug_combination") or None,
            safe_num(data.get("avg_monthly_usage")),
            data.get("doctor_name") or None,
            item_id
        ), fetch=False, commit=True)

        return jsonify({"message": "Stock item updated successfully"}), 200
    
    except Exception as e:
        print("\n--- DATABASE UPDATE ERROR ---")
        print(str(e))
        print("-----------------------------\n")
        return jsonify({"error": "Database error", "details": str(e)}), 500