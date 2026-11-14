from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query
from decimal import Decimal

ip_lab_bp = Blueprint("ip_lab", __name__)

def serialize_row(row):
    if not row: return row
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal): out[k] = float(v)
        elif hasattr(v, "isoformat"): out[k] = v.isoformat()
        else: out[k] = v
    return out
@ip_lab_bp.route("", methods=["GET"])
@jwt_required()
def list_ip_lab():
    """
    List IP lab records.

    Query params:
      - search              : free text (item name, patient name, ip_reg_no, phone)
      - start_date          : YYYY-MM-DD  (inclusive)
      - end_date            : YYYY-MM-DD  (inclusive)
      - patient_id          : filter by patient
      - ip_registration_id  : filter by admission
      - grouped             : "1" => one row per admission (default),
                              "0" => one row per item

    Grouped mode returns: id, ip_registration_id, ip_reg_no, patient_name, phone,
      total_amount, discount_amount, paid_amount, balance_amount, paymode,
      created_at, items_count
    """
    search = request.args.get("search", "").strip()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    patient_id = request.args.get("patient_id")
    ip_registration_id = request.args.get("ip_registration_id")
    grouped = request.args.get("grouped", "1") != "0"

    # ---- Build common WHERE ----
    where = "WHERE 1=1"
    params = []

    if patient_id:
        where += " AND r.patient_id = %s"
        params.append(patient_id)
    if ip_registration_id:
        where += " AND l.ip_registration_id = %s"
        params.append(ip_registration_id)
    if search:
        where += (" AND (l.item_name LIKE %s OR p.name LIKE %s "
                  "OR r.ip_reg_no LIKE %s OR p.phone LIKE %s)")
        like = f"%{search}%"
        params.extend([like, like, like, like])
    if start_date:
        where += " AND DATE(l.created_at) >= %s"
        params.append(start_date)
    if end_date:
        where += " AND DATE(l.created_at) <= %s"
        params.append(end_date)

    if grouped:
        # One row per admission, with payment summary joined in.
        sql = f"""
            SELECT
                MIN(l.id)                AS id,
                l.ip_registration_id     AS ip_registration_id,
                r.ip_reg_no              AS ip_reg_no,
                p.name                   AS patient_name,
                p.phone                  AS phone,
                COALESCE(SUM(l.amount), 0) AS total_amount,
                COALESCE(pay.discount_amount, 0) AS discount_amount,
                COALESCE(pay.paid_amount, 0)     AS paid_amount,
                COALESCE(pay.balance_amount,
                         SUM(l.amount) - COALESCE(pay.discount_amount, 0)
                                       - COALESCE(pay.paid_amount, 0)) AS balance_amount,
                pay.paymode              AS paymode,
                MAX(l.created_at)        AS created_at,
                COUNT(l.id)              AS items_count
            FROM ip_lab l
            JOIN ip_registrations r ON r.id = l.ip_registration_id
            JOIN patients p ON p.id = r.patient_id
            LEFT JOIN ip_lab_payments pay
                   ON pay.ip_registration_id = l.ip_registration_id
            {where}
            GROUP BY l.ip_registration_id, r.ip_reg_no, p.name, p.phone,
                     pay.discount_amount, pay.paid_amount, pay.balance_amount,
                     pay.paymode
            ORDER BY MAX(l.created_at) DESC
        """
    else:
        # Per-item detail rows (existing behavior).
        sql = f"""
            SELECT l.id, l.ip_registration_id, l.item_name, l.quantity, l.rate, l.amount,
                   l.created_at, p.name AS patient_name, r.ip_reg_no, p.phone
            FROM ip_lab l
            JOIN ip_registrations r ON r.id = l.ip_registration_id
            JOIN patients p ON p.id = r.patient_id
            {where}
            ORDER BY l.created_at DESC
        """

    rows = query(sql, tuple(params), many=True) or []
    return jsonify([serialize_row(r) for r in rows])
@ip_lab_bp.route("/by-admission/<int:adm_id>", methods=["GET"])
@jwt_required()
def get_lab_by_admission(adm_id):
    items = query("""
        SELECT id, item_name, quantity, rate, amount, created_at
        FROM ip_lab WHERE ip_registration_id = %s ORDER BY id ASC
    """, (adm_id,), many=True) or []

    payment = None
    try:
        payment = query("""
            SELECT total_amount, discount_percent, discount_amount,
                   paid_amount, balance_amount, discount_comments, paymode
            FROM ip_lab_payments WHERE ip_registration_id = %s LIMIT 1
        """, (adm_id,), many=False)
    except Exception:
        payment = None

    return jsonify({
        "items": [serialize_row(i) for i in items],
        "payment": serialize_row(payment) if payment else None,
    })

