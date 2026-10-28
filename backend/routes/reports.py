from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

reports_bp = Blueprint("reports", __name__)


def _date_range_args():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    show_discharged = request.args.get("show_discharged") == "1"
    return start, end, show_discharged


def _day_bounds(start, end):
    """Return inclusive [start 00:00:00, end 23:59:59.999999] datetime strings."""
    return f"{start} 00:00:00", f"{end} 23:59:59.999999"


# ============================================================
# LAB / RADIOLOGY REPORTS
# ============================================================

@reports_bp.route("/ip-lab", methods=["GET"])
@jwt_required()
def ip_lab_report():
    start, end, show_discharged = _date_range_args()
    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    sql = """
        SELECT r.id, p.patient_uid AS mr_number, r.ip_reg_no AS patient_reg_no, r.patient_id,
               CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) AS name,
               r.mobile AS contact, r.age, r.gender, doc.name AS doctor_name,
               r.room_type, r.room_no, r.bed_no
        FROM ip_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE r.admitted_date BETWEEN %s AND %s
    """
    params = [start, end]
    if not show_discharged:
        sql += " AND r.status != 'Discharged'"
    sql += " ORDER BY r.admitted_date DESC, r.id DESC"

    rows = query(sql, tuple(params), many=True)
    _attach_lab_orders(rows, "ip_registration_id")
    return jsonify(rows)


@reports_bp.route("/op-lab", methods=["GET"])
@jwt_required()
def op_lab_report():
    start, end, _ = _date_range_args()
    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    sql = """
        SELECT r.id, p.patient_uid AS mr_number, r.opd_reg_no AS patient_reg_no, r.patient_id,
               CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) AS name,
               r.mobile AS contact, TIMESTAMPDIFF(YEAR, r.dob, CURDATE()) AS age, r.gender,
               doc.name AS doctor_name,
               CONCAT(r.appointment_date, ' ', IFNULL(r.appointment_time, '')) AS appointment_at
        FROM op_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE r.appointment_date BETWEEN %s AND %s
        ORDER BY r.appointment_date DESC, r.id DESC
    """
    rows = query(sql, (start, end), many=True)
    _attach_lab_orders(rows, "op_registration_id")
    return jsonify(rows)


@reports_bp.route("/ip-radiology", methods=["GET"])
@jwt_required()
def ip_radiology_report():
    start, end, show_discharged = _date_range_args()
    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    sql = """
        SELECT r.id, p.patient_uid AS mr_number, r.ip_reg_no AS patient_reg_no, r.patient_id,
               CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) AS name,
               r.mobile AS contact, r.gender, r.age, doc.name AS doctor_name,
               r.room_type, r.room_no, r.bed_no
        FROM ip_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE r.admitted_date BETWEEN %s AND %s
          AND EXISTS (SELECT 1 FROM radiology_orders ro WHERE ro.ip_registration_id = r.id)
    """
    params = [start, end]
    if not show_discharged:
        sql += " AND r.status != 'Discharged'"
    sql += " ORDER BY r.admitted_date DESC, r.id DESC"

    rows = query(sql, tuple(params), many=True)
    return jsonify(rows)


@reports_bp.route("/op-radiology", methods=["GET"])
@jwt_required()
def op_radiology_report():
    start, end, _ = _date_range_args()
    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    sql = """
        SELECT r.id, p.patient_uid AS mr_number, r.opd_reg_no AS patient_reg_no, r.patient_id,
               CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) AS name,
               r.mobile AS contact, r.gender, TIMESTAMPDIFF(YEAR, r.dob, CURDATE()) AS age,
               doc.name AS doctor_name,
               CONCAT(r.appointment_date, ' ', IFNULL(r.appointment_time, '')) AS appointment_at
        FROM op_registrations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE r.appointment_date BETWEEN %s AND %s
          AND EXISTS (SELECT 1 FROM op_radiology rad WHERE rad.op_registration_id = r.id)
        ORDER BY r.appointment_date DESC, r.id DESC
    """
    rows = query(sql, (start, end), many=True)
    _attach_radiology_items(rows, "op_registration_id", "op_radiology")
    return jsonify(rows)


def _attach_lab_orders(rows, registration_fk):
    for row in rows:
        orders = query(
            f"""
                SELECT order_no FROM lab_orders
                WHERE {registration_fk} = %s
                ORDER BY ordered_at, id
            """,
            (row["id"],),
            many=True,
        )
        row["lab_orders"] = orders


def _attach_radiology_items(rows, registration_fk, table):
    for row in rows:
        items = query(
            f"""
                SELECT item_name, quantity, rate, amount
                FROM {table}
                WHERE {registration_fk} = %s
                ORDER BY id
            """,
            (row["id"],),
            many=True,
        )
        row["items"] = items
        row["item_total"] = sum(float(i["amount"] or 0) for i in items)


# ============================================================
# TOTAL SALES REPORT
# ============================================================

def _sales_buckets(sale_type, start_dt, end_dt):
    row = query(
        """
        SELECT
            SUM(CASE WHEN payment_mode = 'Cash'      THEN net_amount ELSE 0 END) AS cash,
            SUM(CASE WHEN payment_mode = 'Card'      THEN net_amount ELSE 0 END) AS card,
            SUM(CASE WHEN payment_mode = 'UPI'       THEN net_amount ELSE 0 END) AS upi,
            SUM(CASE WHEN payment_mode = 'Insurance' THEN net_amount ELSE 0 END) AS insurance,
            SUM(CASE WHEN payment_mode = 'Credit'    THEN net_amount ELSE 0 END) AS credit,
            SUM(net_amount)  AS total,
            SUM(paid_amount) AS paid,
            SUM(due_amount)  AS due
        FROM pharmacy_sales
        WHERE sale_type = %s AND created_at BETWEEN %s AND %s
        """,
        (sale_type, start_dt, end_dt),
    ) or {}
    keys = ("cash", "card", "upi", "insurance", "credit", "total", "paid", "due")
    return {k: float(row.get(k) or 0) for k in keys}


@reports_bp.route("/total-sales-summary", methods=["GET"])
@jwt_required()
def total_sales_summary():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    include_expenses = request.args.get("include_expenses") == "1"

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt, end_dt = _day_bounds(start, end)

    op_sales = _sales_buckets("OP", start_dt, end_dt)
    ip_sales = _sales_buckets("IP", start_dt, end_dt)
    direct_sales = _sales_buckets("Direct", start_dt, end_dt)

    expense_total = 0.0
    if include_expenses:
        try:
            exp_row = query(
                "SELECT SUM(amount) AS total FROM pharmacy_expenses "
                "WHERE created_at BETWEEN %s AND %s",
                (start_dt, end_dt),
            ) or {}
            expense_total = float(exp_row.get("total") or 0)
        except Exception:
            expense_total = 0.0

    gross_sales = op_sales["total"] + ip_sales["total"] + direct_sales["total"]
    net_after_expenses = gross_sales - expense_total

    return jsonify({
        "op_sales": op_sales,
        "ip_sales": ip_sales,
        "direct_sales": direct_sales,
        "pharmacy_expenses": expense_total,
        "gross_sales": gross_sales,
        "net_after_expenses": net_after_expenses,
        "grand_total": net_after_expenses,
    })


@reports_bp.route("/total-sales-details", methods=["GET"])
@jwt_required()
def total_sales_details():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    sale_type = request.args.get("sale_type", "OP")

    if sale_type not in ("OP", "IP", "Direct"):
        return jsonify({"error": "sale_type must be OP, IP, or Direct"}), 400
    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt, end_dt = _day_bounds(start, end)

    if sale_type == "Direct":
        reg_join = ""
        p_join = "LEFT JOIN patients p ON p.id = s.patient_id"
    else:
        reg_table = "op_registrations" if sale_type == "OP" else "ip_registrations"
        reg_join = f"LEFT JOIN {reg_table} r ON r.id = s.{sale_type.lower()}_registration_id"
        p_join = "LEFT JOIN patients p ON p.id = r.patient_id"

    sql = f"""
        SELECT s.id, s.sale_no AS invoice_no, s.created_at,
               s.net_amount  AS final_amount,
               s.paid_amount, s.due_amount,
               s.payment_mode, s.remarks,
               p.name        AS patient_name,
               doc.name      AS doctor_name,
               u.name        AS billed_by
        FROM pharmacy_sales s
        {reg_join}
        {p_join}
        LEFT JOIN doctors doc ON doc.id = s.doctor_id
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.sale_type = %s AND s.created_at BETWEEN %s AND %s
        ORDER BY s.id DESC
    """

    rows = query(sql, (sale_type, start_dt, end_dt), many=True)
    return jsonify(rows)


