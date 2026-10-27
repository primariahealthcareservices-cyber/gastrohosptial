from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import next_code, log_audit

pharmacy_sales_bp = Blueprint("pharmacy_sales", __name__)


def compute_totals(items, discount_percent, paid_amount):
    total = sum(float(i.get("qty", 0)) * float(i.get("mrp", 0)) for i in items)
    total = round(total, 2)
    discount_amount = round(total * float(discount_percent or 0) / 100, 2)
    net = round(max(0, total - discount_amount), 2)
    paid = float(paid_amount or 0)
    due = round(max(0, net - paid), 2)
    return total, discount_amount, net, due


def clean_val(val):
    """Converts empty strings to None to prevent SQL integer constraint errors."""
    if val is None or (isinstance(val, str) and val.strip() == ""):
        return None
    return val


@pharmacy_sales_bp.route("", methods=["POST"])
@jwt_required()
def create_sale():
    d = request.get_json() or {}
    sale_type = d.get("sale_type")  # 'IP' | 'OP' | 'Direct'
    items = d.get("items", [])

    if sale_type not in ("IP", "OP", "Direct"):
        return jsonify({"error": "sale_type must be IP, OP, or Direct"}), 400
    if not items:
        return jsonify({"error": "At least one item is required"}), 400

    # Default to Main Store (1) if not provided
    store_id = d.get("store_id") or 1

    total, discount_amount, net, due = compute_totals(items, d.get("discount_percent", 0), d.get("paid_amount", 0))
    status = "Draft" if d.get("save_as_draft") else "Submitted"
    user_id = get_jwt_identity()
    sale_no = next_code("PS", "pharmacy_sales", "sale_no")

    try:
        # 1. Insert into pharmacy_sales
        sid = query("""
            INSERT INTO pharmacy_sales (
                sale_no, sale_type, patient_id, ip_registration_id, op_registration_id, doctor_id,
                store_id, total_amount, discount_percent, discount_amount, net_amount,
                payment_mode, paid_amount, due_amount, remarks, status, created_by
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            sale_no, 
            sale_type, 
            clean_val(d.get("patient_id")), 
            clean_val(d.get("ip_registration_id")), 
            clean_val(d.get("op_registration_id")),
            clean_val(d.get("doctor_id")), 
            store_id, 
            total, 
            d.get("discount_percent", 0), 
            discount_amount, 
            net,
            d.get("payment_mode", "Cash"), 
            d.get("paid_amount", 0), 
            due, 
            clean_val(d.get("remarks")), 
            status, 
            user_id
        ), fetch=False, commit=True)

        # 2. Insert into pharmacy_sale_items
        for item in items:
            qty = float(item.get("qty", 0))
            mrp = float(item.get("mrp", 0))
            query("""
                INSERT INTO pharmacy_sale_items (
                    sale_id, item_id, item_name, batch_no, old_tax_percent, new_tax_percent,
                    grn_id, qty, mrp, amount
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                sid, 
                clean_val(item.get("item_id")), # FIX: Prevents 500 error if item_id is empty string
                item.get("item_name"), 
                clean_val(item.get("batch_no")),
                item.get("old_tax_percent", 0), 
                item.get("new_tax_percent", 0), 
                clean_val(item.get("grn_id")),
                qty, 
                mrp, 
                round(qty * mrp, 2)
            ), fetch=False, commit=True)

        log_audit(user_id, "CREATE", f"Pharmacy {sale_type} Sale", sid)
        sale = query("SELECT * FROM pharmacy_sales WHERE id=%s", (sid,))
        sale["items"] = query("SELECT * FROM pharmacy_sale_items WHERE sale_id=%s", (sid,), many=True)
        return jsonify(sale), 201

    except Exception as e:
        # This prints the exact SQL error to your backend terminal if it fails again
        print(f"SQL Error in create_sale: {e}")
        return jsonify({"error": str(e)}), 500