@ip_lab_bp.route("", methods=["POST"])
@jwt_required()
def create_ip_lab():
    data = request.get_json() or {}
    ip_registration_id = data.get("ip_registration_id")
    items = data.get("items")

    if not ip_registration_id or not items:
        return jsonify({"error": "ip_registration_id and items are required"}), 400

    admission = query("SELECT id FROM ip_registrations WHERE id=%s", (ip_registration_id,))
    if not admission:
        return jsonify({"error": "Invalid admission"}), 404

    total_amount = float(data.get("total_amount") or 0)
    discount_percent = float(data.get("discount_percent") or 0)
    discount_amount = float(data.get("discount_amount") or 0)
    paid_amount = float(data.get("paid_amount") or 0)
    balance_amount = float(data.get("balance_amount") or 0)
    discount_comments = data.get("discount_comments") or "NA"
    paymode = data.get("paymode") or None

    inserted = 0
    try:
        for item in items:
            item_name = (item.get("item_name") or "").strip()
            if not item_name: continue
            quantity = float(item.get("quantity") or 1)
            rate = float(item.get("rate") or 0)
            amount = float(item.get("amount") or (rate * quantity))

            # Check if this exact item already exists to avoid duplicates
            existing = query("SELECT id FROM ip_lab WHERE ip_registration_id=%s AND item_name=%s LIMIT 1", (ip_registration_id, item_name), many=False)
            
            if not existing:
                query("""
                    INSERT INTO ip_lab (ip_registration_id, item_name, quantity, rate, amount)
                    VALUES (%s, %s, %s, %s, %s)
                """, (ip_registration_id, item_name, quantity, rate, amount), fetch=False, commit=True)
                inserted += 1

        # Save payment details
        try:
            existing_pay = query("SELECT id FROM ip_lab_payments WHERE ip_registration_id=%s LIMIT 1", (ip_registration_id,), many=False)
            if existing_pay:
                query("""
                    UPDATE ip_lab_payments SET total_amount=total_amount+%s, discount_percent=%s, discount_amount=discount_amount+%s,
                        paid_amount=paid_amount+%s, balance_amount=balance_amount+%s, discount_comments=%s, paymode=%s
                    WHERE ip_registration_id=%s
                """, (total_amount, discount_percent, discount_amount, paid_amount, balance_amount, discount_comments, paymode, ip_registration_id), fetch=False, commit=True)
            else:
                query("""
                    INSERT INTO ip_lab_payments (ip_registration_id, total_amount, discount_percent, discount_amount, paid_amount, balance_amount, discount_comments, paymode)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (ip_registration_id, total_amount, discount_percent, discount_amount, paid_amount, balance_amount, discount_comments, paymode), fetch=False, commit=True)
        except Exception as e:
            print(f"[ip_lab] Warning: Could not save payment: {e}")

    except Exception as e:
        return jsonify({"error": f"Failed to save lab items: {str(e)}"}), 500

    return jsonify({"inserted": inserted, "message": "Data saved successfully"}), 201

@ip_lab_bp.route("/catalog", methods=["GET"])
@jwt_required()
def get_lab_catalog():
    search = request.args.get("search", "")
    department = request.args.get("department", "")
    sql = "SELECT id, department, investigation_name AS name, rate FROM lab_catalog WHERE is_active = 1"
    params = []
    if search:
        sql += " AND (investigation_name LIKE %s OR department LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])
    if department:
        sql += " AND department = %s"
        params.append(department)
    sql += " ORDER BY department, investigation_name"
    rows = query(sql, tuple(params), many=True) or []
    for r in rows: r["rate"] = float(r["rate"]) if r.get("rate") is not None else 0.0
    return jsonify(rows)

@ip_lab_bp.route("/catalog/departments", methods=["GET"])
@jwt_required()
def get_lab_departments():
    rows = query("SELECT DISTINCT department FROM lab_catalog WHERE is_active = 1 ORDER BY department", many=True)
    return jsonify([r["department"] for r in rows])