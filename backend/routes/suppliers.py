from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit

suppliers_bp = Blueprint("suppliers", __name__)


def blank_to_none(v):
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


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


# ---------- LIST SUPPLIERS ----------
@suppliers_bp.route("", methods=["GET"])
@jwt_required()
def list_suppliers():
    search = request.args.get("search", "") or ""
    is_active_filter = request.args.get("is_active")  # optional filter

    try:
        page = int(request.args.get("page", 1) or 1)
    except ValueError:
        page = 1
    try:
        limit = int(request.args.get("limit", 10) or 10)
    except ValueError:
        limit = 10

    if page < 1:
        page = 1
    if limit < 1:
        limit = 10
    if limit > 200:
        limit = 200

    offset = (page - 1) * limit

    where_clauses = ["1=1"]
    params = []

    if search:
        where_clauses.append(
            "(name LIKE %s OR contact_person LIKE %s OR email LIKE %s "
            "OR contact_no LIKE %s OR gst_no LIKE %s)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like, like])

    if is_active_filter is not None:
        where_clauses.append("is_active = %s")
        params.append(1 if is_active_filter in ("1", "true", "True") else 0)

    where_sql = " AND ".join(where_clauses)

    count_row = query(
        f"SELECT COUNT(*) AS total FROM suppliers WHERE {where_sql}",
        tuple(params)
    )
    total = _extract_total(count_row)

    sql = f"""
        SELECT id, name, inventory_type, vat_no, contact_person, contact_no,
               email, gst_no, pincode, address, fax, alt_contact_no,
               website, remarks, apgst_no, cst_no, dl_no, pan_no,
               is_active, is_igst_tax, created_at, updated_at
        FROM suppliers
        WHERE {where_sql}
        ORDER BY name
        LIMIT %s OFFSET %s
    """
    rows = query(sql, tuple(params) + (limit, offset), many=True) or []

    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return jsonify({
        "data": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages if total_pages > 0 else 1,
    })


# ---------- GET SINGLE SUPPLIER ----------
@suppliers_bp.route("/<int:supplier_id>", methods=["GET"])
@jwt_required()
def get_supplier(supplier_id):
    row = query("SELECT * FROM suppliers WHERE id=%s", (supplier_id,))
    if not row:
        return jsonify({"error": "Supplier not found"}), 404
    return jsonify(row)


# ---------- CREATE / UPDATE SUPPLIER ----------
@suppliers_bp.route("", methods=["POST"])
@jwt_required()
def upsert_supplier():
    data = request.get_json() or {}
    supplier_id = data.get("id")
    user_id = get_jwt_identity()

    name = data.get("name")
    if not name:
        return jsonify({"error": "Supplier name is required"}), 400

    inventory_type = blank_to_none(data.get("inventory_type"))
    vat_no = blank_to_none(data.get("vat_no"))
    contact_person = blank_to_none(data.get("contact_person"))
    contact_no = blank_to_none(data.get("contact_no"))
    email = blank_to_none(data.get("email"))
    gst_no = blank_to_none(data.get("gst_no"))
    pincode = blank_to_none(data.get("pincode"))
    address = blank_to_none(data.get("address"))
    fax = blank_to_none(data.get("fax"))
    alt_contact_no = blank_to_none(data.get("alt_contact_no"))
    website = blank_to_none(data.get("website"))
    remarks = blank_to_none(data.get("remarks"))
    apgst_no = blank_to_none(data.get("apgst_no"))
    cst_no = blank_to_none(data.get("cst_no"))
    dl_no = blank_to_none(data.get("dl_no"))
    pan_no = blank_to_none(data.get("pan_no"))
    is_active = 1 if data.get("is_active", True) else 0
    is_igst_tax = 1 if data.get("is_igst_tax") else 0

    if supplier_id:
        query("""
            UPDATE suppliers
            SET name=%s, inventory_type=%s, vat_no=%s, contact_person=%s,
                contact_no=%s, email=%s, gst_no=%s, pincode=%s,
                address=%s, fax=%s, alt_contact_no=%s, website=%s,
                remarks=%s, apgst_no=%s, cst_no=%s, dl_no=%s,
                pan_no=%s, is_active=%s, is_igst_tax=%s
            WHERE id=%s
        """, (name, inventory_type, vat_no, contact_person,
              contact_no, email, gst_no, pincode,
              address, fax, alt_contact_no, website,
              remarks, apgst_no, cst_no, dl_no,
              pan_no, is_active, is_igst_tax, supplier_id),
        fetch=False, commit=True)
        log_audit(user_id, "UPDATE", "Supplier", supplier_id)
    else:
        query("""
            INSERT INTO suppliers (
                name, inventory_type, vat_no, contact_person,
                contact_no, email, gst_no, pincode,
                address, fax, alt_contact_no, website,
                remarks, apgst_no, cst_no, dl_no,
                pan_no, is_active, is_igst_tax
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s)
        """, (name, inventory_type, vat_no, contact_person,
              contact_no, email, gst_no, pincode,
              address, fax, alt_contact_no, website,
              remarks, apgst_no, cst_no, dl_no,
              pan_no, is_active, is_igst_tax),
        fetch=False, commit=True)

        created = query(
            "SELECT id FROM suppliers WHERE name=%s ORDER BY id DESC LIMIT 1",
            (name,)
        )
        supplier_id = created["id"] if created else None
        log_audit(user_id, "CREATE", "Supplier", supplier_id)

    return jsonify({"id": supplier_id, "name": name}), 201


# ---------- DELETE SUPPLIER ----------
@suppliers_bp.route("/<int:supplier_id>", methods=["DELETE"])
@jwt_required()
def delete_supplier(supplier_id):
    row = query("SELECT id FROM suppliers WHERE id=%s", (supplier_id,))
    if not row:
        return jsonify({"error": "Supplier not found"}), 404

    used = query("SELECT id FROM grn WHERE supplier_id=%s LIMIT 1", (supplier_id,))
    if used:
        return jsonify({"error": "Cannot delete supplier – already used in GRN"}), 400

    query("UPDATE suppliers SET is_active=0 WHERE id=%s", (supplier_id,),
          fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE", "Supplier", supplier_id)
    return jsonify({"success": True}), 200