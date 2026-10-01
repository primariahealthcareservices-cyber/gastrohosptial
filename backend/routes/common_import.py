import re
import json
import pandas as pd
from datetime import datetime

TITLE_RE = re.compile(r"^(Mr\.|Mrs\.|Miss\.|Ms\.|Dr\.|Master\.)\s*", re.IGNORECASE)

REFERRAL_MAP = {
    "walk-in": "Walkin", "walkin": "Walkin", "online": "Online", "doctor": "Doctor",
    "hospital user": "Hospital User", "camp": "Camp", "ads": "Ads",
    "friend/family": "Friend/Family", "marketing": "Marketing",
}


def clean_str(val):
    """Return a clean string or None — handles NaN, empty strings, whitespace."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s if s else None


def to_decimal(val):
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return 0
        return float(val)
    except (ValueError, TypeError):
        return 0


def parse_date_flex(val):
    s = clean_str(val)
    if not s:
        return None
    formats = ["%d/%m/%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y %H:%M"]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return pd.to_datetime(s, dayfirst=True, errors="raise").to_pydatetime()
    except Exception:
        return None


def parse_age(val):
    """Handles both '55Y' style and plain '55/Male' combined style."""
    s = clean_str(val)
    if not s:
        return None
    m = re.search(r"(\d+)", s)
    return int(m.group(1)) if m else None


def parse_age_gender_combined(val):
    """For files where Age/Gender come combined like '70Y / Female'."""
    s = clean_str(val)
    if not s:
        return None, None
    parts = s.split("/")
    age = parse_age(parts[0]) if parts else None
    gender = None
    if len(parts) >= 2:
        g = parts[1].strip().lower()
        gender = "Male" if g.startswith("m") else "Female" if g.startswith("f") else "Other"
    return age, gender


def split_name(raw_name):
    s = clean_str(raw_name)
    if not s:
        return None, "Unknown"
    m = TITLE_RE.match(s)
    title = m.group(1).rstrip(".") if m else None
    rest = TITLE_RE.sub("", s).strip()
    rest = re.sub(r"\s+", " ", rest)
    return title, rest or "Unknown"


def normalize_gender(val):
    s = clean_str(val)
    if not s:
        return "Other"
    s = s.lower()
    return "Male" if s.startswith("m") else "Female" if s.startswith("f") else "Other"


def normalize_referral(val):
    s = clean_str(val)
    if not s:
        return "Walkin"
    return REFERRAL_MAP.get(s.lower(), "Other")


def normalize_payment_mode(val, allowed):
    """Maps free-text pay-mode strings (e.g. 'UPI - PhonePe') to a fixed enum set."""
    s = clean_str(val)
    if not s:
        return "Cash"
    token = s.split("-")[0].strip().lower()
    for opt in allowed:
        if opt.lower() == token:
            return opt
    for opt in allowed:
        if opt.lower() in s.lower():
            return opt
    return "Cash"


def get_or_create_doctor(cur, name):
    if not clean_str(name):
        return None
    _, clean_name = split_name(name)
    cur.execute("SELECT id FROM doctors WHERE name = %s", (clean_name,))
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute("INSERT INTO doctors (name) VALUES (%s)", (clean_name,))
    return cur.lastrowid


def get_or_create_patient(cur, mr_number, patient_name, phone, gender, dob, age):
    cur.execute("SELECT id FROM patients WHERE patient_uid = %s", (mr_number,))
    row = cur.fetchone()
    if row:
        return row["id"]
    _, clean_name = split_name(patient_name)
    cur.execute("""
        INSERT INTO patients (patient_uid, reg_no, name, gender, dob, age, phone, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
    """, (mr_number, mr_number, clean_name, gender or "Other", dob, age,
          clean_str(phone) or "0000000000"))
    return cur.lastrowid


def get_or_create_op_registration(cur, patient_id, doctor_id, opd_reg_no, title, first_name,
                                   gender, dob, mobile, area, referral_type, referral_doctor_name,
                                   mlc, mlc_number, appt_date):
    cur.execute("SELECT id FROM op_registrations WHERE opd_reg_no = %s", (opd_reg_no,))
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute("""
        INSERT INTO op_registrations
        (patient_id, opd_reg_no, token_no, title, first_name, gender, dob, mobile,
         area, doctor_id, referral_type, referral_doctor_name, mlc, mlc_number,
         appointment_date, status)
        VALUES (%s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Completed')
    """, (patient_id, opd_reg_no, title, first_name, gender or "Other", dob,
          clean_str(mobile) or "0000000000", clean_str(area), doctor_id, referral_type,
          referral_doctor_name, mlc, clean_str(mlc_number), appt_date))
    return cur.lastrowid


def get_user_id_by_name(cur, name, default_id=None):
    """
    Look up an existing user by name — never auto-creates login accounts.
    Case-insensitive, whitespace-trimmed. Returns `default_id` if the name
    doesn't match anything (or is blank).
    """
    n = clean_str(name)
    if not n:
        return default_id

    cur.execute(
        "SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s)) LIMIT 1",
        (n,),
    )
    row = cur.fetchone()
    return row["id"] if row else default_id


def safe_json_dump(row_dict):
    """Serialize a row to JSON safely for storage in a MySQL JSON column."""
    def _clean(v):
        if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
            return None
        return v

    try:
        cleaned = {k: _clean(v) for k, v in row_dict.items()}
        return json.dumps(cleaned, default=str, allow_nan=False)
    except Exception:
        return json.dumps({"error": "could not serialize row"})


# ---------------------------------------------------------------------------
# REFUND HELPERS (bulk-import)
# ---------------------------------------------------------------------------

VALID_REFUND_CATEGORIES = {
    "op_billing", "op_diagnostics", "op_radiology",
    "direct_patients", "direct_diagnostics", "direct_radiology",
    "ip_income", "ip_diagnostics", "ip_radiology",
}

# Now includes Insurance as a first-class mode.
VALID_REFUND_MODES = {"Cash", "Card", "UPI", "Bank", "Insurance"}


def normalize_refund_mode(pay_mode):
    """
    Normalize any free-text pay mode to one of:
        Cash / Card / UPI / Bank / Insurance

    Tolerant of variants like 'UPI - PhonePe', 'UPI/GPay', 'PhonePe',
    'Insurance', 'Mediclaim', 'TPA', etc.
    """
    m = (clean_str(pay_mode) or "").lower()

    if not m:
        return "Cash"

    # --- exact matches first ---
    if m == "cash":
        return "Cash"
    if m == "card":
        return "Card"
    if m == "upi":
        return "UPI"
    if m == "bank":
        return "Bank"
    if m == "insurance":
        return "Insurance"

    # --- Insurance variants (checked before Card, since "insurance card" would match both) ---
    if (
        "insurance" in m
        or "mediclaim" in m
        or "mediclaim" in m
        or "tpa" in m
        or "tpa_" in m
        or "cashless" in m
        or "reimburs" in m
        or "esic" in m
        or "cghs" in m
        or "star health" in m
        or "hdfc ergo" in m
        or "icici lombard" in m
        or "bajaj allianz" in m
        or "new india" in m
        or "national insurance" in m
        or "oriental insurance" in m
        or "united india" in m
        or "reliance general" in m
        or "tata aig" in m
        or "sbi general" in m
        or "care health" in m
        or "niva bupa" in m
    ):
        return "Insurance"

    # --- UPI variants ---
    if (
        "upi" in m
        or "phonepe" in m or "phone pe" in m or "phone-pe" in m
        or "gpay" in m or "g pay" in m or "google pay" in m or "googlepay" in m
        or "paytm" in m
        or "bhim" in m
        or "amazon pay" in m or "amazonpay" in m
        or "whatsapp pay" in m
        or "mobikwik" in m or "freecharge" in m
    ):
        return "UPI"

    # --- Card variants ---
    if (
        "card" in m
        or "credit" in m or "debit" in m
        or "visa" in m or "master" in m or "mastercard" in m
        or "rupay" in m or "maestro" in m or "amex" in m
    ):
        return "Card"

    # --- Bank transfer variants ---
    if (
        "bank" in m
        or "neft" in m or "rtgs" in m or "imps" in m
        or "cheque" in m or "check" in m
        or "transfer" in m
    ):
        return "Bank"

    return "Cash"


def _resolve_bill_id(cur, bill_type, bill_no):
    """
    Resolve an invoice number to its bill_id.
    Looks in op_bills AND ip_bills, using the prefix as a hint but
    falling back to the other table if the prefix hint doesn't match.
    Returns the integer id or None.
    """
    if not clean_str(bill_no):
        return None

    bn = str(bill_no).strip()
    bn_upper = bn.upper()

    is_ip_prefix = bn_upper.startswith(("IPDINV", "IPRINV", "IPINV", "IPD", "IPR"))

    if is_ip_prefix:
        cur.execute("SELECT id FROM ip_bills WHERE bill_no=%s", (bn,))
        row = cur.fetchone()
        if row:
            return row["id"]
        # Fall back to op_bills (some data stores IP invoices here)
        cur.execute("SELECT id FROM op_bills WHERE bill_no=%s", (bn,))
        row = cur.fetchone()
        return row["id"] if row else None

    # Non-IP prefix: try op_bills first, then ip_bills
    cur.execute("SELECT id FROM op_bills WHERE bill_no=%s", (bn,))
    row = cur.fetchone()
    if row:
        return row["id"]

    cur.execute("SELECT id FROM ip_bills WHERE bill_no=%s", (bn,))
    row = cur.fetchone()
    return row["id"] if row else None


def record_refund_from_row(cur, *,
                            bill_type,
                            bill_no,
                            category,
                            amount,
                            pay_mode,
                            request_reason,
                            approved_reason,
                            performed_by,
                            bill_date):
    """
    Insert an Advance_Refund row into billing_actions.

    Idempotency: if the bill already has an Advance_Refund row, we return
    the existing row's id without inserting a duplicate.
    """
    req  = clean_str(request_reason)
    appr = clean_str(approved_reason)

    if not req and not appr:
        return None

    bill_id = _resolve_bill_id(cur, bill_type, bill_no)
    if bill_id is None:
        return None

    # ── Idempotency: skip if this bill already has a refund ──
    cur.execute("""
        SELECT id FROM billing_actions
        WHERE action_type = 'Advance_Refund' AND bill_id = %s
        LIMIT 1
    """, (bill_id,))
    existing = cur.fetchone()
    if existing:
        return existing["id"]

    if category not in VALID_REFUND_CATEGORIES:
        category = "ip_income" if bill_type == "IP" else "op_billing"

    amt = to_decimal(amount)
    if amt < 0:
        amt = 0

    mode = normalize_refund_mode(pay_mode)
    combined_reason = appr or req
    when = bill_date or datetime.utcnow()

    cur.execute("""
        INSERT INTO billing_actions
            (bill_type, bill_id, category, action_type, amount, payment_mode,
             reason, request_reason, approved_reason,
             performed_by, approved_by, created_at)
        VALUES (%s, %s, %s, 'Advance_Refund', %s, %s,
                %s, %s, %s,
                %s, %s, %s)
    """, (
        bill_type, bill_id, category, amt, mode,
        combined_reason, req, appr,
        performed_by, performed_by, when,
    ))
    return cur.lastrowid