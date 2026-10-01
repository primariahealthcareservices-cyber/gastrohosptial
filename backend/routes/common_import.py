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
    # loose contains-match fallback (e.g. "upi" in "upi - phonepe")
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


def get_user_id_by_name(cur, name):
    """Looks up an existing user by name — never auto-creates login accounts."""
    n = clean_str(name)
    if not n:
        return None
    cur.execute("SELECT id FROM users WHERE name = %s", (n,))
    row = cur.fetchone()
    return row["id"] if row else None


def safe_json_dump(row_dict):
    """Serialize a row to JSON safely for storage in a MySQL JSON column.

    pandas represents blank/missing CSV cells as float('nan'). Python's
    json.dumps() allows NaN/Infinity by default and writes them as bare
    tokens (NaN, Infinity, -Infinity) — which is NOT valid JSON per spec,
    and MySQL's native JSON column type rejects it with:
        Invalid JSON text: "Invalid value."
    That failure used to happen *inside* the except block that logs
    import errors, with nothing catching it — killing the whole import
    thread. This version converts NaN/inf floats to None (-> JSON null)
    before dumping, and sets allow_nan=False as a belt-and-braces check
    so any leftover non-finite float raises immediately and falls into
    the fallback branch instead of producing invalid JSON.
    """
    def _clean(v):
        if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
            return None  # NaN / inf / -inf -> null, which is valid JSON
        return v

    try:
        cleaned = {k: _clean(v) for k, v in row_dict.items()}
        return json.dumps(cleaned, default=str, allow_nan=False)
    except Exception:
        return json.dumps({"error": "could not serialize row"})
# ---------------------------------------------------------------------------
# REFUND HELPERS (bulk-import)
# ---------------------------------------------------------------------------
# These helpers let any import service record an Advance_Refund row when the
# CSV row carries refund reasons (either "Refund Request Reason",
# "Refund Approved Reason", or both).

VALID_REFUND_CATEGORIES = {
    "op_billing", "op_diagnostics", "op_radiology",
    "direct_patients", "direct_diagnostics", "direct_radiology",
    "ip_income", "ip_diagnostics", "ip_radiology",
}

VALID_REFUND_MODES = {"Cash", "Card", "UPI", "Bank"}

def normalize_refund_mode(pay_mode):
    """
    Normalize any free-text pay mode to one of: Cash / Card / UPI / Bank.

    Tolerant of real-world variants:
      UPI, upi, UPI - PhonePe, UPI/GPay, PhonePe, GPay, Google Pay,
      Paytm, BHIM, Card, Credit Card, Debit Card, Visa, RuPay, Bank,
      NEFT, RTGS, IMPS, Cheque, Cash, etc.
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

    # --- Cash fallback ---
    return "Cash"

def _resolve_bill_id(cur, bill_type, bill_no):
    """bill_no -> op_bills.id / ip_bills.id. Returns None if not found."""
    if not clean_str(bill_no):
        return None
    table = "op_bills" if bill_type == "OP" else "ip_bills"
    cur.execute(f"SELECT id FROM {table} WHERE bill_no=%s", (bill_no,))
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
    Insert an Advance_Refund row into billing_actions if the row carries
    refund reasons. Returns the new action id, or None if there's nothing
    to record.

      bill_type        : 'OP' or 'IP'
      bill_no          : invoice number (used to resolve bill_id)
      category         : one of VALID_REFUND_CATEGORIES
      amount           : numeric (>= 0)
      pay_mode         : Cash / Card / UPI / Bank
      request_reason   : text or None
      approved_reason  : text or None
      performed_by     : user id (int) or None
      bill_date        : datetime for created_at
    """
    req  = clean_str(request_reason)
    appr = clean_str(approved_reason)

    if not req and not appr:
        return None

    bill_id = _resolve_bill_id(cur, bill_type, bill_no)
    if bill_id is None:
        # The bill hasn't been written yet or the invoice number doesn't
        # match anything. Skip silently — never break the row import.
        return None

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