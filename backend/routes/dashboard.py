from datetime import date, datetime
import json

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from db import query

dashboard_bp = Blueprint("dashboard", __name__)


# ---------------------------------------------------------------------------
# TOP SUMMARY
# ---------------------------------------------------------------------------
@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def summary():
    registrations = query(
        "SELECT COUNT(*) c FROM patients WHERE DATE(created_at)=CURDATE()"
    )["c"]
    appointments = query(
        "SELECT COUNT(*) c FROM appointments WHERE appointment_date=CURDATE()"
    )["c"]
    op_patients = query(
        "SELECT COUNT(DISTINCT patient_id) c FROM op_bills WHERE DATE(created_at)=CURDATE()"
    )["c"]
    ip_admissions = query(
        "SELECT COUNT(*) c FROM admissions WHERE admission_date=CURDATE()"
    )["c"]
    pending_bills = (
        query("SELECT COUNT(*) c FROM op_bills WHERE status IN ('Due','Partial')")["c"]
        + query(
            "SELECT COUNT(*) c FROM ip_bills WHERE status IN ('Due','Partial','Draft')"
        )["c"]
    )
    revenue = (
        query(
            "SELECT IFNULL(SUM(paid_amount),0) s FROM op_bills WHERE DATE(created_at)=CURDATE()"
        )["s"] or 0
    ) + (
        query(
            "SELECT IFNULL(SUM(paid_amount),0) s FROM ip_bills WHERE DATE(created_at)=CURDATE()"
        )["s"] or 0
    )
    cancelled_bills = (
        query(
            "SELECT COUNT(*) c FROM op_bills WHERE status='Cancelled' AND DATE(created_at)=CURDATE()"
        )["c"]
        + query(
            "SELECT COUNT(*) c FROM ip_bills WHERE status='Cancelled' AND DATE(created_at)=CURDATE()"
        )["c"]
    )
    pending_labs = query("SELECT COUNT(*) c FROM lab_tests WHERE status='Pending'")["c"]

    return jsonify({
        "todays_registrations": registrations,
        "todays_appointments": appointments,
        "todays_op_patients": op_patients,
        "todays_ip_admissions": ip_admissions,
        "pending_bills": pending_bills,
        "todays_revenue": float(revenue),
        "cancelled_bills": cancelled_bills,
        "pending_lab_reports": pending_labs,
    })


# ---------------------------------------------------------------------------
# CHARTS
# ---------------------------------------------------------------------------
@dashboard_bp.route("/charts/patients-per-day", methods=["GET"])
@jwt_required()
def patients_per_day():
    rows = query("""
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM patients
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(created_at) ORDER BY day
    """, many=True)
    return jsonify(rows)


@dashboard_bp.route("/charts/revenue", methods=["GET"])
@jwt_required()
def revenue_chart():
    rows = query("""
        SELECT d.day, IFNULL(op.total,0) + IFNULL(ip.total,0) AS revenue FROM (
            SELECT CURDATE() - INTERVAL n DAY AS day
            FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
                  UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) days
        ) d
        LEFT JOIN (SELECT DATE(created_at) day, SUM(paid_amount) total
                   FROM op_bills GROUP BY DATE(created_at)) op ON op.day = d.day
        LEFT JOIN (SELECT DATE(created_at) day, SUM(paid_amount) total
                   FROM ip_bills GROUP BY DATE(created_at)) ip ON ip.day = d.day
        ORDER BY d.day
    """, many=True)
    return jsonify(rows)


@dashboard_bp.route("/charts/op-vs-ip", methods=["GET"])
@jwt_required()
def op_vs_ip():
    op = query(
        "SELECT COUNT(*) c FROM op_bills WHERE DATE(created_at) >= CURDATE() - INTERVAL 6 DAY"
    )["c"]
    ip = query(
        "SELECT COUNT(*) c FROM ip_bills WHERE DATE(created_at) >= CURDATE() - INTERVAL 6 DAY"
    )["c"]
    return jsonify([{"name": "OP", "value": op}, {"name": "IP", "value": ip}])


