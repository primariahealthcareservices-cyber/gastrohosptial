from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from db import query
from utils import log_audit, role_required

billing_mgmt_bp = Blueprint("billing_management", __name__)

ACTION_TYPES = [
    "Consultation_Cancel", "Bill_Cancel", "Lab_Cancel", "Lab_Modify",
    "Service_Cancel", "Procedure_Cancel", "Surgery_Cancel",
    "Admission_Cancel", "Advance_Refund", "Advance_Adjustment", "Reprint"
]

# Categories accepted by the Collection Summary dashboard.
VALID_CATEGORIES = {
    "op_billing", "op_diagnostics", "op_radiology",
    "direct_patients", "direct_diagnostics", "direct_radiology",
    "ip_income", "ip_diagnostics", "ip_radiology",
}

VALID_MODES = {"Cash", "Card", "UPI", "Bank"}


def resolve_bill(bill_type, bill_no_or_id):
    """
    Accepts either the human-facing bill number (e.g. 'OPB-000002')
    or a raw numeric id, and returns the actual integer id of the row
    in op_bills / ip_bills. Returns None if not found.
    """
    table = "op_bills" if bill_type == "OP" else "ip_bills"
    raw = str(bill_no_or_id).strip()

    if raw.isdigit():
        row = query(f"SELECT id FROM {table} WHERE id=%s", (int(raw),))
    else:
        row = query(f"SELECT id FROM {table} WHERE bill_no=%s", (raw,))

    return row["id"] if row else None


def _derive_category(bill_type, resolved_id, sent_category):
    """
    Best-effort category for a refund. Order of preference:
      1. Client-provided category (if it's one we recognise)
      2. Derive from op_bills.bill_no prefix (OP bills only)
      3. Fall back to a coarse default by bill_type
    """
    if sent_category in VALID_CATEGORIES:
        return sent_category

    if bill_type == "OP":
        row = query(
            "SELECT bill_no, consultation_charge, lab_charge, procedure_charge, "
            "service_charge, radiology_charge "
            "FROM op_bills WHERE id=%s",
            (resolved_id,),
        )
        if row:
            bn = (row.get("bill_no") or "").upper()
            consult   = float(row.get("consultation_charge") or 0)
            lab       = float(row.get("lab_charge") or 0)
            radiology = float(row.get("radiology_charge") or 0)
            proc      = float(row.get("procedure_charge") or 0)
            service   = float(row.get("service_charge") or 0)

            if bn.startswith("OPR"):
                return "op_radiology"
            if bn.startswith(("OPINV", "OPDINV", "OPIN")):
                return "op_diagnostics"
            if bn.startswith("IPD"):
                return "ip_diagnostics"
            if bn.startswith("IPR"):
                return "ip_radiology"
            if lab > 0 and consult == 0 and radiology == 0 and proc == 0 and service == 0:
                return "direct_diagnostics"
            if consult > 0 and lab == 0 and radiology == 0 and proc == 0 and service == 0:
                return "op_billing"
            if radiology > 0:
                return "op_radiology"
            if lab > 0 or service > 0 or proc > 0:
                return "op_diagnostics"
        return "op_billing"

    # IP bill — without line-level info we default to ip_income.
    return "ip_income"


@billing_mgmt_bp.route("/actions", methods=["POST"])
@jwt_required()
@role_required("admin", "super_admin")
def create_action():
    d = request.get_json() or {}
    bill_type    = d.get("bill_type")
    bill_ref     = d.get("bill_id")           # can be bill_no ("OPB-000002") or numeric id
    action_type  = d.get("action_type")
    reason       = d.get("reason")
    amount       = d.get("amount", 0)
    sent_category = d.get("category")
    payment_mode = d.get("payment_mode") or "Cash"

    if bill_type not in ["OP", "IP"] or action_type not in ACTION_TYPES:
        return jsonify({"error": "invalid bill_type or action_type"}), 400
    if not bill_ref:
        return jsonify({"error": "bill_id (or bill number) is required"}), 400
    if not reason:
        return jsonify({"error": "reason is required for audit purposes"}), 400

    # Refunds must carry a positive amount
    if action_type == "Advance_Refund":
        try:
            amt_val = float(amount or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "amount must be numeric"}), 400
        if amt_val <= 0:
            return jsonify({"error": "amount is required and must be > 0 for refunds"}), 400
        if payment_mode not in VALID_MODES:
            payment_mode = "Cash"

    resolved_id = resolve_bill(bill_type, bill_ref)
    if resolved_id is None:
        return jsonify({"error": f"No {bill_type} bill found matching '{bill_ref}'"}), 404

    user_id = get_jwt_identity()

    # Detect which optional columns exist so this works pre/post migration
    ba_cols = {c["Field"] for c in query("SHOW COLUMNS FROM billing_actions", many=True)}
    has_cat_col  = "category" in ba_cols
    has_mode_col = "payment_mode" in ba_cols

    cols = ["bill_type", "bill_id"]
    vals = [bill_type, resolved_id]

    if has_cat_col:
        cols.append("category")
        vals.append(_derive_category(bill_type, resolved_id, sent_category))
    if has_mode_col:
        cols.append("payment_mode")
        vals.append(payment_mode)

    cols.extend(["action_type", "amount", "reason", "performed_by", "approved_by"])
    vals.extend([action_type, amount, reason, user_id, user_id])

    placeholders = ",".join(["%s"] * len(cols))
    action_id = query(
        f"INSERT INTO billing_actions ({','.join(cols)}) VALUES ({placeholders})",
        tuple(vals), fetch=False, commit=True
    )

    table = "op_bills" if bill_type == "OP" else "ip_bills"
    if action_type in ("Bill_Cancel", "Consultation_Cancel"):
        query(f"UPDATE {table} SET status='Cancelled' WHERE id=%s",
              (resolved_id,), fetch=False, commit=True)

    log_audit(user_id, action_type, "Billing Management", resolved_id, reason)
    return jsonify(query("SELECT * FROM billing_actions WHERE id=%s", (action_id,))), 201


@billing_mgmt_bp.route("/actions", methods=["GET"])
@jwt_required()
def list_actions():
    bill_type = request.args.get("bill_type")
    sql = """SELECT ba.*, u.name AS performed_by_name FROM billing_actions ba
              LEFT JOIN users u ON u.id=ba.performed_by WHERE 1=1"""
    params = []
    if bill_type:
        sql += " AND ba.bill_type=%s"
        params.append(bill_type)
    sql += " ORDER BY ba.id DESC"
    return jsonify(query(sql, tuple(params), many=True))


@billing_mgmt_bp.route("/reprint/<string:bill_type>/<string:bill_ref>", methods=["GET"])
@jwt_required()
def reprint(bill_type, bill_ref):
    bt = bill_type.upper()
    resolved_id = resolve_bill(bt, bill_ref)
    if resolved_id is None:
        return jsonify({"error": "Bill not found"}), 404

    table = "op_bills" if bt == "OP" else "ip_bills"
    bill = query(f"SELECT * FROM {table} WHERE id=%s", (resolved_id,))
    log_audit(get_jwt_identity(), "Reprint", "Billing Management", resolved_id)
    return jsonify(bill)