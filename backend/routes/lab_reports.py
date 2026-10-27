from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query

lab_reports_bp = Blueprint("lab_reports", __name__)


# ---------- HELPERS ----------
def _report_table(kind):
    return "op_lab_results" if kind == "op" else "ip_lab_results"

def _values_table(kind):
    return "op_lab_result_values" if kind == "op" else "ip_lab_result_values"

def _reg_join(kind):
    return "op_registrations" if kind == "op" else "ip_registrations"

def _reg_col(kind):
    return "opd_reg_no" if kind == "op" else "ip_reg_no"

def _reg_fk(kind):
    return "op_registration_id" if kind == "op" else "ip_registration_id"


# ============================================================
# OP LIST
# ============================================================
@lab_reports_bp.route("/op", methods=["GET"])
@jwt_required()
def get_op_lab_reports():
    search = request.args.get("search", "")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    patient_id = request.args.get("patient_id")
    status = request.args.get("status")

    # ✅ REMOVED lr.lab_test_id FROM SELECT
    sql = """
        SELECT lr.id, lr.op_registration_id, lr.patient_id,
               lr.test_name, lr.result, lr.normal_range, lr.unit,
               lr.status, lr.report_date, lr.created_at, lr.updated_at,
               p.name AS patient_name, p.patient_uid AS mr_number,
               r.opd_reg_no,
               u1.name AS performed_by_name,
               u2.name AS verified_by_name
        FROM op_lab_results lr
        JOIN patients p ON p.id = lr.patient_id
        JOIN op_registrations r ON r.id = lr.op_registration_id
        LEFT JOIN users u1 ON u1.id = lr.performed_by
        LEFT JOIN users u2 ON u2.id = lr.verified_by
        WHERE 1=1
    """
    params = []

    if patient_id:
        sql += " AND lr.patient_id = %s"
        params.append(patient_id)

    if search:
        sql += " AND (lr.test_name LIKE %s OR p.name LIKE %s OR r.opd_reg_no LIKE %s)"
        like = f"%{search}%"
        params.extend([like, like, like])

    if start_date:
        sql += " AND DATE(lr.report_date) >= %s"
        params.append(start_date)
    if end_date:
        sql += " AND DATE(lr.report_date) <= %s"
        params.append(end_date)
    if status:
        sql += " AND lr.status = %s"
        params.append(status)

    sql += " ORDER BY lr.created_at DESC"
    return jsonify(query(sql, tuple(params), many=True))


# ============================================================
# IP LIST
# ============================================================
@lab_reports_bp.route("/ip", methods=["GET"])
@jwt_required()
def get_ip_lab_reports():
    search = request.args.get("search", "")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    patient_id = request.args.get("patient_id")
    status = request.args.get("status")

    # ✅ REMOVED lr.lab_test_id FROM SELECT
    sql = """
        SELECT lr.id, lr.ip_registration_id, lr.patient_id,
               lr.test_name, lr.result, lr.normal_range, lr.unit,
               lr.status, lr.report_date, lr.created_at, lr.updated_at,
               p.name AS patient_name, p.patient_uid AS mr_number,
               r.ip_reg_no,
               u1.name AS performed_by_name,
               u2.name AS verified_by_name
        FROM ip_lab_results lr
        JOIN patients p ON p.id = lr.patient_id
        JOIN ip_registrations r ON r.id = lr.ip_registration_id
        LEFT JOIN users u1 ON u1.id = lr.performed_by
        LEFT JOIN users u2 ON u2.id = lr.verified_by
        WHERE 1=1
    """
    params = []

    if patient_id:
        sql += " AND lr.patient_id = %s"
        params.append(patient_id)

    if search:
        sql += " AND (lr.test_name LIKE %s OR p.name LIKE %s OR r.ip_reg_no LIKE %s)"
        like = f"%{search}%"
        params.extend([like, like, like])

    if start_date:
        sql += " AND DATE(lr.report_date) >= %s"
        params.append(start_date)
    if end_date:
        sql += " AND DATE(lr.report_date) <= %s"
        params.append(end_date)
    if status:
        sql += " AND lr.status = %s"
        params.append(status)

    sql += " ORDER BY lr.created_at DESC"
    return jsonify(query(sql, tuple(params), many=True))


# ============================================================
# UPDATE STATUS
# ============================================================
@lab_reports_bp.route("/<int:report_id>/status", methods=["PATCH"])
@jwt_required()
def update_report_status(report_id):
    data = request.get_json() or {}
    status = data.get("status")
    table = data.get("table")

    if not status or not table:
        return jsonify({"error": "status and table are required"}), 400
    if table not in ("op", "ip"):
        return jsonify({"error": "Invalid table"}), 400

    table_name = _report_table(table)
    if not query(f"SELECT id FROM {table_name} WHERE id=%s", (report_id,)):
        return jsonify({"error": "Report not found"}), 404

    actor = get_jwt_identity()
    extra = ""
    params = [status]

    if status == "Completed":
        extra = ", performed_by=%s, report_date=NOW()"
        params.append(actor)
    elif status == "Verified":
        extra = ", verified_by=%s, report_date=COALESCE(report_date, NOW())"
        params.append(actor)

    params.append(report_id)
    query(
        f"UPDATE {table_name} SET status=%s{extra} WHERE id=%s",
        tuple(params),
        fetch=False,
        commit=True,
    )
    return jsonify({"success": True}), 200