@dashboard_bp.route("/charts/department-collection", methods=["GET"])
@jwt_required()
def department_collection():
    rows = query("""
        SELECT dep.name AS department, IFNULL(SUM(a.consultation_fee),0) AS collection
        FROM departments dep
        LEFT JOIN appointments a
               ON a.department_id = dep.id AND a.status='Completed'
        GROUP BY dep.id
    """, many=True)
    return jsonify(rows)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def _empty_bucket():
    return {"cash": 0.0, "card": 0.0, "upi": 0.0, "bank": 0.0, "total": 0.0, "count": 0}


def _mode_key(mode):
    if not mode:
        return "cash"
    m = str(mode).strip().lower()
    if m == "cash":
        return "cash"
    if m == "card":
        return "card"
    if m == "upi":
        return "upi"
    return "bank"


def _add(bucket, mode, amount):
    try:
        amt = float(amount or 0)
    except (TypeError, ValueError):
        return
    if amt == 0:
        return
    bucket[_mode_key(mode)] += amt
    bucket["total"] += amt


def _parse_split(raw):
    if not raw:
        return None
    if isinstance(raw, dict):
        return {str(k): float(v or 0) for k, v in raw.items()}
    if isinstance(raw, (str, bytes, bytearray)):
        try:
            data = json.loads(raw)
        except Exception:
            return None
        if isinstance(data, dict):
            return {str(k): float(v or 0) for k, v in data.items()}
    return None


def _iter_paid_splits(paid_amount, single_mode, split_json):
    if paid_amount <= 0:
        return
    split = _parse_split(split_json)
    if split:
        total = sum(split.values())
        if total > 0:
            scale = paid_amount / total
            for mode, amt in split.items():
                if amt > 0:
                    yield mode, amt * scale
            return
    yield single_mode, paid_amount


def _distribute(paid_amount, single_mode, split_json, parts, bucket_map):
    for key, part_amt in parts.items():
        if part_amt:
            bucket = bucket_map.get(key)
            if bucket is not None:
                bucket["count"] += 1

    if paid_amount <= 0:
        return
    splits = list(_iter_paid_splits(paid_amount, single_mode, split_json))
    if not splits:
        return

    total_parts = sum(float(v or 0) for v in parts.values())

    if total_parts <= 0:
        for k in parts:
            bucket = bucket_map.get(k)
            if bucket is not None:
                for mode, amt in splits:
                    _add(bucket, mode, amt)
                return
        return

    for target_key, part_amt in parts.items():
        if not part_amt:
            continue
        bucket = bucket_map.get(target_key)
        if bucket is None:
            continue
        for mode, amt in splits:
            _add(bucket, mode, amt * (float(part_amt) / total_parts))


# ---------------------------------------------------------------------------
# CLASSIFICATION
# ---------------------------------------------------------------------------
def _route_op_bill(bill_no, consult, lab, radiology, proc, service):
    bn = (bill_no or "").upper()

    if bn.startswith("IPD"):
        return "ip_diagnostics"
    if bn.startswith("IPR"):
        return "ip_radiology"

    if (lab > 0
            and consult == 0
            and radiology == 0
            and proc == 0
            and service == 0):
        return "direct_diagnostics"

    if bn.startswith("OPR"):
        if radiology > 0 and service == 0 and lab == 0:
            return "direct_radiology"
        if service > 0:
            return "op_radiology"
        return "op_radiology"

    if bn.startswith("OPINV") or bn.startswith("OPDINV") or bn.startswith("OPIN"):
        if service > 0:
            return "op_diagnostics"
        if radiology > 0:
            return "op_radiology"
        if lab > 0:
            return "op_diagnostics"
        return "op_diagnostics"

    if bn.startswith("INV"):
        return "op_billing"

    if consult > 0 and lab == 0 and radiology == 0 and proc == 0 and service == 0:
        return "op_billing"
    if service > 0:
        return "op_diagnostics"
    if radiology > 0:
        return "op_radiology"
    if lab > 0:
        return "op_diagnostics"
    return None


