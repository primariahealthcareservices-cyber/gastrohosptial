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
# Portal's "Hospital Collection" taxonomy, as confirmed against April 2025:
#
#   OP Billing         → INV*  / consultation_charge > 0
#   OP Diagnostics     → OPInv* / service_charge > 0
#   OP Radiology       → OPRInv* / service_charge > 0
#   Direct Diagnostics → OPInv* / lab_charge > 0 AND everything else = 0
#   Direct Radiology   → OPRInv* / radiology_charge > 0
#   IP Diagnostics     → IPDInv* / lab_charge > 0  (stored in op_bills)
#   IP Radiology       → IPRInv* / radiology_charge > 0
#   Direct Patients    → walk-in consultation without appointment (rare)
#
# The charge signature is what splits OP Diagnostics from Direct Diagnostics:
# both use the OPInv prefix, but OP Diagnostics carries service_charge and
# Direct Diagnostics carries only lab_charge.

def _route_op_bill(bill_no, consult, lab, radiology, proc, service):
    """
    Return one of:
      'op_billing' | 'op_diagnostics' | 'op_radiology'
      'direct_patients' | 'direct_diagnostics' | 'direct_radiology'
      'ip_diagnostics' | 'ip_radiology' | None
    """
    bn = (bill_no or "").upper()

    # --- IP module: prefix is authoritative ---
    if bn.startswith("IPD"):
        return "ip_diagnostics"
    if bn.startswith("IPR"):
        return "ip_radiology"

    # --- Direct Diagnostics: lab-only, no other charges, non-IP bill ---
    # Check this BEFORE the prefix branches because lab-only rows can
    # appear under OPInv invoice numbers (14 such rows in April 2025).
    if (lab > 0
            and consult == 0
            and radiology == 0
            and proc == 0
            and service == 0):
        return "direct_diagnostics"

    # --- OP Radiology module (OPRInv prefix) ---
    if bn.startswith("OPR"):
        # radiology_charge = Direct Radiology
        # service_charge   = OP Radiology
        if radiology > 0 and service == 0 and lab == 0:
            return "direct_radiology"
        if service > 0:
            return "op_radiology"
        return "op_radiology"

    # --- OP Diagnostics module (OPInv prefix) ---
    if bn.startswith("OPINV") or bn.startswith("OPDINV") or bn.startswith("OPIN"):
        if service > 0:
            return "op_diagnostics"
        if radiology > 0:
            return "op_radiology"
        if lab > 0:
            return "op_diagnostics"
        return "op_diagnostics"

    # --- Consultation / Registration module (INV prefix) ---
    if bn.startswith("INV"):
        return "op_billing"

    # --- Fallback by charge column ---
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

    # ----- OP bills --------------------------------------------------------
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

        # Legacy fallback: bulk imports sometimes dump the amount into
        # consultation_charge when nothing else is populated.
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
            bucket_map = {
                "lab": op_diagnostics,
                "service": op_diagnostics,
                "proc": op_diagnostics,
            }

        elif bucket_name == "op_radiology":
            # OPRInv rows carry the amount in service_charge, not radiology_charge.
            parts = {"radiology": service or radiology}
            bucket_map = {"radiology": op_radiology}

        elif bucket_name == "direct_patients":
            parts = {"consult": consult}
            bucket_map = {"consult": direct_patients}

        elif bucket_name == "direct_diagnostics":
            parts = {"lab": lab, "service": service, "proc": proc}
            bucket_map = {
                "lab": direct_diagnostics,
                "service": direct_diagnostics,
                "proc": direct_diagnostics,
            }

        elif bucket_name == "direct_radiology":
            parts = {"radiology": radiology}
            bucket_map = {"radiology": direct_radiology}

        elif bucket_name == "ip_diagnostics":
            parts = {"lab": lab, "service": service, "proc": proc}
            bucket_map = {
                "lab": ip_diagnostics,
                "service": ip_diagnostics,
                "proc": ip_diagnostics,
            }

        elif bucket_name == "ip_radiology":
            parts = {"radiology": radiology}
            bucket_map = {"radiology": ip_radiology}

        else:
            continue

        _distribute(paid, mode, split, parts, bucket_map)

        # Due tracking
        total_parts = sum(parts.values()) or 0
        if due and total_parts > 0:
            if bucket_name in ("op_radiology", "direct_radiology", "ip_radiology"):
                op_due_lab_radiology += due
            elif bucket_name.startswith("ip_"):
                ip_due_lab_radiology += due
            else:
                op_due_direct += due

    # ----- IP bills --------------------------------------------------------
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
        bucket_map = {
            "other": ip_income,
            "lab": ip_diagnostics,
            "radiology": ip_radiology,
        }
        _distribute(paid, mode, split, parts, bucket_map)

        total_parts = sum(parts.values()) or 1
        if due:
            ip_due_bill += due * (other / total_parts)
            ip_due_lab_radiology += due * ((lab + radiology) / total_parts)

    # ----- Refunds ---------------------------------------------------------
    refunds = query("""
        SELECT bill_type, IFNULL(SUM(amount),0) s
        FROM billing_actions
        WHERE action_type='Advance_Refund'
          AND DATE(created_at) BETWEEN %s AND %s
        GROUP BY bill_type
    """, (start_date, end_date), many=True)
    refund_map = {r["bill_type"]: float(r["s"]) for r in refunds}

    # ----- Totals ----------------------------------------------------------
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