# backend/routes/pharmacy_op_sales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

pharmacy_op_sales_bp = Blueprint("pharmacy_op_sales", __name__)

# ============================================================
# 1. OP patients for the search modal
# ============================================================
@pharmacy_op_sales_bp.route("/search-patients", methods=["GET"])
@jwt_required()
def search_op_patients():
    search = (request.args.get("search") or "").strip()
    from_date = request.args.get("from_date")
    to_date = request.args.get("to_date")
    
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

    base_from = """
        FROM op_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE (r.status IS NULL OR r.status != 'Cancelled')
          AND r.opd_reg_no LIKE 'OP%'
    """
    params = []
    where_extra = ""

    if search:
        where_extra += """
            AND (
                r.opd_reg_no LIKE %s
                OR p.patient_uid LIKE %s
                OR r.first_name LIKE %s
                OR CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) LIKE %s
                OR r.mobile LIKE %s
            )
        """
        term = f"%{search}%"
        params.extend([term, term, term, term, term])

    if from_date:
        where_extra += " AND DATE(r.created_at) >= %s"
        params.append(from_date)
    if to_date:
        where_extra += " AND DATE(r.created_at) <= %s"
        params.append(to_date)

    count_sql = "SELECT COUNT(*) AS total " + base_from + where_extra
    total_result = query(count_sql, tuple(params))
    total = total_result["total"] if total_result else 0

    sql = f"""
        SELECT
            r.id,
            p.patient_uid AS mr_number,
            r.opd_reg_no,
            {name_expr} AS name,
            r.mobile,
            r.gender,
            TIMESTAMPDIFF(YEAR, r.dob, CURDATE()) AS age,
            r.doctor_id,
            doc.name AS doctor_name
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
# 2. OP doctors for the dropdown
# ============================================================
@pharmacy_op_sales_bp.route("/doctors", methods=["GET"])
@jwt_required()
def list_doctors():
    try:
        doctors = query("SELECT id, name FROM doctors ORDER BY name ASC", many=True)
        return jsonify(doctors if isinstance(doctors, list) else [])
    except Exception as e:
        print(f"Error fetching doctors: {e}")
        return jsonify([])

# ============================================================
# 3. Drug Combinations (Item Types)
# ============================================================
@pharmacy_op_sales_bp.route("/search-combinations", methods=["GET"])
@jwt_required()
def search_combinations():
    search = (request.args.get("search") or "").strip()
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 10))))
    except ValueError:
        page, limit = 1, 10
    offset = (page - 1) * limit

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