# ---------------------------------------------------------------------------
# COLLECTION SUMMARY
# ---------------------------------------------------------------------------
@dashboard_bp.route("/collection-summary", methods=["GET"])
@jwt_required()
def collection_summary():
    start_date = request.args.get("start_date") or date.today().isoformat()
    end_date = request.args.get("end_date") or date.today().isoformat()

    op_billing = _empty_bucket()
    op_diagnostics = _empty_bucket()
    op_radiology = _empty_bucket()
    direct_patients = _empty_bucket()
    direct_diagnostics = _empty_bucket()
    direct_radiology = _empty_bucket()
    ip_income = _empty_bucket()
    ip_diagnostics = _empty_bucket()
    ip_radiology = _empty_bucket()

    op_due_direct = 0.0
    op_due_lab_radiology = 0.0
    ip_due_bill = 0.0
    ip_due_lab_radiology = 0.0

    op_bills = query("""
        SELECT id, bill_no, patient_id, appointment_id,
               consultation_charge, lab_charge, procedure_charge,
               service_charge, pharmacy_charge, radiology_charge,
               paid_amount, due_amount, payment_mode, payment_split,
               status, remarks, created_at
        FROM op_bills
        WHERE DATE(created_at) BETWEEN %s AND %s
          AND status <> 'Cancelled'
    """, (start_date, end_date), many=True)

    for b in op_bills:
        paid = float(b["paid_amount"] or 0)
        due = float(b["due_amount"] or 0)
        mode = b.get("payment_mode")
        split = b.get("payment_split")

        consult   = float(b["consultation_charge"] or 0)
        lab       = float(b["lab_charge"] or 0)
        radiology = float(b.get("radiology_charge") or 0)
        proc      = float(b["procedure_charge"] or 0)
        service   = float(b["service_charge"] or 0)

        if consult == 0 and lab == 0 and radiology == 0 and proc == 0 and service == 0:
            fallback = paid + due
            bn_u = (b.get("bill_no") or "").upper()
            if bn_u.startswith("OPR"):
                radiology = fallback
            elif bn_u.startswith("OPINV"):
                service = fallback
            else:
                consult = fallback

        bucket_name = _route_op_bill(
            b.get("bill_no"), consult, lab, radiology, proc, service,
        )

        parts = {}
        bucket_map = {}

        if bucket_name == "op_billing":
            parts = {"consult": consult}
            bucket_map = {"consult": op_billing}

        elif bucket_name == "op_diagnostics":
            parts = {"lab": lab, "service": service, "proc": proc}
            bucket_map = {"lab": op_diagnostics, "service": op_diagnostics, "proc": op_diagnostics}

        elif bucket_name == "op_radiology":
            parts = {"radiology": service or radiology}
            bucket_map = {"radiology": op_radiology}

        elif bucket_name == "direct_patients":
            parts = {"consult": consult}
            bucket_map = {"consult": direct_patients}

        elif bucket_name == "direct_diagnostics":
            parts = {"lab": lab, "service": service, "proc": proc}
            bucket_map = {"lab": direct_diagnostics, "service": direct_diagnostics, "proc": direct_diagnostics}

        elif bucket_name == "direct_radiology":
            parts = {"radiology": radiology}
            bucket_map = {"radiology": direct_radiology}

        elif bucket_name == "ip_diagnostics":
            parts = {"lab": lab, "service": service, "proc": proc}
            bucket_map = {"lab": ip_diagnostics, "service": ip_diagnostics, "proc": ip_diagnostics}

        elif bucket_name == "ip_radiology":
            parts = {"radiology": radiology}
            bucket_map = {"radiology": ip_radiology}

        else:
            continue

        _distribute(paid, mode, split, parts, bucket_map)

        total_parts = sum(parts.values()) or 0
        if due and total_parts > 0:
            if bucket_name in ("op_radiology", "direct_radiology", "ip_radiology"):
                op_due_lab_radiology += due
            elif bucket_name.startswith("ip_"):
                ip_due_lab_radiology += due
            else:
                op_due_direct += due

    ip_cols = {c["Field"] for c in query("SHOW COLUMNS FROM ip_bills", many=True)}
    has_ip_mode = "payment_mode" in ip_cols
    has_ip_split = "payment_split" in ip_cols

    mode_select = "payment_mode" if has_ip_mode else "'Cash' AS payment_mode"
    split_select = "payment_split" if has_ip_split else "NULL AS payment_split"

    ip_bills = query(f"""
        SELECT id, admission_id, ip_registration_id, admission_charge, room_charge,
               doctor_visit_charge, lab_charge, radiology_charge, ot_charge,
               procedure_charge, medicine_charge, nursing_charge, service_charge,
               food_charge, misc_charge, paid_amount, due_amount,
               {mode_select}, {split_select}
        FROM ip_bills
        WHERE DATE(created_at) BETWEEN %s AND %s
          AND status <> 'Cancelled'
    """, (start_date, end_date), many=True)

    for b in ip_bills:
        paid = float(b["paid_amount"] or 0)
        due = float(b["due_amount"] or 0)
        mode = b.get("payment_mode") or "Cash"
        split = b.get("payment_split")

        lab = float(b["lab_charge"] or 0)
        radiology = float(b["radiology_charge"] or 0)
        other = (
            float(b["admission_charge"] or 0)
            + float(b["room_charge"] or 0)
            + float(b["doctor_visit_charge"] or 0)
            + float(b["ot_charge"] or 0)
            + float(b["procedure_charge"] or 0)
            + float(b["medicine_charge"] or 0)
            + float(b["nursing_charge"] or 0)
            + float(b["service_charge"] or 0)
            + float(b["food_charge"] or 0)
            + float(b["misc_charge"] or 0)
        )

        parts = {"other": other, "lab": lab, "radiology": radiology}
        bucket_map = {"other": ip_income, "lab": ip_diagnostics, "radiology": ip_radiology}
        _distribute(paid, mode, split, parts, bucket_map)

        total_parts = sum(parts.values()) or 1
        if due:
            ip_due_bill += due * (other / total_parts)
            ip_due_lab_radiology += due * ((lab + radiology) / total_parts)

    refunds = query("""
        SELECT bill_type, IFNULL(SUM(amount),0) s
        FROM billing_actions
        WHERE action_type='Advance_Refund'
          AND DATE(created_at) BETWEEN %s AND %s
        GROUP BY bill_type
    """, (start_date, end_date), many=True)
    refund_map = {r["bill_type"]: float(r["s"]) for r in refunds}

    total_income = (
        op_billing["total"] + op_diagnostics["total"] + op_radiology["total"]
        + direct_patients["total"] + direct_diagnostics["total"] + direct_radiology["total"]
        + ip_income["total"] + ip_diagnostics["total"] + ip_radiology["total"]
    )
    expenses = 0.0
    grand_total = total_income - expenses

    users_count = query("SELECT COUNT(*) c FROM users WHERE is_active=1")["c"]
    doctors_count = query("SELECT COUNT(*) c FROM doctors")["c"]

    return jsonify({
        "range": {"start_date": start_date, "end_date": end_date},
        "meta": {
            "users": users_count,
            "doctors": doctors_count,
            "last_updated": datetime.now().isoformat(),
            "sms_remaining": None,
        },
        "op_billing": op_billing,
        "op_diagnostics": op_diagnostics,
        "op_radiology": op_radiology,
        "op_refund": refund_map.get("OP", 0.0),
        "direct_patients": direct_patients,
        "direct_diagnostics": direct_diagnostics,
        "direct_radiology": direct_radiology,
        "ip_income": ip_income,
        "ip_diagnostics": ip_diagnostics,
        "ip_radiology": ip_radiology,
        "ip_refund": refund_map.get("IP", 0.0),
        "total_income": total_income,
        "expenses": expenses,
        "grand_total": grand_total,
        "due": {
            "op_direct_bill_due": op_due_direct,
            "op_lab_radiology_due": op_due_lab_radiology,
            "ip_bill_due": ip_due_bill,
            "ip_lab_radiology_due": ip_due_lab_radiology,
            "total_due": (
                op_due_direct + op_due_lab_radiology
                + ip_due_bill + ip_due_lab_radiology
            ),
        },
    })