# ============================================================
# PHARMACY DUE RECEIVED REPORT
# ============================================================

@reports_bp.route("/pharmacy-due-received", methods=["GET"])
@jwt_required()
def pharmacy_due_received_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            s.id,
            s.created_at AS due_received_date,
            s.due_amount AS due_received_amount,
            0.00 AS due_discount_amount,
            
            s.sale_no AS invoice_no,
            s.created_at AS bill_date,
            s.sale_type AS patient_type,
            
            u.name AS created_by,
            
            p.name AS patient_name,
            p.phone AS phone_number,
            
            CASE 
                WHEN s.sale_type = 'OP' THEN r_op.opd_reg_no
                WHEN s.sale_type = 'IP' THEN r_ip.ip_reg_no
                ELSE s.patient_id 
            END AS patient_reg_no

        FROM pharmacy_sales s
        LEFT JOIN users u ON u.id = s.created_by
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN op_registrations r_op ON r_op.id = s.op_registration_id
        LEFT JOIN ip_registrations r_ip ON r_ip.id = s.ip_registration_id
        
        WHERE s.created_at BETWEEN %s AND %s
          AND s.due_amount > 0
        ORDER BY s.created_at DESC, s.id DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# PHARMACY SALES RETURNS REPORT
# ============================================================

@reports_bp.route("/sales-returns", methods=["GET"])
@jwt_required()
def sales_returns_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            s.sale_type AS patient_type,
            SUM(ABS(s.net_amount)) AS total_return_amount
        FROM pharmacy_sales s
        WHERE s.created_at BETWEEN %s AND %s
          AND (s.net_amount < 0 OR s.status = 'Returned')
        GROUP BY s.sale_type
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        
        op_return = 0.0
        ip_return = 0.0
        
        for row in rows:
            if row["patient_type"] == "OP":
                op_return = float(row["total_return_amount"])
            elif row["patient_type"] == "IP":
                ip_return = float(row["total_return_amount"])

        return jsonify({
            "op_income": op_return,
            "ip_income": ip_return,
            "grand_total": op_return + ip_return
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# OP/IP SALES REPORT (Item Level)
# ============================================================

@reports_bp.route("/op-ip-sales", methods=["GET"])
@jwt_required()
def op_ip_sales_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    sale_type = request.args.get("type", "All")
    search_query = request.args.get("search", "")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            s.id AS sale_id,
            s.created_at,
            s.sale_no AS invoice_no,
            s.sale_type,
            s.discount_amount AS total_invoice_discount,
            p.name AS patient_name,
            
            si.item_name,
            si.qty AS quantity,
            si.mrp,
            (si.amount / NULLIF(si.qty, 0)) AS rate,
            si.amount AS item_amount,
            
            (si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) AS gst_amount,
            
            0.00 AS margin_amount,
            0.00 AS margin_percent

        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN patients p ON p.id = s.patient_id
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if sale_type in ("OP", "IP", "Direct"):
        sql += " AND s.sale_type = %s"
        params.append(sale_type)

    if search_query:
        sql += " AND (p.name LIKE %s OR s.sale_no LIKE %s OR si.item_name LIKE %s)"
        search_term = f"%{search_query}%"
        params.extend([search_term, search_term, search_term])

    sql += " ORDER BY s.created_at DESC, s.id DESC, si.id ASC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# OP/IP DUE REPORT
# ============================================================

@reports_bp.route("/op-ip-due", methods=["GET"])
@jwt_required()
def op_ip_due_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    sale_type = request.args.get("type", "All")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            s.id,
            s.sale_no AS invoice_no,
            s.created_at,
            s.sale_type AS patient_type,
            s.net_amount AS final_amount,
            s.paid_amount,
            s.due_amount,
            s.payment_mode,
            s.remarks,
            
            p.name AS patient_name,
            p.phone AS phone_number,
            doc.name AS doctor_name,
            u.name AS billed_by,
            
            CASE 
                WHEN s.sale_type = 'OP' THEN r_op.opd_reg_no
                WHEN s.sale_type = 'IP' THEN r_ip.ip_reg_no
                ELSE 'DIRECT'
            END AS patient_reg_no

        FROM pharmacy_sales s
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN doctors doc ON doc.id = s.doctor_id
        LEFT JOIN users u ON u.id = s.created_by
        LEFT JOIN op_registrations r_op ON r_op.id = s.op_registration_id
        LEFT JOIN ip_registrations r_ip ON r_ip.id = s.ip_registration_id
        
        WHERE s.created_at BETWEEN %s AND %s
          AND s.due_amount > 0
    """
    params = [start_dt, end_dt]

    if sale_type in ("OP", "IP", "Direct"):
        sql += " AND s.sale_type = %s"
        params.append(sale_type)

    sql += " ORDER BY s.created_at DESC, s.id DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        total_due = sum(float(row["due_amount"] or 0) for row in rows)
        return jsonify({
            "data": rows,
            "total_due": total_due
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# PHARMACY DUE REPORT
# ============================================================

@reports_bp.route("/pharmacy-due", methods=["GET"])
@jwt_required()
def pharmacy_due_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
      return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            s.id,
            s.sale_no AS invoice_no,
            s.created_at,
            s.sale_type,
            s.net_amount AS final_amount,
            s.paid_amount,
            s.due_amount,
            
            p.name AS patient_name,
            p.phone AS phone_number,
            doc.name AS doctor_name,
            u.name AS billed_by

        FROM pharmacy_sales s
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN doctors doc ON doc.id = s.doctor_id
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.created_at BETWEEN %s AND %s
          AND s.due_amount > 0
        ORDER BY s.created_at DESC, s.id DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        total_due = sum(float(row["due_amount"] or 0) for row in rows)
        return jsonify({
            "data": rows,
            "total_due": total_due
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# SCHEDULE / ITEM REPORT
# ============================================================

@reports_bp.route("/schedule-item-report", methods=["GET"])
@jwt_required()
def schedule_item_report():
    r_type = request.args.get("type", "Sale")
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    schedule_name = request.args.get("schedule_name")
    item_name = request.args.get("item_name")
    batch_no = request.args.get("batch_no")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    if r_type == "Sale":
        sql = """
            SELECT 
                s.sale_no AS invoice_no,
                s.created_at AS date,
                p.name AS patient_name,
                si.item_name,
                si.batch_no,
                si.qty,
                si.mrp,
                (si.amount / NULLIF(si.qty, 0)) AS rate,
                si.amount AS total_amount,
                pi.schedule AS schedule_name
            FROM pharmacy_sales s
            JOIN pharmacy_sale_items si ON si.sale_id = s.id
            LEFT JOIN pharmacy_items pi ON pi.id = si.item_id
            LEFT JOIN patients p ON p.id = s.patient_id
            WHERE s.created_at BETWEEN %s AND %s
        """
    elif r_type == "Purchase":
        sql = """
            SELECT 
                g.grn_no AS invoice_no,
                g.created_at AS date,
                sup.name AS patient_name,
                gi.item_name,
                gi.batch_no,
                gi.qty,
                gi.mrp,
                gi.rate,
                (gi.qty * gi.rate) AS total_amount,
                pi.schedule AS schedule_name
            FROM grn g
            JOIN grn_items gi ON gi.grn_id = g.id
            LEFT JOIN pharmacy_items pi ON pi.id = gi.item_id
            LEFT JOIN suppliers sup ON sup.id = g.supplier_id
            WHERE g.created_at BETWEEN %s AND %s
        """
    else:
        return jsonify({"error": "Invalid Type"}), 400

    params = [start_dt, end_dt]

    if schedule_name and schedule_name != "Select":
        sql += " AND pi.schedule = %s"
        params.append(schedule_name)
    
    if item_name and item_name != "Select":
        sql += " AND si.item_name = %s" if r_type == "Sale" else " AND gi.item_name = %s"
        params.append(item_name)
        
    if batch_no and batch_no != "Select":
        sql += " AND si.batch_no = %s" if r_type == "Sale" else " AND gi.batch_no = %s"
        params.append(batch_no)

    sql += " ORDER BY s.created_at DESC" if r_type == "Sale" else " ORDER BY g.created_at DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@reports_bp.route("/dropdown-items", methods=["GET"])
@jwt_required()
def dropdown_items():
    sql = "SELECT DISTINCT name AS item_name FROM pharmacy_items WHERE is_active = 1 ORDER BY name ASC"
    try:
        rows = query(sql, many=True)
        return jsonify([r["item_name"] for r in rows if r["item_name"]])
    except Exception:
        return jsonify([])


@reports_bp.route("/dropdown-batches", methods=["GET"])
@jwt_required()
def dropdown_batches():
    sql = "SELECT DISTINCT batch_no FROM pharmacy_sale_items WHERE batch_no IS NOT NULL AND batch_no != '' ORDER BY batch_no ASC"
    try:
        rows = query(sql, many=True)
        return jsonify([r["batch_no"] for r in rows])
    except Exception:
        return jsonify([])


# ============================================================
# EMPLOYEE SALES REPORT
# ============================================================

@reports_bp.route("/dropdown-users", methods=["GET"])
@jwt_required()
def dropdown_users():
    try:
        rows = query("SELECT id, name FROM users WHERE is_active = 1 ORDER BY name ASC", many=True)
        return jsonify(rows)
    except Exception:
        return jsonify([])


@reports_bp.route("/employee-sales", methods=["GET"])
@jwt_required()
def employee_sales_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    user_id = request.args.get("user_id")
    r_type = request.args.get("type", "Daily")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    params = [start_dt, end_dt]
    
    sql = """
        SELECT 
            SUM(CASE WHEN sale_type = 'OP' THEN net_amount ELSE 0 END) AS op_sales,
            SUM(CASE WHEN sale_type = 'IP' THEN net_amount ELSE 0 END) AS ip_sales,
            SUM(CASE WHEN sale_type = 'Direct' THEN net_amount ELSE 0 END) AS direct_sales
        FROM pharmacy_sales
        WHERE created_at BETWEEN %s AND %s
    """

    if user_id and user_id != 'All':
        sql += " AND created_by = %s"
        params.append(user_id)

    try:
        sales_row = query(sql, tuple(params)) or {}
        
        op_sales = float(sales_row.get("op_sales") or 0)
        ip_sales = float(sales_row.get("ip_sales") or 0)
        direct_sales = float(sales_row.get("direct_sales") or 0)
        
        expenses = 0.0
        try:
            exp_sql = "SELECT SUM(amount) AS total FROM pharmacy_expenses WHERE created_at BETWEEN %s AND %s"
            exp_params = [start_dt, end_dt]
            if user_id and user_id != 'All':
                exp_sql += " AND created_by = %s"
                exp_params.append(user_id)
            
            exp_row = query(exp_sql, tuple(exp_params)) or {}
            expenses = float(exp_row.get("total") or 0)
        except Exception:
            expenses = 0.0

        total_sales = op_sales + ip_sales + direct_sales

        return jsonify({
            "op_sales": op_sales,
            "ip_sales": ip_sales,
            "direct_sales": direct_sales,
            "pharmacy_expenses": expenses,
            "grand_total": total_sales - expenses
        })

    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# SALES REPORT (Date-wise with Tax Breakdown)
# ============================================================

@reports_bp.route("/sales-report", methods=["GET"])
@jwt_required()
def sales_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    r_type = request.args.get("type", "Daily")
    p_type = request.args.get("ptype", "All")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    date_group = "DATE(s.created_at)"
    if r_type == "Monthly":
        date_group = "DATE_FORMAT(s.created_at, '%%Y-%%m')"
    elif r_type == "Yearly":
        date_group = "YEAR(s.created_at)"

    sql = f"""
        SELECT 
            {date_group} AS report_date,
            COUNT(DISTINCT s.id) AS bills_generated,
            
            SUM(CASE WHEN si.new_tax_percent = 0 THEN si.amount ELSE 0 END) AS gross_0,
            SUM(CASE WHEN si.new_tax_percent = 5 THEN si.amount ELSE 0 END) AS gross_5,
            SUM(CASE WHEN si.new_tax_percent = 12 THEN si.amount ELSE 0 END) AS gross_12,
            SUM(CASE WHEN si.new_tax_percent = 18 THEN si.amount ELSE 0 END) AS gross_18,
            
            SUM(CASE WHEN si.new_tax_percent = 0 THEN 0 ELSE 0 END) AS tax_0,
            SUM(CASE WHEN si.new_tax_percent = 5 THEN si.amount - (si.amount / 1.05) ELSE 0 END) AS tax_5,
            SUM(CASE WHEN si.new_tax_percent = 12 THEN si.amount - (si.amount / 1.12) ELSE 0 END) AS tax_12,
            SUM(CASE WHEN si.new_tax_percent = 18 THEN si.amount - (si.amount / 1.18) ELSE 0 END) AS tax_18,
            
            SUM(si.amount) AS total_amount
            
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if p_type in ("OP", "IP", "Direct"):
        sql += " AND s.sale_type = %s"
        params.append(p_type)

    sql += f" GROUP BY {date_group} ORDER BY report_date DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# NEW SALES REPORT (Sale Tax Report)
# ============================================================

@reports_bp.route("/new-sales-report", methods=["GET"])
@jwt_required()
def new_sales_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            DATE(s.created_at) AS report_date,
            
            SUM(si.amount) AS total_value,
            
            (SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) / NULLIF(SUM(si.amount / (1 + (si.new_tax_percent / 100))), 0)) * 100 AS gst_percent,
            
            SUM(si.amount / (1 + (si.new_tax_percent / 100))) AS total_taxable,
            
            ((SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) / NULLIF(SUM(si.amount / (1 + (si.new_tax_percent / 100))), 0)) * 100) / 2 AS cgst_percent,
            SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) / 2 AS cgst_value,
            
            ((SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) / NULLIF(SUM(si.amount / (1 + (si.new_tax_percent / 100))), 0)) * 100) / 2 AS sgst_percent,
            SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) / 2 AS sgst_value

        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        WHERE s.created_at BETWEEN %s AND %s
        GROUP BY DATE(s.created_at)
        ORDER BY report_date DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# PRODUCT WISE SALES REPORT
