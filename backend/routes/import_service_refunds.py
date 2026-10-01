import re
import threading
import pandas as pd
from db import get_db
from routes.common_import import (
    clean_str, to_decimal, parse_date_flex, get_user_id_by_name,
    safe_json_dump, record_refund_from_row, VALID_REFUND_CATEGORIES,
)

# Your refunds-only export header → internal keys.
# These keys MUST match your CSV header character-for-character.
COLUMN_MAP = {
    "MR Number":               "mr_number",
    "Patient RegNo":           "patient_reg_no",
    "Patient Name":            "patient_name",
    "Patient PhoneNo":         "patient_phone",
    "Gender/Age":              "gender_age",
    "Invoice Number":          "invoice_no",
    "Amount":                  "refund_amount",
    "Paymode":                 "pay_mode",
    "Created At":              "refund_date",
    "Created By":              "created_by_name",
    "Refund Request Reason":   "refund_request_reason",
    "Refund Approved Reason":  "refund_approved_reason",
}

_DATE_LIKE_RE = re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|^\d{4}-\d{2}-\d{2}")


def _looks_like_date(v):
    if v is None:
        return False
    return bool(_DATE_LIKE_RE.match(str(v).strip()))


def _strip_junk_rows(df, date_col="Created At"):
    """Drop rows where Created At isn't a real date (totals, headers, blanks)."""
    if date_col not in df.columns:
        return df, 0
    before = len(df)
    mask = df[date_col].apply(_looks_like_date)
    return df[mask], before - len(df[mask])


def _resolve_bill_id(cur, invoice_no):
    """
    Invoice Number -> (bill_id, bill_type).
    Returns (None, None) if the invoice doesn't exist in op_bills or ip_bills.
    """
    if not invoice_no:
        return None, None
    bn = str(invoice_no).strip()

    cur.execute("SELECT id FROM op_bills WHERE bill_no=%s", (bn,))
    row = cur.fetchone()
    if row:
        return row["id"], "OP"

    cur.execute("SELECT id FROM ip_bills WHERE bill_no=%s", (bn,))
    row = cur.fetchone()
    if row:
        return row["id"], "IP"

    return None, None


def _auto_category(cur, invoice_no, bill_id, bill_type):
    """
    Decide the dashboard card for a refund.

    Order of decision:
      1. IP bills — prefix decides:
           IPD*  -> ip_diagnostics
           IPR*  -> ip_radiology
           else  -> ip_income
      2. OP bills with unambiguous prefix:
           OPR*  -> op_radiology
           OPInv*/OPDInv*/OPIN* -> op_diagnostics
      3. INV* / unknown prefix — inspect the underlying bill's charge mix
         to decide between:
           - direct_radiology    (radiology-only)
           - direct_diagnostics  (lab/service/procedure-only)
           - direct_patients     (consultation-only)
    """
    bn = (invoice_no or "").upper()

    # --- 1. IP bills ---
    if bill_type == "IP":
        if bn.startswith("IPD"):
            return "ip_diagnostics"
        if bn.startswith("IPR"):
            return "ip_radiology"
        return "ip_income"

    # --- 2. OP bills with unambiguous prefixes ---
    if bn.startswith("OPR"):
        return "op_radiology"
    if bn.startswith(("OPINV", "OPDINV", "OPIN")):
        return "op_diagnostics"

    # --- 3. INV* / unknown — inspect the linked bill's charges ---
    cur.execute("""
        SELECT consultation_charge, lab_charge, radiology_charge,
               procedure_charge, service_charge
        FROM op_bills WHERE id=%s
    """, (bill_id,))
    row = cur.fetchone() or {}

    consult   = float(row.get("consultation_charge") or 0)
    lab       = float(row.get("lab_charge") or 0)
    radiology = float(row.get("radiology_charge") or 0)
    proc      = float(row.get("procedure_charge") or 0)
    service   = float(row.get("service_charge") or 0)

    # Pure radiology → direct radiology
    if radiology > 0 and lab == 0 and proc == 0 and service == 0 and consult == 0:
        return "direct_radiology"

    # Pure lab / procedure / service → direct diagnostics
    if (lab > 0 or proc > 0 or service > 0) and consult == 0 and radiology == 0:
        return "direct_diagnostics"

    # Pure consultation → direct patients
    if consult > 0 and lab == 0 and radiology == 0 and proc == 0 and service == 0:
        return "direct_patients"

    # Mixed charges — prefer radiology > diagnostics > patients
    if radiology > 0:
        return "direct_radiology"
    if lab > 0 or proc > 0 or service > 0:
        return "direct_diagnostics"
    if consult > 0:
        return "direct_patients"

    # Nothing on the bill — default to diagnostics
    return "direct_diagnostics"


