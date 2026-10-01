import re
import threading
import pandas as pd
from db import get_db
from routes.common_import import (
    clean_str, to_decimal, parse_date_flex, get_user_id_by_name,
    safe_json_dump, record_refund_from_row,
)

COLUMN_MAP = {
    "Patient Reg.No":   "patient_reg_no",
    "Patient Name":     "patient_name",
    "Invoice No":       "invoice_no",
    "Lab & Radiology":  "lab_radiology",
    "Created At":       "bill_date",
    "Created By":       "created_by_name",
    "Cancelled At":     "cancelled_at",
    "Cancelled User":   "cancelled_user",
    "Cancelled Amount": "refund_amount",
    "Reason":           "reason",
}

_DATE_TIME_RE = re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2})?$")


def _looks_like_datetime(v):
    if v is None:
        return False
    return bool(_DATE_TIME_RE.match(str(v).strip()))


def _strip_junk_rows(df):
    if "Invoice No" not in df.columns:
        return df, 0

    before = len(df)

    def is_valid(v):
        if v is None:
            return False
        s = str(v).strip().upper()
        if not s:
            return False
        return s.startswith(("OPINV", "OPRINV", "IPDINV", "IPRINV", "IPINV"))

    mask = df["Invoice No"].apply(is_valid)
    return df[mask], before - len(df[mask])


def _resolve_bill_id(cur, invoice_no):
    if not invoice_no:
        return None, None
    bn = str(invoice_no).strip()
    bn_upper = bn.upper()

    is_ip_invoice = bn_upper.startswith(("IPDINV", "IPRINV", "IPINV", "IPD", "IPR"))

    if is_ip_invoice:
        cur.execute("SELECT id FROM ip_bills WHERE bill_no=%s", (bn,))
        row = cur.fetchone()
        if row:
            return row["id"], "IP"

    cur.execute("SELECT id FROM op_bills WHERE bill_no=%s", (bn,))
    row = cur.fetchone()
    if row:
        return row["id"], ("IP" if is_ip_invoice else "OP")

    cur.execute("SELECT id FROM ip_bills WHERE bill_no=%s", (bn,))
    row = cur.fetchone()
    if row:
        return row["id"], "IP"

    return None, None


def _auto_category(invoice_no, bill_type, reason):
    """
    Route a cancellation refund to the correct dashboard card.

    Routing is based on the invoice PREFIX, not bill_type, because the
    bill lookup may find IP invoices inside op_bills and return 'OP'.

      IPDInv* → ip_diagnostics
      IPRInv* → ip_radiology
      IPInv*  → ip_income
      OPRInv* → op_radiology (or direct_radiology if bulk-cancelled)
      OPInv*/OPDInv*/OPIN* → op_diagnostics (or direct_diagnostics if bulk-cancelled)
      fallback → op_billing
    """
    bn = (invoice_no or "").upper()
    reason_clean = (reason or "").strip().lower()

    # --- IP cards by prefix (checked FIRST, before bill_type) ---
    if bn.startswith("IPDINV") or bn.startswith("IPD"):
        return "ip_diagnostics"
    if bn.startswith("IPRINV") or bn.startswith("IPR"):
        return "ip_radiology"
    if bn.startswith("IPINV") or (bn.startswith("IP") and bill_type == "IP"):
        return "ip_income"

    # --- OP + bulk cancellation → Direct cards ---
    if reason_clean == "bill cancelled":
        if bn.startswith("OPR"):
            return "direct_radiology"
        if bn.startswith(("OPINV", "OPDINV", "OPIN")):
            return "direct_diagnostics"
        return "direct_patients"

    # --- Regular OP prefix routing ---
    if bn.startswith("OPR"):
        return "op_radiology"
    if bn.startswith(("OPINV", "OPDINV", "OPIN")):
        return "op_diagnostics"
    return "op_billing"


def _lookup_bill_mode(cur, bill_id):
    """
    Read payment_mode from whichever table holds the bill.
    IP-prefixed invoices often live in op_bills in this DB, so we
    always check both tables.
    """
    cur.execute("SELECT payment_mode FROM ip_bills WHERE id=%s", (bill_id,))
    row = cur.fetchone()
    if row and row.get("payment_mode"):
        return row["payment_mode"]

    cur.execute("SELECT payment_mode FROM op_bills WHERE id=%s", (bill_id,))
    row = cur.fetchone()
    if row and row.get("payment_mode"):
        return row["payment_mode"]

    return "Cash"


def process_cancellations_batch(batch_id, filepath):
    conn = get_db()
    cur = conn.cursor(dictionary=True, buffered=True)

    try:
        cur.execute("UPDATE import_batches SET status='Processing' WHERE id=%s", (batch_id,))
        conn.commit()

        df = pd.read_csv(filepath, dtype=str, encoding="utf-8-sig", sep=None, engine="python") \
            if filepath.lower().endswith(".csv") \
            else pd.read_excel(filepath, dtype=str)

        df, skipped_junk_rows = _strip_junk_rows(df)

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
                    raise ValueError("Missing Invoice No")

                bill_id, bill_type = _resolve_bill_id(cur, invoice_no)
                if bill_id is None:
                    raise ValueError(
                        f"No bill found for invoice '{invoice_no}' "
                        f"(import the bills first, then the cancellations)"
                    )

                refund_date = (
                    parse_date_flex(row.get("cancelled_at"))
                    or parse_date_flex(row.get("bill_date"))
                )

                performed_by = get_user_id_by_name(
                    cur, row.get("cancelled_user"), default_id=7
                )

                reason = clean_str(row.get("reason")) or "Bill cancelled"

                category = _auto_category(invoice_no, bill_type, reason)

                # Read the mode from whichever table has the bill
                effective_mode = _lookup_bill_mode(cur, bill_id)

                action_id = record_refund_from_row(
                    cur,
                    bill_type=bill_type,
                    bill_no=invoice_no,
                    category=category,
                    amount=to_decimal(row.get("refund_amount")),
                    pay_mode=effective_mode,
                    request_reason=reason,
                    approved_reason=reason,
                    performed_by=performed_by,
                    bill_date=refund_date,
                )

                if action_id is None:
                    raise ValueError(
                        "record_refund_from_row returned None — check helper logic"
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


def start_cancellations_import_job(batch_id, filepath):
    thread = threading.Thread(
        target=process_cancellations_batch,
        args=(batch_id, filepath),
        daemon=True,
    )
    thread.start()