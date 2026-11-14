from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query
from decimal import Decimal

op_lab_bp = Blueprint("op_lab", __name__)

def get_pagination_params():
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(request.args.get("per_page", 25))
    except (TypeError, ValueError):
        per_page = 25
    per_page = min(max(per_page, 1), 100)
    offset = (page - 1) * per_page
    return page, per_page, offset

def serialize_row(row):
    if not row:
        return row
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            out[k] = float(v)
        elif hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

@op_lab_bp.route("", methods=["GET"])
@jwt_required()
def list_op_lab():
    search = request.args.get("search", "").strip()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    patient_id = request.args.get("patient_id")
    op_registration_id = request.args.get("op_registration_id")
    page, per_page, offset = get_pagination_params()

    base_from = """
        FROM op_lab l
        JOIN op_registrations r ON r.id = l.op_registration_id
        JOIN patients p ON p.id = r.patient_id
        WHERE 1=1
    """
    params = []

    if patient_id:
        base_from += " AND p.id = %s"
        params.append(patient_id)

    if op_registration_id:
        base_from += " AND l.op_registration_id = %s"
        params.append(op_registration_id)

    if search:
        base_from += """ AND (
            l.item_name LIKE %s OR p.name LIKE %s OR r.opd_reg_no LIKE %s
            OR p.phone LIKE %s OR p.patient_uid LIKE %s
        )"""
        like = f"%{search}%"
        params.extend([like, like, like, like, like])

    if start_date:
        base_from += " AND DATE(l.created_at) >= %s"
        params.append(start_date)
    if end_date:
        base_from += " AND DATE(l.created_at) <= %s"
        params.append(end_date)

    count_row = query(f"SELECT COUNT(*) AS total {base_from}", tuple(params), many=False)
    total = count_row["total"] if count_row else 0

    data_sql = f"""
        SELECT l.id, l.op_registration_id, l.item_name, l.quantity, l.rate, l.amount,
               l.created_at, p.name AS patient_name, p.phone AS patient_phone,
               p.patient_uid, r.opd_reg_no
        {base_from}
        ORDER BY l.created_at DESC
        LIMIT %s OFFSET %s
    """
    rows = query(data_sql, tuple(params + [per_page, offset]), many=True)

    return jsonify({
        "data": [serialize_row(r) for r in (rows or [])],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    })

@op_lab_bp.route("/by-registration/<int:reg_id>", methods=["GET"])
@jwt_required()
def get_lab_by_registration(reg_id):
    items = query("""
        SELECT id, item_name, quantity, rate, amount, created_at
        FROM op_lab
        WHERE op_registration_id = %s
        ORDER BY id ASC
    """, (reg_id,), many=True) or []

    payment = None
    try:
        payment = query("""
            SELECT total_amount, discount_percent, discount_amount,
                   paid_amount, balance_amount, discount_comments, paymode
            FROM op_lab_payments
            WHERE op_registration_id = %s
            LIMIT 1
        """, (reg_id,), many=False)
    except Exception:
        payment = None

    return jsonify({
        "items": [serialize_row(i) for i in items],
        "payment": serialize_row(payment) if payment else None,
    })

@op_lab_bp.route("", methods=["POST"])
@jwt_required()
def create_op_lab():
    data = request.get_json() or {}

    op_registration_id = data.get("op_registration_id")
    items = data.get("items")

    if not op_registration_id or not items:
        return jsonify({"error": "op_registration_id and items are required"}), 400

    registration = query(
        "SELECT id FROM op_registrations WHERE id=%s",
        (op_registration_id,), many=False
    )
    if not registration:
        return jsonify({"error": "Invalid OP registration"}), 404

    total_amount      = float(data.get("total_amount") or 0)
    discount_percent  = float(data.get("discount_percent") or 0)
    discount_amount   = float(data.get("discount_amount") or 0)
    paid_amount       = float(data.get("paid_amount") or 0)
    balance_amount    = float(data.get("balance_amount") or 0)
    discount_comments = data.get("discount_comments") or "NA"
    paymode           = data.get("paymode") or None

    inserted = 0
    try:
        for item in items:
            item_name = (item.get("item_name") or "").strip()
            if not item_name:
                continue
            quantity = float(item.get("quantity") or 1)
            rate     = float(item.get("rate") or 0)
            amount   = float(item.get("amount") or (rate * quantity))

            query("""
                INSERT INTO op_lab (op_registration_id, item_name, quantity, rate, amount)
                VALUES (%s, %s, %s, %s, %s)
            """, (op_registration_id, item_name, quantity, rate, amount),
                fetch=False, commit=True)
            inserted += 1

        try:
            existing = query(
                "SELECT id FROM op_lab_payments WHERE op_registration_id=%s LIMIT 1",
                (op_registration_id,), many=False
            )

            if existing:
                query("""
                    UPDATE op_lab_payments
                    SET total_amount=%s, discount_percent=%s, discount_amount=%s,
                        paid_amount=%s, balance_amount=%s,
                        discount_comments=%s, paymode=%s
                    WHERE op_registration_id=%s
                """, (
                    total_amount, discount_percent, discount_amount,
                    paid_amount, balance_amount, discount_comments,
                    paymode, op_registration_id
                ), fetch=False, commit=True)
            else:
                query("""
                    INSERT INTO op_lab_payments
                        (op_registration_id, total_amount, discount_percent,
                         discount_amount, paid_amount, balance_amount,
                         discount_comments, paymode)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    op_registration_id, total_amount, discount_percent,
                    discount_amount, paid_amount, balance_amount,
                    discount_comments, paymode
                ), fetch=False, commit=True)
        except Exception as pay_err:
            print(f"[op_lab] Warning: Could not save payment details: {pay_err}")

    except Exception as e:
        return jsonify({"error": f"Failed to save lab items: {str(e)}"}), 500

    return jsonify({
        "inserted": inserted,
        "op_registration_id": op_registration_id,
    }), 201

@op_lab_bp.route("/catalog", methods=["GET"])
@jwt_required()
def get_lab_catalog():
    search = request.args.get("search", "")
    department = request.args.get("department", "")
    sql = """
        SELECT id, department, investigation_name AS name, rate
        FROM lab_catalog
        WHERE is_active = 1
    """
    params = []
    if search:
        sql += " AND (investigation_name LIKE %s OR department LIKE %s)"
        like = f"%{search}%"
        params.extend([like, like])
    if department:
        sql += " AND department = %s"
        params.append(department)
    sql += " ORDER BY department, investigation_name"

    rows = query(sql, tuple(params), many=True) or []
    for r in rows:
        r["rate"] = float(r["rate"]) if r.get("rate") is not None else 0.0
    return jsonify(rows)

@op_lab_bp.route("/catalog/departments", methods=["GET"])
@jwt_required()
def get_lab_departments():
    rows = query(
        "SELECT DISTINCT department FROM lab_catalog WHERE is_active = 1 ORDER BY department",
        many=True
    )
    return jsonify([r["department"] for r in rows])