def process_refunds_batch(batch_id, filepath):
    conn = get_db()
    cur = conn.cursor(dictionary=True, buffered=True)

    try:
        cur.execute("UPDATE import_batches SET status='Processing' WHERE id=%s", (batch_id,))
        conn.commit()

        df = pd.read_csv(filepath, dtype=str, encoding="utf-8-sig") \
            if filepath.lower().endswith(".csv") \
            else pd.read_excel(filepath, dtype=str)

        # Strip junk rows using the raw "Created At" column
        df, skipped_junk_rows = _strip_junk_rows(df, date_col="Created At")

        df = df.rename(columns=COLUMN_MAP)
        df = df.where(pd.notnull(df), None)
        df = df.reset_index(drop=True)

        total_rows = len(df)
        cur.execute(
            "UPDATE import_batches SET total_rows=%s, failed_rows=%s WHERE id=%s",
            (total_rows, skipped_junk_rows, batch_id),
        )
        conn.commit()

        inserted = failed = processed = 0

        for idx, row in df.iterrows():
            row_num = int(idx) + 2
            try:
                invoice_no = clean_str(row.get("invoice_no"))
                if not invoice_no:
                    raise ValueError("Missing Invoice Number")

                bill_id, bill_type = _resolve_bill_id(cur, invoice_no)
                if bill_id is None:
                    raise ValueError(
                        f"No bill found for invoice '{invoice_no}' "
                        f"(import the bills first, then the refunds)"
                    )

                refund_date = parse_date_flex(row.get("refund_date"))
                performed_by = get_user_id_by_name(cur, row.get("created_by_name"))

                # Inspect the bill's charges to route to the correct dashboard card
                category = _auto_category(cur, invoice_no, bill_id, bill_type)

                action_id = record_refund_from_row(
                    cur,
                    bill_type=bill_type,
                    bill_no=invoice_no,
                    category=category,
                    amount=to_decimal(row.get("refund_amount")),
                    pay_mode=row.get("pay_mode"),
                    request_reason=row.get("refund_request_reason"),
                    approved_reason=row.get("refund_approved_reason"),
                    performed_by=performed_by,
                    bill_date=refund_date,
                )

                if action_id is None:
                    raise ValueError(
                        "No refund reason provided (need at least one of "
                        "Refund Request Reason / Refund Approved Reason)"
                    )

                conn.commit()
                inserted += 1

            except Exception as e:
                conn.rollback()
                failed += 1
                try:
                    cur.execute("""
                        INSERT INTO import_errors (batch_id, row_no, error_message, raw_data)
                        VALUES (%s, %s, %s, %s)
                    """, (batch_id, row_num, str(e), safe_json_dump(row.to_dict())))
                    conn.commit()
                except Exception:
                    conn.rollback()

            processed += 1
            if processed % 100 == 0 or processed == total_rows:
                cur.execute("""
                    UPDATE import_batches
                    SET processed_rows=%s, inserted_rows=%s, updated_rows=%s, failed_rows=%s
                    WHERE id=%s
                """, (processed, inserted, 0, failed, batch_id))
                conn.commit()

        cur.execute(
            "UPDATE import_batches SET status='Completed', completed_at=NOW() WHERE id=%s",
            (batch_id,),
        )
        conn.commit()

    except Exception:
        conn.rollback()
        cur.execute(
            "UPDATE import_batches SET status='Failed', completed_at=NOW() WHERE id=%s",
            (batch_id,),
        )
        conn.commit()
        raise
    finally:
        cur.close()
        conn.close()


def start_refunds_import_job(batch_id, filepath):
    thread = threading.Thread(target=process_refunds_batch, args=(batch_id, filepath), daemon=True)
    thread.start()