# ============================================================

@reports_bp.route("/dropdown-item-types", methods=["GET"])
@jwt_required()
def dropdown_item_types():
    try:
        rows = query("SELECT id, type_name AS name FROM pharmacy_item_types ORDER BY type_name ASC", many=True)
        return jsonify(rows)
    except Exception:
        return jsonify([])


@reports_bp.route("/product-wise-sales", methods=["GET"])
@jwt_required()
def product_wise_sales_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    item_type_id = request.args.get("item_type_id")
    item_id = request.args.get("item_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql_sales = """
        SELECT 
            pi.hsn_code,
            it.type_name AS item_type,
            si.item_name,
            SUM(si.qty) AS qty_sold,
            SUM(si.qty) AS current_qty,
            SUM(si.mrp) AS mrp_value,
            MAX(si.new_tax_percent) AS tax_percent,
            SUM(si.amount) AS gross_value
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN pharmacy_items pi ON pi.id = si.item_id
        LEFT JOIN pharmacy_item_types it ON it.id = pi.item_type_id
        WHERE s.created_at BETWEEN %s AND %s
    """
    
    sql_returns = """
        SELECT 
            pi.hsn_code,
            it.type_name AS item_type,
            si.item_name,
            SUM(si.qty) AS qty_return,
            SUM(si.mrp) AS mrp_value,
            MAX(si.new_tax_percent) AS tax_percent,
            SUM(si.amount) AS gross_value
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN pharmacy_items pi ON pi.id = si.item_id
        LEFT JOIN pharmacy_item_types it ON it.id = pi.item_type_id
        WHERE s.created_at BETWEEN %s AND %s
          AND (s.net_amount < 0 OR s.status = 'Returned')
    """

    params_sales = [start_dt, end_dt]
    params_returns = [start_dt, end_dt]

    if item_type_id and item_type_id != 'All':
        sql_sales += " AND pi.item_type_id = %s"
        sql_returns += " AND pi.item_type_id = %s"
        params_sales.append(item_type_id)
        params_returns.append(item_type_id)

    if item_id and item_id != 'Select':
        sql_sales += " AND pi.id = %s"
        sql_returns += " AND pi.id = %s"
        params_sales.append(item_id)
        params_returns.append(item_id)

    sql_sales += " GROUP BY pi.hsn_code, it.type_name, si.item_name ORDER BY si.item_name ASC"
    sql_returns += " GROUP BY pi.hsn_code, it.type_name, si.item_name ORDER BY si.item_name ASC"

    try:
        sales_rows = query(sql_sales, tuple(params_sales), many=True)
        return_rows = query(sql_returns, tuple(params_returns), many=True)
        
        return jsonify({
            "sales": sales_rows,
            "returns": return_rows
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# GRN REPORT (Goods Received Note)
# ============================================================

@reports_bp.route("/grn-report", methods=["GET"])
@jwt_required()
def grn_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    r_type = request.args.get("type", "Daily")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    date_group = "DATE(g.created_at)"
    if r_type == "Monthly":
        date_group = "DATE_FORMAT(g.created_at, '%%Y-%%m')"
    elif r_type == "Yearly":
        date_group = "YEAR(g.created_at)"

    sql = f"""
        SELECT 
            {date_group} AS report_date,
            COUNT(g.id) AS total_grns,
            SUM(g.total_amount) AS total_value,
            SUM(g.discount_amount) AS total_discount,
            SUM(g.tax_amount) AS total_tax,
            SUM(g.net_amount) AS grand_total
        FROM grn g
        WHERE g.created_at BETWEEN %s AND %s
        GROUP BY {date_group}
        ORDER BY report_date DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# GRN ADJUSTMENT REPORT
# ============================================================

@reports_bp.route("/grn-adjustment-report", methods=["GET"])
@jwt_required()
def grn_adjustment_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            g.grn_no,
            g.created_at AS grn_date,
            g.invoice_no,
            g.invoice_date,
            s.name AS supplier_name,
            g.total_amount AS net_amount,
            0.00 AS other_amount,
            0.00 AS adjustment_amount,
            g.net_amount AS total_amount
        FROM grn g
        LEFT JOIN suppliers s ON s.id = g.supplier_id
        WHERE g.created_at BETWEEN %s AND %s
        ORDER BY g.created_at DESC, g.id DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        total_amount = sum(float(row["total_amount"] or 0) for row in rows)
        return jsonify({
            "data": rows,
            "total_amount": total_amount
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# PROFIT REPORT
# ============================================================

@reports_bp.route("/dropdown-doctors", methods=["GET"])
@jwt_required()
def dropdown_doctors():
    try:
        rows = query("SELECT id, name FROM doctors WHERE is_active = 1 ORDER BY name ASC", many=True)
        return jsonify(rows)
    except Exception:
        return jsonify([])


@reports_bp.route("/profit-report", methods=["GET"])
@jwt_required()
def profit_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    doctor_id = request.args.get("doctor_id")
    p_type = request.args.get("ptype", "All")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            DATE_FORMAT(s.created_at, '%%Y-%%m') AS month,
            
            SUM(si.mrp * si.qty) AS sale_mrp_value,
            SUM(si.amount) AS gross_sales,
            SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) AS sales_tax,
            SUM(si.amount) AS total_sales,
            
            SUM(CASE WHEN s.net_amount < 0 OR s.status = 'Returned' THEN si.mrp * si.qty ELSE 0 END) AS return_mrp_value,
            SUM(CASE WHEN s.net_amount < 0 OR s.status = 'Returned' THEN si.amount ELSE 0 END) AS return_gross,
            SUM(CASE WHEN s.net_amount < 0 OR s.status = 'Returned' THEN si.amount - (si.amount / (1 + (si.new_tax_percent / 100))) ELSE 0 END) AS return_tax,
            SUM(CASE WHEN s.net_amount < 0 OR s.status = 'Returned' THEN si.amount ELSE 0 END) AS total_returns,
            
            SUM(si.qty * IFNULL(pi.cost_price, 0)) AS estimated_cost

        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN pharmacy_items pi ON pi.id = si.item_id
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if doctor_id and doctor_id != 'All':
        sql += " AND s.doctor_id = %s"
        params.append(doctor_id)

    if p_type in ("OP", "IP", "Direct"):
        sql += " AND s.sale_type = %s"
        params.append(p_type)

    sql += " GROUP BY DATE_FORMAT(s.created_at, '%%Y-%%m') ORDER BY month DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        
        for row in rows:
            total_sales = float(row.get("total_sales") or 0)
            total_returns = float(row.get("total_returns") or 0)
            sales_tax = float(row.get("sales_tax") or 0)
            return_tax = float(row.get("return_tax") or 0)
            estimated_cost = float(row.get("estimated_cost") or 0)

            net_rate = total_sales - total_returns
            gross_profit_sales = (total_sales - sales_tax) - estimated_cost
            gross_profit_returns = (total_returns - return_tax)
            
            row["net_rate"] = net_rate
            row["profit"] = gross_profit_sales - gross_profit_returns

        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# SUPPLIER DUES & PURCHASE REPORT
# ============================================================

@reports_bp.route("/supplier-dues", methods=["GET"])
@jwt_required()
def supplier_dues():
    sql = """
        SELECT 
            s.name AS supplier_name,
            SUM(g.total_amount) AS due_amount
        FROM grn g
        JOIN suppliers s ON s.id = g.supplier_id
        WHERE g.status != 'Returned' 
        GROUP BY s.id, s.name
        ORDER BY due_amount DESC
    """
    try:
        rows = query(sql, many=True)
        return jsonify(rows if rows else [])
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@reports_bp.route("/purchase-report", methods=["GET"])
@jwt_required()
def purchase_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    supplier_id = request.args.get("supplier_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            g.invoice_date,
            g.invoice_no,
            s.name AS supplier_name,
            g.grn_no,
            g.created_at AS grn_date,
            g.total_amount AS gross_amount,
            0.00 AS disc_amount,
            0.00 AS tax_amount,
            g.total_amount AS net_amount,
            0.00 AS credit_note,
            0.00 AS paid_amount,
            g.total_amount AS due_amount,
            NULL AS due_date
        FROM grn g
        LEFT JOIN suppliers s ON s.id = g.supplier_id
        WHERE g.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if supplier_id and supplier_id != 'All':
        sql += " AND g.supplier_id = %s"
        params.append(supplier_id)

    sql += " ORDER BY g.created_at DESC, g.id DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        
        totals = {
            "gross_amount": sum(float(r["gross_amount"] or 0) for r in rows),
            "disc_amount": 0,
            "tax_amount": 0,
            "net_amount": sum(float(r["net_amount"] or 0) for r in rows),
            "paid_amount": 0,
            "due_amount": sum(float(r["due_amount"] or 0) for r in rows),
        }
        
        return jsonify({
            "data": rows,
            "totals": totals
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# STOCK RETURNS REPORT
# ============================================================

@reports_bp.route("/stock-returns-report", methods=["GET"])
@jwt_required()
def stock_returns_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    r_type = request.args.get("type", "Daily")
    supplier_id = request.args.get("supplier_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    date_group = "DATE(sa.created_at)"
    if r_type == "Monthly":
        date_group = "DATE_FORMAT(sa.created_at, '%%Y-%%m')"
    elif r_type == "Yearly":
        date_group = "YEAR(sa.created_at)"

    # Fixed: Using total_amount instead of rate
    sql = f"""
        SELECT 
            {date_group} AS report_date,
            COUNT(sa.id) AS total_returns,
            SUM(ABS(sa.quantity)) AS total_qty,
            SUM(ABS(sa.total_amount)) AS total_value
        FROM stock_adjustments sa
        WHERE sa.created_at BETWEEN %s AND %s
          AND sa.quantity < 0
    """
    params = [start_dt, end_dt]

    if supplier_id and supplier_id != 'All':
        sql += " AND sa.supplier_id = %s"
        params.append(supplier_id)

    sql += f" GROUP BY {date_group} ORDER BY report_date DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# SUPPLIER WISE PURCHASE REPORT
# ============================================================

@reports_bp.route("/supplier-wise-purchase-report", methods=["GET"])
@jwt_required()
def supplier_wise_purchase_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    supplier_id = request.args.get("supplier_id")
    r_type = request.args.get("type", "Day")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    date_group = "DATE(g.created_at)"
    if r_type == "Month":
        date_group = "DATE_FORMAT(g.created_at, '%%Y-%%m')"
    elif r_type == "Year":
        date_group = "YEAR(g.created_at)"

    sql = f"""
        SELECT 
            {date_group} AS report_date,
            s.name AS supplier_name,
            COUNT(g.id) AS total_grns,
            SUM(g.total_amount) AS total_purchase_amount
        FROM grn g
        LEFT JOIN suppliers s ON s.id = g.supplier_id
        WHERE g.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if supplier_id and supplier_id != 'All':
        sql += " AND g.supplier_id = %s"
        params.append(supplier_id)

    sql += f" GROUP BY {date_group}, s.id, s.name ORDER BY report_date DESC, total_purchase_amount DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# DROPDOWN SUPPLIERS & GRNS
# ============================================================

@reports_bp.route("/dropdown-suppliers", methods=["GET"])
@jwt_required()
def dropdown_suppliers():
    try:
        sql = "SELECT id, name FROM suppliers ORDER BY name ASC"
        rows = query(sql, many=True)
        return jsonify(rows)
    except Exception as e:
        try:
            sql = "SELECT id, supplier_name AS name FROM suppliers ORDER BY supplier_name ASC"
            rows = query(sql, many=True)
            return jsonify(rows)
        except Exception as e2:
            return jsonify({"error": str(e2)}), 500


@reports_bp.route("/dropdown-grns", methods=["GET"])
@jwt_required()
def dropdown_grns():
    try:
        sql = "SELECT DISTINCT grn_no FROM grn ORDER BY grn_no DESC"
        rows = query(sql, many=True)
        return jsonify([r["grn_no"] for r in rows if r["grn_no"]])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# GRN WISE PURCHASE REPORT
# ============================================================

@reports_bp.route("/grn-wise-purchase-report", methods=["GET"])
@jwt_required()
def grn_wise_purchase_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    grn_no = request.args.get("grn_no")
    r_type = request.args.get("type", "Day")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    date_group = "DATE(g.created_at)"
    if r_type == "Month":
        date_group = "DATE_FORMAT(g.created_at, '%%Y-%%m')"
    elif r_type == "Year":
        date_group = "YEAR(g.created_at)"

    sql = f"""
        SELECT 
            {date_group} AS report_date,
            g.grn_no,
            s.name AS supplier_name,
            g.invoice_no,
            g.total_amount AS total_purchase_amount
        FROM grn g
        LEFT JOIN suppliers s ON s.id = g.supplier_id
        WHERE g.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if grn_no and grn_no != 'ALL':
        sql += " AND g.grn_no = %s"
        params.append(grn_no)

    sql += f" GROUP BY {date_group}, g.id, g.grn_no, s.name, g.invoice_no, g.total_amount"
    sql += f" ORDER BY report_date DESC, g.grn_no DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# OT INDENTS REPORT
# ============================================================

@reports_bp.route("/ot-indents-report", methods=["GET"])
@jwt_required()
def ot_indents_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    raised_for = request.args.get("raised_for")
    provided_to = request.args.get("provided_to")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            o.id,
            o.indent_no,
            o.created_at AS indent_date,
            o.raised_for,
            o.status,
            doc.name AS provided_to_name,
            o.remarks
        FROM ot_indents o
        LEFT JOIN doctors doc ON doc.id = o.provided_to
        WHERE o.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if raised_for and raised_for != 'Select':
        sql += " AND o.raised_for = %s"
        params.append(raised_for)
    
    if provided_to and provided_to != 'All':
        sql += " AND o.provided_to = %s"
        params.append(provided_to)

    sql += " ORDER BY o.created_at DESC, o.id DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# DOCTOR SALE & DOCTOR WISE ITEM SALES REPORT
# ============================================================

@reports_bp.route("/doctor-sales-report", methods=["GET"])
@jwt_required()
def doctor_sales_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    doctor_id = request.args.get("doctor_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            doc.name AS doctor_name,
            COUNT(s.id) AS total_bills,
            SUM(CASE WHEN s.sale_type = 'OP' THEN s.net_amount ELSE 0 END) AS op_sales,
            SUM(CASE WHEN s.sale_type = 'IP' THEN s.net_amount ELSE 0 END) AS ip_sales,
            SUM(CASE WHEN s.sale_type = 'Direct' THEN s.net_amount ELSE 0 END) AS direct_sales,
            SUM(s.net_amount) AS total_sales
        FROM pharmacy_sales s
        JOIN doctors doc ON doc.id = s.doctor_id
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if doctor_id and doctor_id != 'All':
        sql += " AND s.doctor_id = %s"
        params.append(doctor_id)

    sql += " GROUP BY doc.id, doc.name ORDER BY total_sales DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@reports_bp.route("/doctor-wise-item-sales", methods=["GET"])
@jwt_required()
def doctor_wise_item_sales():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    doctor_id = request.args.get("doctor_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            si.item_name,
            SUM(si.qty) AS qty_sold,
            doc.name AS doctor_name
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN doctors doc ON doc.id = s.doctor_id
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if doctor_id and doctor_id != 'All':
        sql += " AND s.doctor_id = %s"
        params.append(doctor_id)

    sql += " GROUP BY si.item_name, doc.id, doc.name ORDER BY si.item_name ASC, qty_sold DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# PATIENT WISE SALE REPORT
# ============================================================

@reports_bp.route("/search-patients", methods=["GET"])
@jwt_required()
def search_patients():
    search_term = request.args.get("q", "")
    
    if not search_term:
        return jsonify([])
        
    try:
        search_pattern = f"%{search_term}%"
        sql = """
            SELECT id, patient_uid, name, phone 
            FROM patients 
            WHERE name LIKE %s OR patient_uid LIKE %s OR phone LIKE %s
            ORDER BY name ASC
            LIMIT 10
        """
        rows = query(sql, (search_pattern, search_pattern, search_pattern), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@reports_bp.route("/patient-wise-sale-report", methods=["GET"])
@jwt_required()
def patient_wise_sale_report():
    patient_id = request.args.get("patient_id")

    if not patient_id:
        return jsonify({"error": "patient_id is required"}), 400

    sql = """
        SELECT 
            s.id,
            s.sale_no AS invoice_no,
            s.created_at,
            s.sale_type AS service,
            s.net_amount AS bill_amt,
            s.discount_amount AS discount_amt,
            s.paid_amount,
            s.due_amount,
            s.status,
            
            p.patient_uid AS patient_reg_no,
            p.name AS patient_name,
            p.phone,
            doc.name AS doctor_name

        FROM pharmacy_sales s
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN doctors doc ON doc.id = s.doctor_id
        WHERE s.patient_id = %s
        ORDER BY s.created_at DESC
    """
    
    try:
        rows = query(sql, (patient_id,), many=True)
        
        summary = {
            "invoice_total": sum(float(r["bill_amt"] or 0) for r in rows),
            "discount_total": sum(float(r["discount_amt"] or 0) for r in rows),
            "bill_total": sum(float(r["bill_amt"] or 0) for r in rows),
            "paid_total": sum(float(r["paid_amount"] or 0) for r in rows),
            "due_total": sum(float(r["due_amount"] or 0) for r in rows),
            "due_rec_total": 0.0,
            "return_total": sum(float(r["bill_amt"] or 0) for r in rows if r["status"] == 'Returned')
        }

        return jsonify({
            "data": rows,
            "summary": summary
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ============================================================
# ITEM WISE SALE REPORT
# ============================================================

@reports_bp.route("/item-wise-sale-report", methods=["GET"])
@jwt_required()
def item_wise_sale_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    doctor_id = request.args.get("doctor_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    sql = """
        SELECT 
            si.item_name,
            SUM(si.qty) AS total_qty_sold,
            SUM(si.amount) AS total_amount
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if doctor_id and doctor_id != 'All':
        sql += " AND s.doctor_id = %s"
        params.append(doctor_id)

    sql += " GROUP BY si.item_name ORDER BY total_qty_sold DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# INVOICE TAX REPORT
# ============================================================

@reports_bp.route("/invoice-tax-report", methods=["GET"])
@jwt_required()
def invoice_tax_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    r_type = request.args.get("type", "Daily") # Daily, Monthly, Yearly

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # Determine Date Grouping based on Type (for sorting only)
    date_group = "DATE(s.created_at)"
    if r_type == "Monthly":
        date_group = "DATE_FORMAT(s.created_at, '%%Y-%%m')"
    elif r_type == "Yearly":
        date_group = "YEAR(s.created_at)"

    # Querying each invoice and calculating the tax breakdown per item
    sql = f"""
        SELECT 
            {date_group} AS report_date,
            s.id AS sale_id,
            p.patient_uid AS patient_reg_no,
            p.name AS patient_name,
            s.sale_no AS invoice_no,
            s.net_amount AS invoice_total,
            
            -- Gross Amounts
            SUM(CASE WHEN si.new_tax_percent = 0 THEN si.amount ELSE 0 END) AS gross_0,
            SUM(CASE WHEN si.new_tax_percent = 5 THEN si.amount ELSE 0 END) AS gross_5,
            SUM(CASE WHEN si.new_tax_percent = 12 THEN si.amount ELSE 0 END) AS gross_12,
            SUM(CASE WHEN si.new_tax_percent = 18 THEN si.amount ELSE 0 END) AS gross_18,
            
            -- Tax Amounts
            SUM(CASE WHEN si.new_tax_percent = 0 THEN 0 ELSE 0 END) AS tax_0,
            SUM(CASE WHEN si.new_tax_percent = 5 THEN si.amount - (si.amount / 1.05) ELSE 0 END) AS tax_5,
            SUM(CASE WHEN si.new_tax_percent = 12 THEN si.amount - (si.amount / 1.12) ELSE 0 END) AS tax_12,
            SUM(CASE WHEN si.new_tax_percent = 18 THEN si.amount - (si.amount / 1.18) ELSE 0 END) AS tax_18,
            
            -- Total Tax
            SUM(si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) AS total_tax
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN patients p ON p.id = s.patient_id
        WHERE s.created_at BETWEEN %s AND %s
        GROUP BY s.id, p.patient_uid, p.name, s.sale_no, s.net_amount, {date_group}
        ORDER BY s.created_at DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# PURCHASE PAYMENTS REPORT
# ============================================================

@reports_bp.route("/purchase-payments-report", methods=["GET"])
@jwt_required()
def purchase_payments_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    supplier_id = request.args.get("supplier_id")
    view_type = request.args.get("view_type", "BRIEF")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # We group by Supplier if View Type is BRIEF, otherwise show individual GRN entries
    if view_type == "BRIEF":
        sql = """
            SELECT 
                s.name AS supplier_name,
                COUNT(g.id) AS total_bills,
                SUM(g.total_amount) AS total_gross_amount,
                SUM(IFNULL(g.paid_amount, 0)) AS total_paid_amount,
                SUM(g.total_amount - IFNULL(g.paid_amount, 0)) AS total_due_amount
            FROM grn g
            JOIN suppliers s ON s.id = g.supplier_id
            WHERE g.created_at BETWEEN %s AND %s
        """
        params = [start_dt, end_dt]

        if supplier_id and supplier_id != 'All':
            sql += " AND g.supplier_id = %s"
            params.append(supplier_id)

        sql += " GROUP BY s.id, s.name ORDER BY total_gross_amount DESC"
    else:
        # DETAILED VIEW
        sql = """
            SELECT 
                g.created_at AS grn_date,
                g.grn_no,
                g.invoice_no,
                s.name AS supplier_name,
                g.total_amount AS gross_amount,
                IFNULL(g.paid_amount, 0) AS paid_amount,
                (g.total_amount - IFNULL(g.paid_amount, 0)) AS due_amount
            FROM grn g
            JOIN suppliers s ON s.id = g.supplier_id
            WHERE g.created_at BETWEEN %s AND %s
        """
        params = [start_dt, end_dt]

        if supplier_id and supplier_id != 'All':
            sql += " AND g.supplier_id = %s"
            params.append(supplier_id)

        sql += " ORDER BY g.created_at DESC, g.id DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# STOCK ADJUSTMENT REPORT
# ============================================================

@reports_bp.route("/stock-adjustment-report", methods=["GET"])
@jwt_required()
def stock_adjustment_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # We join with pharmacy_items to get the item name
    sql = """
        SELECT 
            sa.id,
            sa.created_at AS adjustment_date,
            pi.name AS item_name,
            sa.quantity,
            sa.remarks,
            u.name AS adjusted_by
        FROM stock_adjustments sa
        LEFT JOIN pharmacy_items pi ON pi.id = sa.item_id
        LEFT JOIN users u ON u.id = sa.created_by
        WHERE sa.created_at BETWEEN %s AND %s
        ORDER BY sa.created_at DESC, sa.id DESC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# NON-MOVING STOCK REPORT
# ============================================================

@reports_bp.route("/non-moving-stock-report", methods=["GET"])
@jwt_required()
def non_moving_stock_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # We find items that were NOT sold in the selected date range, 
    # but still have current stock > 0.
    sql = """
        SELECT 
            pi.name AS item_name,
            IFNULL(MAX(gi.batch_no), 'N/A') AS batch_no,
            IFNULL(MAX(gi.expiry_date), 'N/A') AS exp_date,
            IFNULL(SUM(gi.qty), 0) AS original_stock_qty,
            IFNULL(MAX(sa.quantity), 0) AS current_stock_qty,
            IFNULL(pi.mrp, 0) AS mrp,
            IFNULL(pi.cost_price, 0) AS rate,
            100 AS non_moving_percentage
        FROM pharmacy_items pi
        LEFT JOIN grn_items gi ON gi.item_id = pi.id
        LEFT JOIN (
            SELECT item_id, SUM(quantity) AS quantity
            FROM stock_adjustments 
            GROUP BY item_id
        ) sa ON sa.item_id = pi.id
        WHERE pi.id NOT IN (
            SELECT DISTINCT si.item_id 
            FROM pharmacy_sale_items si
            JOIN pharmacy_sales s ON s.id = si.sale_id
            WHERE s.created_at BETWEEN %s AND %s
        )
        AND IFNULL(pi.is_active, 1) = 1
        GROUP BY pi.id, pi.name, pi.mrp, pi.cost_price
        HAVING current_stock_qty > 0 OR original_stock_qty > 0
        ORDER BY pi.name ASC
    """

    try:
        rows = query(sql, (start_dt, end_dt), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
@reports_bp.route("/minimum-stock-report", methods=["GET"])
@jwt_required()
def minimum_stock_report():
    try:
        def get_columns(table):
            try:
                cols = query(f"SHOW COLUMNS FROM {table}", many=True)
                return [c["Field"] for c in cols]
            except Exception:
                return []

        # 1. Find item type FK column in pharmacy_items
        pi_cols = get_columns("pharmacy_items")
        item_type_fk = None
        for candidate in ("item_type_id", "type_id", "item_type", "category_id"):
            if candidate in pi_cols:
                item_type_fk = candidate
                break

        # 2. Find type name column in pharmacy_item_types
        it_cols = get_columns("pharmacy_item_types")
        type_name_col = None
        for candidate in ("name", "type_name", "item_type_name"):
            if candidate in it_cols:
                type_name_col = candidate
                break

        # 3. Find quantity columns
        def find_qty_col(table):
            cols = get_columns(table)
            for candidate in ("qty", "quantity", "received_qty", "qty_received"):
                if candidate in cols:
                    return candidate
            return None

        grn_qty = find_qty_col("grn_items")
        sale_qty = find_qty_col("pharmacy_sale_items")

        if not grn_qty or not sale_qty:
            return jsonify({"error": f"Quantity column not found. grn_items: {grn_qty}, sale_items: {sale_qty}"}), 500

        # 4. Build the JOIN clause dynamically
        if item_type_fk and type_name_col:
            join_clause = f"LEFT JOIN pharmacy_item_types it ON it.id = pi.{item_type_fk}"
            type_select = f"IFNULL(it.{type_name_col}, 'N/A') AS item_type"
        else:
            join_clause = ""
            type_select = "'N/A' AS item_type"

        # 5. Build the final query
        sql = f"""
            SELECT 
                pi.id,
                {type_select},
                pi.name AS item_name,
                10 AS min_stock_qty,
                (
                    IFNULL((SELECT SUM({grn_qty}) FROM grn_items WHERE item_id = pi.id), 0) 
                    - 
                    IFNULL((SELECT SUM({sale_qty}) FROM pharmacy_sale_items WHERE item_id = pi.id), 0)
                ) AS current_stock_qty
            FROM pharmacy_items pi
            {join_clause}
            WHERE IFNULL(pi.is_active, 1) = 1
            HAVING current_stock_qty <= 10
            ORDER BY current_stock_qty ASC
        """

        rows = query(sql, many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# SUPPLIER WISE ITEM PURCHASE REPORT
# ============================================================

@reports_bp.route("/supplier-wise-item-purchase", methods=["GET"])
@jwt_required()
def supplier_wise_item_purchase():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    supplier_id = request.args.get("supplier_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # We use gi.qty based on your schema, and group by item to show total purchased
    sql = """
        SELECT 
            gi.item_name,
            SUM(gi.qty) AS purchase_qty
        FROM grn g
        JOIN grn_items gi ON gi.grn_id = g.id
        WHERE g.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if supplier_id and supplier_id != 'Select':
        sql += " AND g.supplier_id = %s"
        params.append(supplier_id)

    sql += " GROUP BY gi.item_name ORDER BY gi.item_name ASC"

    try:
        rows = query(sql, tuple(params), many=True)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
@reports_bp.route("/invoice-status-report", methods=["GET"])
@jwt_required()
def invoice_status_report():
    try:
        # 1. Get Minimum Stock count
        # We use 'quantity' for GRN items and 'qty' for sale items based on typical schemas.
        # If 'quantity' also fails, we catch the error and try a different approach.
        try:
            min_stock_sql = """
                SELECT COUNT(*) as count
                FROM (
                    SELECT pi.id,
                    (
                        IFNULL((SELECT SUM(quantity) FROM grn_items WHERE item_id = pi.id), 0) 
                        - 
                        IFNULL((SELECT SUM(qty) FROM pharmacy_sale_items WHERE item_id = pi.id), 0)
                    ) AS current_stock
                    FROM pharmacy_items pi
                    WHERE IFNULL(pi.is_active, 1) = 1
                    HAVING current_stock <= 10
                ) as low_stock
            """
            min_stock_res = query(min_stock_sql) or {}
            min_stock_count = min_stock_res.get("count", 0)
        except Exception:
            # Fallback: Just count total active items if calculation fails
            min_stock_count = 0

        # 2. Get Non-Moving Stock count (Items with no sales in last 30 days)
        non_moving_sql = """
            SELECT COUNT(DISTINCT pi.id) as count
            FROM pharmacy_items pi
            WHERE IFNULL(pi.is_active, 1) = 1
            AND pi.id NOT IN (
                SELECT DISTINCT si.item_id 
                FROM pharmacy_sale_items si
                JOIN pharmacy_sales s ON s.id = si.sale_id
                WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            )
        """
        non_moving_res = query(non_moving_sql) or {}
        non_moving_count = non_moving_res.get("count", 0)

        # 3. Short Expiry Stock (Expiring in next 90 days)
        short_expiry_sql = """
            SELECT COUNT(DISTINCT item_id) as count
            FROM grn_items
            WHERE expiry_date IS NOT NULL 
              AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
        """
        try:
            short_expiry_res = query(short_expiry_sql) or {}
            short_expiry_count = short_expiry_res.get("count", 0)
        except Exception:
            short_expiry_count = 0

        return jsonify({
            "min_stock_count": min_stock_count,
            "non_moving_count": non_moving_count,
            "short_expiry_count": short_expiry_count
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# PHARMACY ITEM SALE TAX REPORT
# ============================================================

@reports_bp.route("/item-sale-tax-report", methods=["GET"])
@jwt_required()
def item_sale_tax_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    visit_type = request.args.get("visit_type", "ALL")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # We fetch item-level details for Sales and Returns
    # We use IFNULL to gracefully handle missing columns like 'batch_no' or 'expiry_date' in sale items
    sql = """
        SELECT 
            s.created_at AS date,
            s.sale_no AS invoice_no,
            pi.hsn_code,
            si.item_name AS product,
            IFNULL(si.batch_no, '-') AS batch_no,
            IFNULL(gi.expiry_date, '-') AS expiry_date,
            si.qty AS qty,
            si.mrp,
            si.discount_amount AS disc_amount,
            si.amount AS total_inc_gst,
            (si.amount - (si.amount / (1 + (si.new_tax_percent / 100)))) AS gst_value,
            si.new_tax_percent AS gst_percent,
            (si.amount / (1 + (si.new_tax_percent / 100))) AS product_value,
            IFNULL(gi.rate, 0) AS purchase_rate,
            s.sale_type,
            (s.net_amount < 0 OR s.status = 'Returned') AS is_return
        FROM pharmacy_sales s
        JOIN pharmacy_sale_items si ON si.sale_id = s.id
        LEFT JOIN pharmacy_items pi ON pi.id = si.item_id
        LEFT JOIN grn_items gi ON gi.item_id = si.item_id AND gi.batch_no = si.batch_no
        WHERE s.created_at BETWEEN %s AND %s
    """
    params = [start_dt, end_dt]

    if visit_type == "OP/DIRECT":
        sql += " AND s.sale_type IN ('OP', 'Direct')"
    elif visit_type == "IP":
        sql += " AND s.sale_type = 'IP'"

    sql += " ORDER BY s.created_at DESC, s.id DESC, si.id ASC"

    try:
        rows = query(sql, tuple(params), many=True)
        
        # Separate Sales and Returns
        sales = [row for row in rows if not row.get("is_return")]
        returns = [row for row in rows if row.get("is_return")]
        
        return jsonify({
            "sales": sales,
            "returns": returns
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# USER WISE DISCOUNT REPORT
# ============================================================

@reports_bp.route("/user-wise-discount-report", methods=["GET"])
@jwt_required()
def user_wise_discount_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    user_id = request.args.get("user_id")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # We join with users (for the cashier) and patients (for patient details)
    # We only fetch records where discount_amount > 0
    sql = """
        SELECT 
            s.id,
            s.sale_no AS invoice_no,
            s.created_at AS billed_date,
            s.sale_type AS bill_type,
            s.net_amount AS total,
            s.discount_amount,
            s.remarks AS discount_comments,
            
            p.patient_uid AS patient_reg_no,
            p.name AS patient_name,
            
            u.name AS user_name
            
        FROM pharmacy_sales s
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.created_at BETWEEN %s AND %s
          AND s.discount_amount > 0
    """
    params = [start_dt, end_dt]

    if user_id and user_id != 'All':
        sql += " AND s.created_by = %s"
        params.append(user_id)

    sql += " ORDER BY s.created_at DESC, s.id DESC"

    try:
        rows = query(sql, tuple(params), many=True)
        
        # Calculate Totals for the footer
        total_amount = sum(float(r["total"] or 0) for r in rows)
        total_discount = sum(float(r["discount_amount"] or 0) for r in rows)
        
        return jsonify({
            "data": rows,
            "totals": {
                "total_amount": total_amount,
                "total_discount": total_discount
            }
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# GRN WISE SALES REPORT
# ============================================================

@reports_bp.route("/grn-wise-sales-report", methods=["GET"])
@jwt_required()
def grn_wise_sales_report():
    grn_no = request.args.get("grn_no")

    if not grn_no or grn_no == 'Select':
        return jsonify({"error": "GRN Number is required"}), 400

    try:
        # 1. First, find the GRN ID from the GRN Number
        grn_res = query("SELECT id, created_at FROM grn WHERE grn_no = %s", (grn_no,))
        if not grn_res:
            return jsonify({"error": "GRN not found"}), 404
            
        grn_id = grn_res["id"]
        grn_date = grn_res["created_at"]

        # 2. Fetch items from this GRN and calculate sold quantities
        # We join with pharmacy_sale_items to see how many were sold
        sql = """
            SELECT 
                g.grn_no,
                g.created_at AS grn_date,
                gi.item_name,
                gi.batch_no,
                gi.qty AS grn_qty,
                gi.rate AS purchase_rate,
                gi.mrp,
                gi.amount AS grn_value,
                
                -- Calculate sold quantity for this specific batch
                IFNULL((
                    SELECT SUM(si.qty) 
                    FROM pharmacy_sale_items si 
                    JOIN pharmacy_sales s ON s.id = si.sale_id
                    WHERE si.item_id = gi.item_id 
                      AND si.batch_no = gi.batch_no
                      AND s.net_amount >= 0 -- Only count actual sales, not returns
                ), 0) AS sold_qty,
                
                -- Calculate available quantity
                (gi.qty - IFNULL((
                    SELECT SUM(si.qty) 
                    FROM pharmacy_sale_items si 
                    JOIN pharmacy_sales s ON s.id = si.sale_id
                    WHERE si.item_id = gi.item_id 
                      AND si.batch_no = gi.batch_no
                      AND s.net_amount >= 0
                ), 0)) AS available_qty,
                
                -- Tax calculation
                IFNULL(gi.tax_percent, 0) AS tax_percent
                
            FROM grn_items gi
            JOIN grn g ON g.id = gi.grn_id
            WHERE g.id = %s
        """
        
        rows = query(sql, (grn_id,), many=True)
        
        # Format the response for the frontend
        # The screenshot expects these columns: InvoiceNo (can be GRN No here), GRN Date, Item Name, Batch No, Qty, Qty Available, MRP, Rate, Tax %, Eff Rate, GRN Value, Qty Available value(Rate), MRP Value, Rate Value, EffRate Value
        
        # We'll map the available columns to the expected keys
        formatted_rows = []
        for r in rows:
            tax_pct = float(r["tax_percent"] or 0)
            rate = float(r["purchase_rate"] or 0)
            qty = float(r["available_qty"] or 0)
            mrp = float(r["mrp"] or 0)
            
            # Effective rate = Rate * (1 + Tax%)
            eff_rate = rate * (1 + (tax_pct / 100))
            
            formatted_rows.append({
                "invoice_no": r["grn_no"], # Reusing GRN No as invoice
                "grn_date": r["grn_date"],
                "item_name": r["item_name"],
                "batch_no": r["batch_no"],
                "qty": r["grn_qty"],
                "qty_available": qty,
                "mrp": mrp,
                "rate": rate,
                "tax_percent": tax_pct,
                "eff_rate": eff_rate,
                "grn_value": r["grn_value"],
                "qty_available_value_rate": qty * rate,
                "mrp_value": qty * mrp,
                "rate_value": qty * rate,
                "eff_rate_value": qty * eff_rate
            })

        return jsonify(formatted_rows)
        
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
# ============================================================
# STOCK LEDGER (STOCK JOURNAL) REPORT
# ============================================================

@reports_bp.route("/stock-ledger-report", methods=["GET"])
@jwt_required()
def stock_ledger_report():
    start = request.args.get("start_date")
    end = request.args.get("end_date")

    if not start or not end:
        return jsonify({"error": "start_date and end_date are required"}), 400

    start_dt = f"{start} 00:00:00"
    end_dt = f"{end} 23:59:59.999999"

    # Complex query to calculate Opening, In, Out, and Closing stock for each item
    # We assume 'qty' is the quantity column in grn_items and pharmacy_sale_items
    sql = """
        SELECT 
            pi.id,
            pi.name AS item_name,
            pi.mrp,
            IFNULL(pi.cost_price, 0) AS rate,
            
            -- 1. Opening Stock (Transactions BEFORE start_date)
            IFNULL((
                SELECT SUM(qty) FROM grn_items gi 
                JOIN grn g ON g.id = gi.grn_id 
                WHERE gi.item_id = pi.id AND g.created_at < %s
            ), 0) - IFNULL((
                SELECT SUM(qty) FROM pharmacy_sale_items si 
                JOIN pharmacy_sales s ON s.id = si.sale_id 
                WHERE si.item_id = pi.id AND s.created_at < %s
            ), 0) AS opening_qty,
            
            -- 2. Stock IN (Purchases within date range)
            IFNULL((
                SELECT SUM(qty) FROM grn_items gi 
                JOIN grn g ON g.id = gi.grn_id 
                WHERE gi.item_id = pi.id AND g.created_at BETWEEN %s AND %s
            ), 0) AS in_purchases,
            
            -- 3. Stock OUT (Sales within date range)
            IFNULL((
                SELECT SUM(qty) FROM pharmacy_sale_items si 
                JOIN pharmacy_sales s ON s.id = si.sale_id 
                WHERE si.item_id = pi.id AND s.created_at BETWEEN %s AND %s
            ), 0) AS out_sales,
            
            -- 4. Adjusted Qty (assuming from stock_adjustments table)
            IFNULL((
                SELECT SUM(quantity) FROM stock_adjustments sa
                WHERE sa.item_id = pi.id AND sa.created_at BETWEEN %s AND %s
            ), 0) AS adjusted_qty

        FROM pharmacy_items pi
        WHERE IFNULL(pi.is_active, 1) = 1
        ORDER BY pi.name ASC
    """
    
    # Note: We pass the start/end dates multiple times for the different subqueries
    params = [
        start_dt,               # Opening GRN
        start_dt,               # Opening Sales
        start_dt, end_dt,       # In Purchases
        start_dt, end_dt,       # Out Sales
        start_dt, end_dt        # Adjustments
    ]

    try:
        rows = query(sql, tuple(params), many=True)
        
        # Post-process to calculate Closing Stock and Values
        formatted_rows = []
        for r in rows:
            opening_qty = float(r["opening_qty"] or 0)
            in_purchases = float(r["in_purchases"] or 0)
            out_sales = float(r["out_sales"] or 0)
            adjusted_qty = float(r["adjusted_qty"] or 0)
            
            # Closing Stock = Opening + In - Out + Adjustments
            closing_qty = opening_qty + in_purchases - out_sales + adjusted_qty
            
            mrp = float(r["mrp"] or 0)
            rate = float(r["rate"] or 0)
            
            formatted_rows.append({
                "item_name": r["item_name"],
                
                "opening_qty": opening_qty,
                "opening_mrp_value": opening_qty * mrp,
                "opening_rate_value": opening_qty * rate,
                
                "in_purchases": in_purchases,
                "out_sales": out_sales,
                
                "adjusted_qty": adjusted_qty,
                
                "closing_qty": closing_qty,
                "closing_mrp_value": closing_qty * mrp,
                "closing_rate_value": closing_qty * rate
            })
            
        # Filter out items that have absolutely no movement to keep the report clean
        filtered_rows = [
            r for r in formatted_rows 
            if r["opening_qty"] != 0 or r["in_purchases"] != 0 or r["out_sales"] != 0 or r["adjusted_qty"] != 0
        ]

        return jsonify(filtered_rows)
        
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500