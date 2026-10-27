# backend/routes/pharmacy_ip_sales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

pharmacy_ip_sales_bp = Blueprint("pharmacy_ip_sales", __name__)

# ============================================================
# 1. IP patients for the search modal (FIXED)
# ============================================================
@pharmacy_ip_sales_bp.route("/search-patients", methods=["GET"])
@jwt_required()
def search_ip_patients():
    search = (request.args.get("search") or "").strip()
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 10))))
    except ValueError:
        page, limit = 1, 10
    offset = (page - 1) * limit

    name_expr = """TRIM(CONCAT(
        IF(r.title IS NULL OR r.title = '', '', CONCAT(r.title, '. ')),
        r.first_name, ' ', IFNULL(r.last_name, '')
    ))"""

    # ✅ FIX: Removed strict 'Admitted' filter. Just ignore discharged/cancelled.
    base_from = """
        FROM ip_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE (r.status IS NULL OR LOWER(r.status) NOT IN ('discharged', 'cancelled', 'canceled'))
    """
    params = []
    where_extra = ""

    if search:
        where_extra = """
            AND (
                r.ip_reg_no LIKE %s
                OR p.patient_uid LIKE %s
                OR r.first_name LIKE %s
                OR CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) LIKE %s
                OR r.mobile LIKE %s
            )
        """
        term = f"%{search}%"
        params.extend([term, term, term, term, term])

    count_sql = "SELECT COUNT(*) AS total " + base_from + where_extra
    total_result = query(count_sql, tuple(params))
    total = total_result["total"] if total_result else 0

    sql = f"""
        SELECT
            r.id,
            p.patient_uid AS mr_number,
            r.ip_reg_no,
            {name_expr} AS name,
            r.mobile,
            r.gender,
            r.age,
            doc.name AS doctor_name,
            r.floor,
            r.room_type,
            r.room_no,
            r.bed_no
        {base_from}
        {where_extra}
        ORDER BY r.id DESC
        LIMIT %s OFFSET %s
    """
    data_params = list(params) + [limit, offset]
    patients = query(sql, tuple(data_params), many=True)

    return jsonify({
        "data": patients or [],
        "total": total,
        "page": page,
        "limit": limit,
    })

# ============================================================
# 2. Sale drafts
# ============================================================
@pharmacy_ip_sales_bp.route("/drafts/<int:ip_registration_id>", methods=["GET"])
@jwt_required()
def get_ip_sale_drafts(ip_registration_id):
    drafts = query(
        """
        SELECT id, sale_no, total_amount, net_amount, created_at
        FROM pharmacy_sales
        WHERE ip_registration_id = %s AND sale_type = 'IP' AND status = 'Draft'
        ORDER BY id DESC
        """,
        (ip_registration_id,),
        many=True,
    )
    return jsonify(drafts or [])

# ============================================================
# 3. Stores
# ============================================================
@pharmacy_ip_sales_bp.route("/stores", methods=["GET"])
@jwt_required()
def list_stores():
    try:
        stores = query("SELECT id, name FROM pharmacy_stores", many=True)
        return jsonify(stores if isinstance(stores, list) else [])
    except Exception as e:
        print(f"Error fetching stores: {e}")
        return jsonify([])

# ============================================================
# 4. Search Drug Combinations (FIXED)
# ============================================================
@pharmacy_ip_sales_bp.route("/search-combinations", methods=["GET"])
@jwt_required()
def search_combinations():
    search = (request.args.get("search") or "").strip()
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 10))))
    except ValueError:
        page, limit = 1, 10
    offset = (page - 1) * limit

    # ✅ FIX: Query pharmacy_item_types which matches the ItemType.jsx frontend table
    base_from = """
        FROM pharmacy_item_types it
        LEFT JOIN pharmacy_inventory_types inv ON inv.id = it.inventory_type_id
        WHERE 1=1
    """
    params = []
    where_extra = ""

    if search:
        where_extra = " AND (it.name LIKE %s OR inv.name LIKE %s)"
        term = f"%{search}%"
        params.extend([term, term])

    count_sql = "SELECT COUNT(*) AS total " + base_from + where_extra
    total_result = query(count_sql, tuple(params))
    total = total_result["total"] if total_result else 0

    sql = f"""
        SELECT 
            it.id, 
            it.name AS item_name, 
            IFNULL(inv.name, 'General') AS drug_combination, 
            0 AS qty
        {base_from}
        {where_extra}
        ORDER BY it.name ASC
        LIMIT %s OFFSET %s
    """
    data_params = list(params) + [limit, offset]
    items = query(sql, tuple(data_params), many=True)

    return jsonify({
        "data": items or [],
        "total": total,
        "page": page,
        "limit": limit,
    })