# ============================================================
# GET REPORT WITH ATTRIBUTE VALUES
# ============================================================
@lab_reports_bp.route("/<int:report_id>/detail", methods=["GET"])
@jwt_required()
def get_report_detail(report_id):
    kind = request.args.get("table", "op")
    if kind not in ("op", "ip"):
        return jsonify({"error": "Invalid table"}), 400

    rt = _report_table(kind)
    vt = _values_table(kind)
    rj = _reg_join(kind)
    rc = _reg_col(kind)
    rf = _reg_fk(kind)

    # ---------------- HEADER ----------------
    # Note: We don't have lab_test_id in the table anymore, so we check it via JOIN if needed, 
    # or we just rely on test_name to fetch attributes.
    header = query(f"""
        SELECT lr.id, lr.{rf} AS registration_id, lr.patient_id,
               lr.test_name, lr.status, lr.report_date,
               p.name AS patient_name, p.patient_uid AS mr_number,
               r.{rc} AS reg_no
        FROM {rt} lr
        JOIN patients p ON p.id = lr.patient_id
        JOIN {rj} r ON r.id = lr.{rf}
        WHERE lr.id = %s
    """, (report_id,))

    if not header:
        return jsonify({"error": "Report not found"}), 404

    # ---------------- STORED VALUES ----------------
    stored = query(f"""
        SELECT id, lab_attribute_id, attribute_name, result_value,
               normal_range, unit
        FROM {vt}
        WHERE report_id=%s
        ORDER BY id
    """, (report_id,), many=True)

    # ---------------- RESOLVE TEST ID ----------------
    # Since lab_test_id is removed from op_lab_results/ip_lab_results, 
    # we look it up by test_name in the lab_tests master table.
    test_id = None
    if header.get("test_name"):
        row = query(
            "SELECT id FROM lab_tests "
            "WHERE LOWER(TRIM(test_name))=LOWER(TRIM(%s))",
            (header["test_name"],),
        )
        if row:
            test_id = row["id"]

    # ---------------- MASTER ATTRIBUTES ----------------
    master_attrs = []
    if test_id:
        master_attrs = query("""
            SELECT lta.id AS link_id,
                   lta.id AS lab_attribute_id,
                   lta.attribute_name,
                   lta.unit,
                   lta.normal_range,
                   NULL AS options,
                   0    AS is_long_text,
                   0    AS suggest_results
            FROM lab_test_attributes lta
            WHERE lta.lab_test_id = %s
              AND (lta.is_active IS NULL OR lta.is_active = 1)
            ORDER BY lta.id
        """, (test_id,), many=True)

    # ---------------- MERGE ----------------
    stored_map = {str(s["lab_attribute_id"]): s for s in stored}
    merged = []
    for m in master_attrs:
        s = stored_map.get(str(m["lab_attribute_id"]))
        merged.append({
            **m,
            "value_id": s["id"] if s else None,
            "result_value": s["result_value"] if s else "",
        })

    for s in stored:
        if not any(
            str(m["lab_attribute_id"]) == str(s["lab_attribute_id"])
            for m in master_attrs
        ):
            merged.append({
                "link_id": None,
                "lab_attribute_id": s["lab_attribute_id"],
                "attribute_name": s["attribute_name"],
                "normal_range": s["normal_range"],
                "unit": s["unit"],
                "options": None,
                "is_long_text": 0,
                "suggest_results": 0,
                "value_id": s["id"],
                "result_value": s["result_value"] or "",
            })

    return jsonify({
        "header": header,
        "attributes": merged,
    })


# ============================================================
# SAVE ATTRIBUTE VALUES
# ============================================================
@lab_reports_bp.route("/<int:report_id>/values", methods=["POST"])
@jwt_required()
def save_report_values(report_id):
    body = request.get_json() or {}
    kind = body.get("table", "op")
    if kind not in ("op", "ip"):
        return jsonify({"error": "Invalid table"}), 400

    rt = _report_table(kind)
    vt = _values_table(kind)

    if not query(f"SELECT id FROM {rt} WHERE id=%s", (report_id,)):
        return jsonify({"error": "Report not found"}), 404

    values = body.get("values") or []

    query(f"DELETE FROM {vt} WHERE report_id=%s", (report_id,), fetch=False, commit=True)

    for v in values:
        attr_name = (v.get("attribute_name") or "").strip()
        if not attr_name:
            continue
        query(f"""
            INSERT INTO {vt}
              (report_id, lab_attribute_id, attribute_name,
               result_value, normal_range, unit)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            report_id,
            v.get("lab_attribute_id"),
            attr_name,
            (v.get("result_value") or "").strip(),
            (v.get("normal_range") or "").strip() or None,
            (v.get("unit") or "").strip() or None,
        ), fetch=False, commit=True)

    if body.get("mark_in_progress"):
        query(
            f"UPDATE {rt} SET status='In Progress' "
            f"WHERE id=%s AND status='Pending'",
            (report_id,),
            fetch=False,
            commit=True,
        )

    return jsonify({"success": True, "count": len(values)}), 200