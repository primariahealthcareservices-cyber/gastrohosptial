from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

manufacturers_bp = Blueprint("manufacturers", __name__)


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


# ---------- LIST ----------
@manufacturers_bp.route("", methods=["GET"])
@jwt_required()
def list_manufacturers():
    search = request.args.get("search", "") or ""
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

    where = "1=1"
    params = []
    if search:
        where += (" AND (name LIKE %s OR contact_person LIKE %s "
                  "OR contact_no LIKE %s OR email LIKE %s)")
        like = f"%{search}%"
        params.extend([like, like, like, like])

    count_row = query(
        f"SELECT COUNT(*) AS total FROM manufacturers WHERE {where}",
        tuple(params)
    )
    total = _extract_total(count_row)

    rows = query(
        f"""
        SELECT id, name, short_name, inventory_type, tax_category,
               contact_person, contact_no, pincode, fax, address,
               alt_contact_no, email, website, remarks,
               apgst_no, cst_no, gst_no, dl_no, pan_no,
               is_active, created_at, updated_at
        FROM manufacturers
        WHERE {where}
        ORDER BY name ASC
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
@manufacturers_bp.route("/<int:mfg_id>", methods=["GET"])
@jwt_required()
def get_manufacturer(mfg_id):
    row = query("SELECT * FROM manufacturers WHERE id=%s", (mfg_id,))
    if not row:
        return jsonify({"error": "Manufacturer not found"}), 404
    return jsonify(row)


# ---------- CREATE / UPDATE (upsert) ----------
@manufacturers_bp.route("", methods=["POST"])
@jwt_required()
def upsert_manufacturer():
    data = request.get_json() or {}
    mfg_id = data.get("id")
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Manufacturer name is required"}), 400

    fields = {
        "name": name,
        "short_name": blank_to_none(data.get("short_name")),
        "inventory_type": blank_to_none(data.get("inventory_type")),
        "tax_category": blank_to_none(data.get("tax_category")),
        "contact_person": blank_to_none(data.get("contact_person")),
        "contact_no": blank_to_none(data.get("contact_no")),
        "pincode": blank_to_none(data.get("pincode")),
        "fax": blank_to_none(data.get("fax")),
        "address": blank_to_none(data.get("address")),
        "alt_contact_no": blank_to_none(data.get("alt_contact_no")),
        "email": blank_to_none(data.get("email")),
        "website": blank_to_none(data.get("website")),
        "remarks": blank_to_none(data.get("remarks")),
        "apgst_no": blank_to_none(data.get("apgst_no")),
        "cst_no": blank_to_none(data.get("cst_no")),
        "gst_no": blank_to_none(data.get("gst_no")),
        "dl_no": blank_to_none(data.get("dl_no")),
        "pan_no": blank_to_none(data.get("pan_no")),
        "is_active": 1 if data.get("is_active", True) else 0,
    }

    if mfg_id:
        set_clause = ", ".join(f"{k}=%s" for k in fields.keys())
        query(
            f"UPDATE manufacturers SET {set_clause} WHERE id=%s",
            tuple(fields.values()) + (mfg_id,),
            fetch=False, commit=True
        )
        return jsonify({"id": mfg_id, "name": name}), 200
    else:
        cols = ", ".join(fields.keys())
        placeholders = ", ".join(["%s"] * len(fields))
        query(
            f"INSERT INTO manufacturers ({cols}) VALUES ({placeholders})",
            tuple(fields.values()),
            fetch=False, commit=True
        )
        created = query(
            "SELECT id FROM manufacturers WHERE name=%s ORDER BY id DESC LIMIT 1",
            (name,)
        )
        new_id = created["id"] if created else None
        return jsonify({"id": new_id, "name": name}), 201


# ---------- DELETE (soft) ----------
@manufacturers_bp.route("/<int:mfg_id>", methods=["DELETE"])
@jwt_required()
def delete_manufacturer(mfg_id):
    row = query("SELECT id FROM manufacturers WHERE id=%s", (mfg_id,))
    if not row:
        return jsonify({"error": "Manufacturer not found"}), 404
    query("UPDATE manufacturers SET is_active=0 WHERE id=%s", (mfg_id,),
          fetch=False, commit=True)
    return jsonify({"success": True}), 200