@pharmacy_sales_bp.route("", methods=["GET"])
@jwt_required()
def list_sales():
    sale_type = request.args.get("sale_type")
    status = request.args.get("status")
    search = request.args.get("search")
    ip_registration_id = request.args.get("ip_registration_id")
    op_registration_id = request.args.get("op_registration_id")

    sql = "SELECT * FROM pharmacy_sales WHERE 1=1"
    params = []

    if sale_type:
        sql += " AND sale_type=%s"
        params.append(sale_type)
    if status:
        sql += " AND status=%s"
        params.append(status)
    if ip_registration_id:
        sql += " AND ip_registration_id=%s"
        params.append(ip_registration_id)
    if op_registration_id:
        sql += " AND op_registration_id=%s"
        params.append(op_registration_id)

    if search:
        term = f"%{search}%"
        if sale_type == "OP":
            sql += """ AND (
                sale_no LIKE %s
                OR op_registration_id IN (SELECT id FROM op_registrations WHERE opd_reg_no LIKE %s)
            )"""
            params.extend([term, term])
        elif sale_type == "IP":
            sql += """ AND (
                sale_no LIKE %s
                OR ip_registration_id IN (SELECT id FROM ip_registrations WHERE ip_reg_no LIKE %s)
            )"""
            params.extend([term, term])
        else:
            sql += """ AND (
                sale_no LIKE %s
                OR ip_registration_id IN (SELECT id FROM ip_registrations WHERE ip_reg_no LIKE %s)
                OR op_registration_id IN (SELECT id FROM op_registrations WHERE opd_reg_no LIKE %s)
            )"""
            params.extend([term, term, term])

    sql += " ORDER BY id DESC"

    return jsonify(query(sql, tuple(params), many=True))


@pharmacy_sales_bp.route("/drafts", methods=["GET"])
@jwt_required()
def list_drafts():
    sale_type = request.args.get("sale_type")
    sql = "SELECT * FROM pharmacy_sales WHERE status='Draft'"
    params = []
    if sale_type:
        sql += " AND sale_type=%s"
        params.append(sale_type)
    sql += " ORDER BY id DESC"
    return jsonify(query(sql, tuple(params), many=True))


@pharmacy_sales_bp.route("/<int:sale_id>", methods=["GET"])
@jwt_required()
def get_sale(sale_id):
    sale = query("SELECT * FROM pharmacy_sales WHERE id=%s", (sale_id,))
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    sale["items"] = query("SELECT * FROM pharmacy_sale_items WHERE sale_id=%s", (sale_id,), many=True)
    return jsonify(sale)


# ============================================================
# Fetch IP Patients for the Search Modal (Sales Returns)
# ============================================================
@pharmacy_sales_bp.route("/search-patients", methods=["GET"])
@jwt_required()
def search_patients_for_returns():
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

    base_from = """
        FROM ip_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE r.status = 'Admitted'
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
        "data": patients,
        "total": total,
        "page": page,
        "limit": limit,
    })


# ============================================================
# Fetch OP Patients ONLY for the Search Modal (Sales Returns) - STRICT FILTER
# ============================================================
@pharmacy_sales_bp.route("/search-op-patients", methods=["GET"])
@jwt_required()
def search_op_patients_for_returns():
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

    # ✅ STRICT FILTER: opd_reg_no MUST start with 'OP' to ignore any corrupted IP data
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
        where_extra = """
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

    count_sql = "SELECT COUNT(*) AS total " + base_from + where_extra
    total_result = query(count_sql, tuple(params))
    total = total_result["total"] if total_result else 0

    sql = f"""
        SELECT
            r.id,
            p.patient_uid AS mr_number,
            r.opd_reg_no AS op_reg_no,
            {name_expr} AS name,
            r.mobile,
            r.gender,
            TIMESTAMPDIFF(YEAR, r.dob, CURDATE()) AS age,
            doc.name AS doctor_name
        {base_from}
        {where_extra}
        ORDER BY r.id DESC
        LIMIT %s OFFSET %s
    """
    data_params = list(params) + [limit, offset]
    
    try:
        patients = query(sql, tuple(data_params), many=True)
    except Exception as e:
        print(f"SQL Error in OP search: {e}")
        return jsonify({"error": "Database query failed. Check backend logs."}), 500

    return jsonify({
        "data": patients,
        "total": total,
        "page": page,
        "limit": limit,
    })