# ---------------------------------------------------------------------------
# COLLECTION BREAKDOWN (drill-down for Cash / Card / UPI / Bank / Total)
# ---------------------------------------------------------------------------
def _row_matches_category(bucket_name, category):
    if category == "op_billing":
        return bucket_name == "op_billing"
    if category == "op_diagnostics":
        return bucket_name == "op_diagnostics"
    if category == "op_radiology":
        return bucket_name == "op_radiology"
    if category == "direct_patients":
        return bucket_name == "direct_patients"
    if category == "direct_diagnostics":
        return bucket_name == "direct_diagnostics"
    if category == "direct_radiology":
        return bucket_name == "direct_radiology"
    if category == "ip_income":
        return bucket_name in ("ip_diagnostics", "ip_radiology")
    if category == "ip_diagnostics":
        return bucket_name == "ip_diagnostics"
    if category == "ip_radiology":
        return bucket_name == "ip_radiology"
    return False

def _row_amount_for_mode(bucket_name, mode, consult, lab, radiology, proc, service,
                          paid, due, payment_mode, split_json):
    """
    Return (amount_for_mode, total_bill) for a row given a mode filter.

    Classification (which bucket) still uses the charge columns. The DISPLAYED
    amounts use `paid` — the amount actually collected (already discounted by
    the importer for OP-Diagnostics / OP-Radiology / Direct-Diagnostics /
    Direct-Radiology cash bills) — so the modal's Total column matches the
    summary card's Total.

    mode = 'total'  → the bill's full paid amount
    mode = other    → only the portion of `paid` allocated to that mode
    """
    if paid <= 0:
        return 0.0, 0.0

    # The bill's contribution to this bucket is the amount actually collected.
    bill_amount = paid

    if mode == "total":
        return bill_amount, bill_amount

    mode_sum = 0.0
    for m, amt in _iter_paid_splits(paid, payment_mode, split_json):
        if _mode_key(m) == _mode_key(mode):
            mode_sum += amt

    return mode_sum, bill_amount

