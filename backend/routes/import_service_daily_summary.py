import re
import threading
import pandas as pd
from db import get_db
from routes.common_import import to_decimal, safe_json_dump

# Column names in the portal's daily summary CSV map directly to table columns.
COLUMN_MAP = {
    "Date":                    "summary_date",
    "OP Count":                "op_count",
    "OP Amount":               "op_amount",
    "OP Lab Amount":           "op_lab_amount",
    "OP Radiology Amount":     "op_radiology_amount",
    "IP Count":                "ip_count",
    "IP Amount":               "ip_amount",
    "IP Lab Amount":           "ip_lab_amount",
    "IP Radiology Amount":     "ip_radiology_amount",
    "Direct Count":            "direct_count",
    "Direct Amount":           "direct_amount",
    "Direct Lab Amount":       "direct_lab_amount",
    "Direct Radiology Amount": "direct_radiology_amount",
    "Total Amount":            "total_amount",
    "Expenses":                "expenses",
    "Grand Total":             "grand_total",
    "Due Total":               "due_total",
    "Credit Due":              "credit_due",
    "Insurance Due":           "insurance_due",
}

_DATE_LIKE_RE = re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|^\d{4}-\d{2}-\d{2}")

INSERT_COLS = [
    "summary_date", "op_count", "op_amount", "op_lab_amount", "op_radiology_amount",
    "ip_count", "ip_amount", "ip_lab_amount", "ip_radiology_amount",
    "direct_count", "direct_amount", "direct_lab_amount", "direct_radiology_amount",
    "total_amount", "expenses", "grand_total", "due_total", "credit_due", "insurance_due",
]


def _looks_like_date(val):
    if val is None:
        return False
    return bool(_DATE_LIKE_RE.match(str(val).strip()))


def _strip_junk_rows(raw_df, date_col="Date"):
    """Drop rows where the Date column isn't a real date (header repeats, totals, blanks)."""
    if date_col not in raw_df.columns:
        return raw_df, 0
    before = len(raw_df)
    mask = raw_df[date_col].apply(_looks_like_date)
    return raw_df[mask], before - len(raw_df[mask])


def _to_date(val):
    """Parse dd-mm-yyyy or yyyy-mm-dd into a date string (YYYY-MM-DD)."""
    s = str(val).strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            from datetime import datetime
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def upsert_summary_row(cur, row):
    """Insert or update one daily summary row (unique key: summary_date)."""
    summary_date = _to_date(row.get("summary_date"))
    if not summary_date:
        raise ValueError(f"Invalid date: {row.get('summary_date')}")

    values = [summary_date]
    for col in INSERT_COLS[1:]:
        values.append(to_decimal(row.get(col)))

    sql = f"""
        INSERT INTO daily_collection_summary
        ({', '.join(INSERT_COLS)})
        VALUES ({', '.join(['%s'] * len(INSERT_COLS))})
        ON DUPLICATE KEY UPDATE
        {', '.join([f"{c}=VALUES({c})" for c in INSERT_COLS[1:]])}
    """
    cur.execute(sql, tuple(values))


def process_daily_summary_batch(batch_id, filepath):
    conn = get_db()
    cur = conn.cursor(dictionary=True, buffered=True)

    try:
        cur.execute("UPDATE import_batches SET status='Processing' WHERE id=%s", (batch_id,))
        conn.commit()

        df = pd.read_csv(filepath, dtype=str, encoding="utf-8-sig") \
            if filepath.lower().endswith(".csv") \
            else pd.read_excel(filepath, dtype=str)

        df, skipped_junk_rows = _strip_junk_rows(df, date_col="Date")

        df = df.rename(columns=COLUMN_MAP)
        df = df.where(pd.notnull(df), None)
        df = df.reset_index(drop=True)

        total_rows = len(df)
        cur.execute(
            "UPDATE import_batches SET total_rows=%s, failed_rows=%s WHERE id=%s",
            (total_rows, skipped_junk_rows, batch_id),
        )
        conn.commit()

        inserted = updated = failed = processed = 0

        for idx, row in df.iterrows():
            row_num = int(idx) + 2
            try:
                upsert_summary_row(cur, row)
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
                """, (processed, inserted, updated, failed, batch_id))
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


def start_daily_summary_import_job(batch_id, filepath):
    thread = threading.Thread(target=process_daily_summary_batch, args=(batch_id, filepath), daemon=True)
    thread.start()