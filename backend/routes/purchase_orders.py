from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query

purchase_orders_bp = Blueprint("purchase_orders", __name__)


def _extract_total(count_row):
    if not count_row:
        return 0
    if isinstance(count_row, dict):
        for k in ("total", "COUNT(*)", "count", "count(*)"):
            if k in count_row:
                return int(count_row[k] or 0)
        return int(next(iter(count_row.values()), 0) or 0)
    if isinstance(count_row, (list, tuple)):
        if len(count_row) == 0:
            return 0
        first = count_row[0]
        if isinstance(first, dict):
            return _extract_total(first)
        return int(first or 0)
    try:
        return int(count_row)
    except (TypeError, ValueError):
        return 0


# ---------- LIST ----------
@purchase_orders_bp.route("", methods=["GET"])
@jwt_required()
def list_pos():
    search = request.args.get("search", "") or ""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    try:
        page = int(request.args.get("page", 1) or 1)
    except ValueError:
        page = 1
    try:
        limit = int(request.args.get("limit", 10) or 10)
    except ValueError:
        limit = 10
    if page < 1: page = 1
    if limit < 1: limit = 10
    if limit > 200: limit = 200
    offset = (page - 1) * limit

    where = "1=1"
    params = []

    if search:
        where += " AND (po_no LIKE %s OR inventory_type LIKE %s)"
        like = f"%{search}%"
        params.extend([like, like])

    if start_date:
        where += " AND po_date >= %s"
        params.append(start_date)

    if end_date:
        where += " AND po_date <= %s"
        params.append(end_date)

    count_row = query(
        f"SELECT COUNT(*) AS total FROM purchase_orders WHERE {where}",
        tuple(params)
    )
    total = _extract_total(count_row)

    rows = query(
        f"""
        SELECT po.id, po.po_no, po.po_date, po.valid_till, po.inventory_type,
               po.supplier_id, s.name AS supplier_name,
               po.status, po.net_payable,
               u.name AS created_by_name,
               po.created_at
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        LEFT JOIN users u ON u.id = po.created_by
        WHERE {where}
        ORDER BY po.id DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params) + (limit, offset),
        many=True
    ) or []

    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return jsonify({
        "data": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages if total_pages > 0 else 1,
    })


# ---------- GET SINGLE ----------
@purchase_orders_bp.route("/<int:po_id>", methods=["GET"])
@jwt_required()
def get_po(po_id):
    header = query("""
        SELECT po.*, s.name AS supplier_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.id=%s
    """, (po_id,))
    if not header:
        return jsonify({"error": "Purchase Order not found"}), 404

    items = query(
        "SELECT * FROM purchase_order_items WHERE purchase_order_id=%s ORDER BY id",
        (po_id,), many=True
    ) or []

    header["items"] = items
    return jsonify(header)


# ---------- NEXT PO NUMBER ----------
@purchase_orders_bp.route("/next-no", methods=["GET"])
@jwt_required()
def next_po_no():
    row = query("SELECT MAX(id) AS max_id FROM purchase_orders")
    nxt = (row["max_id"] or 0) + 1 if row else 1
    return jsonify({"po_no": f"PO-{nxt:05d}"})


# ---------- CREATE ----------
@purchase_orders_bp.route("", methods=["POST"])
@jwt_required()
def create_po():
    data = request.get_json() or {}
    user_id = get_jwt_identity()

    po_no = (data.get("po_no") or "").strip() or None
    po_date = data.get("po_date")
    if not po_date:
        return jsonify({"error": "PO Date is required"}), 400

    fields = {
        "po_no": po_no,
        "po_date": po_date,
        "valid_till": data.get("valid_till") or None,
        "inventory_type": data.get("inventory_type") or None,
        "supplier_id": data.get("supplier_id") or None,
        "supplier_phone": data.get("supplier_phone") or None,
        "supplier_email": data.get("supplier_email") or None,
        "supplier_address": data.get("supplier_address") or None,
        "sub_total": data.get("sub_total") or 0,
        "overall_disc_pct": data.get("overall_disc_pct") or 0,
        "overall_disc_amt": data.get("overall_disc_amt") or 0,
        "tax_amount": data.get("tax_amount") or 0,
        "net_amount": data.get("net_amount") or 0,
        "other_charges": data.get("other_charges") or 0,
        "net_payable": data.get("net_payable") or 0,
        "terms_and_conditions": data.get("terms_and_conditions") or None,
        "credit_period_days": data.get("credit_period_days") or None,
        "mode_of_dispatch": data.get("mode_of_dispatch") or None,
        "place_of_delivery": data.get("place_of_delivery") or None,
        "payment_terms": data.get("payment_terms") or None,
        "contact_person": data.get("contact_person") or None,
        "contact_no_at_delivery": data.get("contact_no_at_delivery") or None,
        "remarks": data.get("remarks") or None,
        "status": data.get("status") or "Pending",
        "created_by": user_id,
    }

    cols = ", ".join(fields.keys())
    ph = ", ".join(["%s"] * len(fields))
    query(f"INSERT INTO purchase_orders ({cols}) VALUES ({ph})",
          tuple(fields.values()), fetch=False, commit=True)

    created = query("SELECT id FROM purchase_orders ORDER BY id DESC LIMIT 1")
    po_id = created["id"] if created else None

    items = data.get("items") or []
    for it in items:
        query("""
            INSERT INTO purchase_order_items
            (purchase_order_id, item_name, batch_no, qty, rate, disc_pct, tax_pct, amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (po_id,
              it.get("item_name") or "",
              it.get("batch_no") or None,
              it.get("qty") or 0,
              it.get("rate") or 0,
              it.get("disc_pct") or 0,
              it.get("tax_pct") or 0,
              it.get("amount") or 0),
            fetch=False, commit=True)

    return jsonify({"id": po_id, "po_no": po_no}), 201


# ---------- UPDATE ----------
@purchase_orders_bp.route("/<int:po_id>", methods=["PUT"])
@jwt_required()
def update_po(po_id):
    data = request.get_json() or {}

    fields = {
        "po_no": (data.get("po_no") or "").strip() or None,
        "po_date": data.get("po_date"),
        "valid_till": data.get("valid_till") or None,
        "inventory_type": data.get("inventory_type") or None,
        "supplier_id": data.get("supplier_id") or None,
        "supplier_phone": data.get("supplier_phone") or None,
        "supplier_email": data.get("supplier_email") or None,
        "supplier_address": data.get("supplier_address") or None,
        "sub_total": data.get("sub_total") or 0,
        "overall_disc_pct": data.get("overall_disc_pct") or 0,
        "overall_disc_amt": data.get("overall_disc_amt") or 0,
        "tax_amount": data.get("tax_amount") or 0,
        "net_amount": data.get("net_amount") or 0,
        "other_charges": data.get("other_charges") or 0,
        "net_payable": data.get("net_payable") or 0,
        "terms_and_conditions": data.get("terms_and_conditions") or None,
        "credit_period_days": data.get("credit_period_days") or None,
        "mode_of_dispatch": data.get("mode_of_dispatch") or None,
        "place_of_delivery": data.get("place_of_delivery") or None,
        "payment_terms": data.get("payment_terms") or None,
        "contact_person": data.get("contact_person") or None,
        "contact_no_at_delivery": data.get("contact_no_at_delivery") or None,
        "remarks": data.get("remarks") or None,
        "status": data.get("status") or "Pending",
    }

    set_clause = ", ".join(f"{k}=%s" for k in fields.keys())
    query(f"UPDATE purchase_orders SET {set_clause} WHERE id=%s",
          tuple(fields.values()) + (po_id,), fetch=False, commit=True)

    # Replace items
    query("DELETE FROM purchase_order_items WHERE purchase_order_id=%s",
          (po_id,), fetch=False, commit=True)

    items = data.get("items") or []
    for it in items:
        query("""
            INSERT INTO purchase_order_items
            (purchase_order_id, item_name, batch_no, qty, rate, disc_pct, tax_pct, amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (po_id,
              it.get("item_name") or "",
              it.get("batch_no") or None,
              it.get("qty") or 0,
              it.get("rate") or 0,
              it.get("disc_pct") or 0,
              it.get("tax_pct") or 0,
              it.get("amount") or 0),
            fetch=False, commit=True)

    return jsonify({"id": po_id}), 200


# ---------- CANCEL (soft) ----------
@purchase_orders_bp.route("/<int:po_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_po(po_id):
    query("UPDATE purchase_orders SET status='Cancelled' WHERE id=%s",
          (po_id,), fetch=False, commit=True)
    return jsonify({"success": True}), 200