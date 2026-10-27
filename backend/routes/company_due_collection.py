# backend/routes/company_due_collection.py

from flask import Blueprint, request, jsonify
from datetime import datetime

# Uncomment when ready to use DB:
# from db import query

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------
company_due_collection_bp = Blueprint(
    'company_due_collection',
    __name__,
    url_prefix='/company-due-collection'
)

# ---------------------------------------------------------------------------
# SQL (edit column/table names once you confirm your schema)
# ---------------------------------------------------------------------------
COMPANY_DUE_SQL = """
    SELECT
        p.patient_regno,
        p.patient_name,
        p.phone,
        c.company_name,
        b.bill_id,
        b.bill_date,
        b.total_amount                                   AS total,
        COALESCE(SUM(pay.amount), 0)                     AS paid,
        (b.total_amount - COALESCE(SUM(pay.amount), 0))  AS due,
        CASE
            WHEN COALESCE(SUM(pay.amount), 0) = 0
                THEN 'Pending'
            WHEN COALESCE(SUM(pay.amount), 0) < b.total_amount
                THEN 'Partial'
            ELSE 'Paid'
        END                                              AS payment_status
    FROM bills b
    JOIN patients  p   ON p.patient_regno = b.patient_regno
    LEFT JOIN companies c   ON c.company_id  = p.company_id
    LEFT JOIN payments  pay ON pay.bill_id   = b.bill_id
    WHERE b.bill_date BETWEEN %s AND %s
      AND (%s = 'All' OR c.company_name = %s)
    GROUP BY b.bill_id, p.patient_regno, p.patient_name,
             p.phone, c.company_name, b.bill_date, b.total_amount
    HAVING (b.total_amount - COALESCE(SUM(pay.amount), 0)) > 0
    ORDER BY b.bill_date DESC, p.patient_regno;
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _validate_dates(start_date, end_date):
    """Return (ok, error_message). Accepts YYYY-MM-DD."""
    if not start_date or not end_date:
        return False, "start_date and end_date are required (YYYY-MM-DD)"
    try:
        s = datetime.strptime(start_date, "%Y-%m-%d").date()
        e = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        return False, "Dates must be in YYYY-MM-DD format"
    if s > e:
        return False, "start_date cannot be after end_date"
    return True, None


def _fmt_amount(v):
    try:
        return f"{float(v):.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _row_to_dict(r):
    """Normalize a DB row (dict or tuple) into the JSON shape the UI expects."""
    # If your `query()` returns dicts (DictCursor), r is already a dict.
    # If it returns tuples, adapt here — see TUPLE_COLUMNS below.
    return {
        "patient_regno":  r["patient_regno"],
        "patient_name":   r["patient_name"],
        "phone":          r["phone"],
        "company_name":   r.get("company_name") if isinstance(r, dict) else None,
        "bill_id":        r.get("bill_id")      if isinstance(r, dict) else None,
        "bill_date":      (r["bill_date"].strftime("%Y-%m-%d")
                           if isinstance(r, dict) and r.get("bill_date")
                           else None),
        "total":          _fmt_amount(r["total"]),
        "paid":           _fmt_amount(r["paid"]),
        "due":            _fmt_amount(r["due"]),
        "payment_status": r["payment_status"],
    }


def _build_summary(data):
    """Compute footer totals from the normalized data list."""
    return {
        "total_amount": _fmt_amount(sum(float(d["total"]) for d in data)),
        "total_paid":   _fmt_amount(sum(float(d["paid"])  for d in data)),
        "total_due":    _fmt_amount(sum(float(d["due"])   for d in data)),
        "row_count":    len(data),
    }


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@company_due_collection_bp.route('/', methods=['GET'])
def get_company_dues():
    try:
        start_date   = request.args.get('start_date')
        end_date     = request.args.get('end_date')
        company_name = request.args.get('company_name', 'All').strip() or 'All'

        ok, err = _validate_dates(start_date, end_date)
        if not ok:
            return jsonify({"error": err}), 400

        # -------------------------------------------------------------------
        # REAL DB QUERY — enable once schema is confirmed.
        # Until then, `rows` stays empty so the endpoint returns an empty
        # dataset (no hardcoded records).
        # -------------------------------------------------------------------
        rows = []
        # rows = query(
        #     COMPANY_DUE_SQL,
        #     (start_date, end_date, company_name, company_name)
        # )

        data    = [_row_to_dict(r) for r in rows]
        summary = _build_summary(data)

        return jsonify({
            "data": data,
            "summary": summary,
            "message": (
                "Company due collection fetched successfully"
                if rows else
                "No company dues found for the selected period"
            )
        }), 200

    except Exception as e:
        # Log the real error server-side; return a clean message
        print(f"[company_due_collection] ERROR: {e}")
        return jsonify({"error": str(e)}), 500