@dashboard_bp.route("/collection-breakdown", methods=["GET"])
@jwt_required()
def collection_breakdown():
    start_date = request.args.get("start_date") or date.today().isoformat()
    end_date = request.args.get("end_date") or date.today().isoformat()
    category = (request.args.get("category") or "op_billing").lower()
    mode = (request.args.get("mode") or "total").lower()

    if mode not in ("cash", "card", "upi", "bank", "total"):
        mode = "total"

    rows_out = []

    op_bills = query("""
        SELECT b.id, b.bill_no, b.patient_id, b.appointment_id,
               b.consultation_charge, b.lab_charge, b.procedure_charge,
               b.service_charge, b.pharmacy_charge, b.radiology_charge,
               b.paid_amount, b.due_amount, b.payment_mode, b.payment_split,
               b.status, b.created_at,
               p.patient_uid, p.name, p.phone, r.opd_reg_no
        FROM op_bills b
        JOIN patients p ON p.id = b.patient_id
        LEFT JOIN op_registrations r ON r.id = b.op_registration_id
        WHERE DATE(b.created_at) BETWEEN %s AND %s
          AND b.status <> 'Cancelled'
    """, (start_date, end_date), many=True)

    for b in op_bills:
        paid = float(b["paid_amount"] or 0)
        due = float(b["due_amount"] or 0)
        consult   = float(b["consultation_charge"] or 0)
        lab       = float(b["lab_charge"] or 0)
        radiology = float(b.get("radiology_charge") or 0)
        proc      = float(b["procedure_charge"] or 0)
        service   = float(b["service_charge"] or 0)

        if consult == 0 and lab == 0 and radiology == 0 and proc == 0 and service == 0:
            fallback = paid + due
            bn_u = (b.get("bill_no") or "").upper()
            if bn_u.startswith("OPR"):
                radiology = fallback
            elif bn_u.startswith("OPINV"):
                service = fallback
            else:
                consult = fallback

        bucket_name = _route_op_bill(b["bill_no"], consult, lab, radiology, proc, service)
        if not bucket_name or not _row_matches_category(bucket_name, category):
            continue

        amount, total_bill = _row_amount_for_mode(
            bucket_name, mode, consult, lab, radiology, proc, service,
            paid, due, b["payment_mode"], b["payment_split"],
        )

        if mode != "total" and amount <= 0:
            continue
        if mode == "total" and total_bill <= 0:
            continue

        cash_part = card_part = upi_part = bank_part = 0.0
        for m, amt in _iter_paid_splits(paid, b["payment_mode"], b["payment_split"]):
            k = _mode_key(m)
            if k == "cash":
                cash_part += amt
            elif k == "card":
                card_part += amt
            elif k == "upi":
                upi_part += amt
            else:
                bank_part += amt

        rows_out.append({
            "patient_reg_no": b.get("opd_reg_no") or b.get("patient_uid"),
            "name": b.get("name"),
            "phone": b.get("phone"),
            "cash": round(cash_part, 2),
            "card": round(card_part, 2),
            "upi": round(upi_part, 2),
            "bank": round(bank_part, 2),
            "total": round(total_bill, 2),
            "_mode_amount": round(amount, 2),
        })

    if category in ("ip_income", "ip_diagnostics", "ip_radiology"):
        ip_cols = {c["Field"] for c in query("SHOW COLUMNS FROM ip_bills", many=True)}
        mode_select = "payment_mode" if "payment_mode" in ip_cols else "'Cash' AS payment_mode"
        split_select = "payment_split" if "payment_split" in ip_cols else "NULL AS payment_split"

        ip_bills = query(f"""
            SELECT b.id, b.ip_registration_id, b.admission_charge, b.room_charge,
                   b.doctor_visit_charge, b.lab_charge, b.radiology_charge, b.ot_charge,
                   b.procedure_charge, b.medicine_charge, b.nursing_charge,
                   b.service_charge, b.food_charge, b.misc_charge,
                   b.paid_amount, b.due_amount, b.created_at,
                   {mode_select}, {split_select},
                   p.patient_uid, p.name, p.phone, r.ip_reg_no
            FROM ip_bills b
            JOIN ip_registrations r ON r.id = b.ip_registration_id
            JOIN patients p ON p.id = r.patient_id
            WHERE DATE(b.created_at) BETWEEN %s AND %s
              AND b.status <> 'Cancelled'
        """, (start_date, end_date), many=True)

        for b in ip_bills:
            paid = float(b["paid_amount"] or 0)
            due = float(b["due_amount"] or 0)
            lab = float(b["lab_charge"] or 0)
            radiology = float(b["radiology_charge"] or 0)
            other = (
                float(b["admission_charge"] or 0) + float(b["room_charge"] or 0)
                + float(b["doctor_visit_charge"] or 0) + float(b["ot_charge"] or 0)
                + float(b["procedure_charge"] or 0) + float(b["medicine_charge"] or 0)
                + float(b["nursing_charge"] or 0) + float(b["service_charge"] or 0)
                + float(b["food_charge"] or 0) + float(b["misc_charge"] or 0)
            )

            if category == "ip_income":
                bill_amount = other
            elif category == "ip_diagnostics":
                bill_amount = lab
            else:
                bill_amount = radiology

            if bill_amount <= 0:
                continue

            cash_part = card_part = upi_part = bank_part = 0.0
            for m, amt in _iter_paid_splits(paid, b["payment_mode"], b["payment_split"]):
                k = _mode_key(m)
                if k == "cash":
                    cash_part += amt
                elif k == "card":
                    card_part += amt
                elif k == "upi":
                    upi_part += amt
                else:
                    bank_part += amt

            if mode != "total":
                mode_sum = {"cash": cash_part, "card": card_part,
                            "upi": upi_part, "bank": bank_part}[mode]
                if mode_sum <= 0:
                    continue
                amount = mode_sum * (bill_amount / paid) if paid > 0 else 0
            else:
                amount = bill_amount

            rows_out.append({
                "patient_reg_no": b.get("ip_reg_no") or b.get("patient_uid"),
                "name": b.get("name"),
                "phone": b.get("phone"),
                "cash": round(cash_part, 2),
                "card": round(card_part, 2),
                "upi": round(upi_part, 2),
                "bank": round(bank_part, 2),
                "total": round(bill_amount, 2),
                "_mode_amount": round(amount, 2),
            })

    rows_out.sort(key=lambda r: -(r.get("_mode_amount") or 0))

    return jsonify({
        "category": category,
        "mode": mode,
        "range": {"start_date": start_date, "end_date": end_date},
        "count": len(rows_out),
        "total": round(sum(r["_mode_amount"] for r in rows_out), 2),
        "rows": rows_out,
    })