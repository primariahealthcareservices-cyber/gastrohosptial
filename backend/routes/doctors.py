from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit

doctors_bp = Blueprint("doctors", __name__)

def blank_to_none(v):
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v

def _row_to_dict(row):
    """Normalize query() result to a single dict or None."""
    if not row:
        return None
    if isinstance(row, list):
        return row[0] if row else None
    return row

def _serialize_doctor(row):
    """Normalize types so the frontend never has to guess."""
    if not row:
        return None
    d = dict(row)
    
    # Ints
    for k in ("id", "department_id", "op_visits", "op_valid_for", "max_bookings_per_day"):
        if d.get(k) is not None:
            try:
                d[k] = int(d[k])
            except (ValueError, TypeError):
                d[k] = 0
                
    # Floats
    for k in (
        "op_consultation_fee", "ip_consultation_fee", "surgeon_fee",
        "emergency_consultation_fee", "op_doctor_fee", "ip_doctor_fee",
    ):
        if d.get(k) is not None:
            try:
                d[k] = float(d[k])
            except (ValueError, TypeError):
                d[k] = 0.0
                
    # Bool
    d["is_active"] = bool(d.get("is_active"))
    
    # Strings / Nulls
    for k in (
        "name", "first_name", "last_name", "gender", "phone", "emergency_phone",
        "email", "address", "specialization", "doctor_description",
        "image", "signature", "department",
    ):
        if d.get(k) is None:
            d[k] = ""
            
    # Fallback for first/last name if DB is still missing them
    if not d.get("first_name") and d.get("name"):
        clean = d["name"].replace("Dr.", "").strip()
        parts = clean.split()
        d["first_name"] = parts[0] if parts else ""
        d["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""

    return d

# ---------- LIST DOCTORS ----------
@doctors_bp.route("", methods=["GET"])
@jwt_required()
def list_doctors():
    search = request.args.get("search", "")
    like = f"%{search}%"
    rows = query("""
        SELECT d.id, d.name, d.first_name, d.last_name, d.gender, d.phone,
               d.emergency_phone, d.email, d.address, d.department_id, dep.name AS department,
               d.specialization, d.op_consultation_fee, d.ip_consultation_fee,
               d.surgeon_fee, d.emergency_consultation_fee,
               d.op_visits, d.op_valid_for, d.op_doctor_fee, d.ip_doctor_fee,
               d.doctor_description, d.image, d.signature, d.is_active,
               d.max_bookings_per_day
        FROM doctors d
        LEFT JOIN departments dep ON dep.id = d.department_id
        WHERE d.name LIKE %s OR d.email LIKE %s OR d.phone LIKE %s
        ORDER BY d.name
    """, (like, like, like), many=True)
    return jsonify([_serialize_doctor(r) for r in (rows or [])])

# ---------- GET SINGLE DOCTOR ----------
@doctors_bp.route("/<int:doctor_id>", methods=["GET"])
@jwt_required()
def get_doctor(doctor_id):
    row = query("""
        SELECT d.*, dep.name AS department
        FROM doctors d
        LEFT JOIN departments dep ON dep.id = d.department_id
        WHERE d.id=%s
    """, (doctor_id,))
    row = _row_to_dict(row)
    if not row:
        return jsonify({"error": "Doctor not found"}), 404
    return jsonify(_serialize_doctor(row))

# ---------- CREATE / UPDATE DOCTOR ----------
@doctors_bp.route("", methods=["POST"])
@jwt_required()
def upsert_doctor():
    d = request.get_json() or {}
    doctor_id = d.get("id")
    actor_id = get_jwt_identity()

    first_name = blank_to_none(d.get("first_name"))
    last_name = blank_to_none(d.get("last_name"))
    gender = blank_to_none(d.get("gender"))
    phone = blank_to_none(d.get("phone"))
    emergency_phone = blank_to_none(d.get("emergency_phone"))
    email = blank_to_none(d.get("email"))
    address = blank_to_none(d.get("address"))
    department_id = blank_to_none(d.get("department_id"))
    specialization = blank_to_none(d.get("specialization"))
    op_consultation_fee = d.get("op_consultation_fee", 0) or 0
    ip_consultation_fee = d.get("ip_consultation_fee", 0) or 0
    surgeon_fee = d.get("surgeon_fee", 0) or 0
    emergency_consultation_fee = d.get("emergency_consultation_fee", 0) or 0
    op_visits = d.get("op_visits", 0) or 0
    op_valid_for = d.get("op_valid_for", 0) or 0
    op_doctor_fee = d.get("op_doctor_fee", 0) or 0
    ip_doctor_fee = d.get("ip_doctor_fee", 0) or 0
    doctor_description = blank_to_none(d.get("doctor_description"))
    image = blank_to_none(d.get("image"))
    signature = blank_to_none(d.get("signature"))
    is_active = 1 if d.get("is_active") else 0
    max_bookings_per_day = d.get("max_bookings_per_day", 0) or 0

    if not first_name:
        return jsonify({"error": "First name is required"}), 400

    full_name = f"Dr. {first_name} {last_name or ''}".strip()

    if doctor_id:
        existing = _row_to_dict(query("SELECT id FROM doctors WHERE id=%s", (doctor_id,)))
        if not existing:
            return jsonify({"error": "Doctor not found"}), 404

        query("""
            UPDATE doctors
            SET name=%s, first_name=%s, last_name=%s, gender=%s, phone=%s,
                emergency_phone=%s, email=%s, address=%s, department_id=%s,
                specialization=%s, op_consultation_fee=%s, ip_consultation_fee=%s,
                surgeon_fee=%s, emergency_consultation_fee=%s,
                op_visits=%s, op_valid_for=%s, op_doctor_fee=%s, ip_doctor_fee=%s,
                doctor_description=%s, image=%s, signature=%s,
                is_active=%s, max_bookings_per_day=%s
            WHERE id=%s
        """, (full_name, first_name, last_name, gender, phone,
              emergency_phone, email, address, department_id,
              specialization, op_consultation_fee, ip_consultation_fee,
              surgeon_fee, emergency_consultation_fee,
              op_visits, op_valid_for, op_doctor_fee, ip_doctor_fee,
              doctor_description, image, signature,
              is_active, max_bookings_per_day, doctor_id),
        fetch=False, commit=True)
        log_audit(actor_id, "UPDATE_DOCTOR", "Doctor", doctor_id)
        return jsonify({"id": doctor_id, "message": "Doctor updated"}), 200

    new_id = query("""
        INSERT INTO doctors (
            name, first_name, last_name, gender, phone, emergency_phone,
            email, address, department_id, specialization,
            op_consultation_fee, ip_consultation_fee,
            surgeon_fee, emergency_consultation_fee,
            op_visits, op_valid_for, op_doctor_fee, ip_doctor_fee,
            doctor_description, image, signature,
            is_active, max_bookings_per_day
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (full_name, first_name, last_name, gender, phone, emergency_phone,
          email, address, department_id, specialization,
          op_consultation_fee, ip_consultation_fee,
          surgeon_fee, emergency_consultation_fee,
          op_visits, op_valid_for, op_doctor_fee, ip_doctor_fee,
          doctor_description, image, signature,
          is_active, max_bookings_per_day),
    fetch=False, commit=True)
    log_audit(actor_id, "CREATE_DOCTOR", "Doctor", new_id)
    return jsonify({"id": new_id, "message": "Doctor created"}), 201

# ---------- DELETE DOCTOR ----------
@doctors_bp.route("/<int:doctor_id>", methods=["DELETE"])
@jwt_required()
def delete_doctor(doctor_id):
    row = _row_to_dict(query("SELECT id FROM doctors WHERE id=%s", (doctor_id,)))
    if not row:
        return jsonify({"error": "Doctor not found"}), 404
    query("DELETE FROM doctors WHERE id=%s", (doctor_id,), fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE_DOCTOR", "Doctor", doctor_id)
    return jsonify({"success": True}), 200

# ============================================================
# IMPORT DOCTORS FROM CSV
# ============================================================
@doctors_bp.route("/import", methods=["POST"])
@jwt_required()
def import_doctors():
    data = request.get_json() or {}
    doctors_list = data.get("doctors", [])
    if not doctors_list:
        return jsonify({"error": "No doctors data provided"}), 400

    actor_id = get_jwt_identity()
    imported = 0
    errors = []

    def safe_float(val):
        try:
            return float(str(val).strip() or 0)
        except (ValueError, TypeError):
            return 0

    for idx, row in enumerate(doctors_list):
        try:
            name = (row.get("Name") or "").strip()
            gender = (row.get("Gender") or "").strip()
            phone = (row.get("Phone") or "").strip()
            emergency_phone = (row.get("Emergency Phone Number") or "").strip()
            department_name = (row.get("Department") or "").strip()
            specialization = (row.get("Specialization") or "").strip()
            op_fee = safe_float(row.get("OPConsultantFee"))
            ip_fee = safe_float(row.get("IPConsultantFee"))
            email = (row.get("Email") or "").strip()
            address = (row.get("Address") or "").strip()
            status = (row.get("Status") or "Active").strip()

            if not name:
                errors.append(f"Row {idx + 1}: Name is required")
                continue

            # Find or create department
            department_id = None
            if department_name:
                dep = _row_to_dict(query("SELECT id FROM departments WHERE name=%s", (department_name,)))
                if dep:
                    department_id = dep["id"]
                else:
                    department_id = query(
                        "INSERT INTO departments (name) VALUES (%s)",
                        (department_name,), fetch=False, commit=True,
                    )

            existing = None
            if email or phone:
                existing = _row_to_dict(query(
                    "SELECT id FROM doctors WHERE (email=%s AND email IS NOT NULL AND email<>'') "
                    "OR (phone=%s AND phone IS NOT NULL AND phone<>'') LIMIT 1",
                    (email or None, phone or None),
                ))

            is_active_val = 1 if status.lower() == "active" else 0

            if existing:
                query("""
                    UPDATE doctors
                    SET name=%s, gender=%s, phone=%s, emergency_phone=%s,
                        department_id=%s, specialization=%s,
                        op_consultation_fee=%s, ip_consultation_fee=%s,
                        email=%s, address=%s, is_active=%s
                    WHERE id=%s
                """, (name, gender, phone, emergency_phone, department_id,
                      specialization, op_fee, ip_fee, email, address,
                      is_active_val, existing["id"]),
                fetch=False, commit=True)
                imported += 1
            else:
                # SMARTER NAME SPLITTING LOGIC
                clean_name = name.replace("Dr.", "").replace("Dr", "").strip()
                parts = clean_name.split()
                if len(parts) > 1:
                    first_name = parts[0]           # e.g., "A"
                    last_name = " ".join(parts[1:]) # e.g., "BALASREE SOWMYA"
                else:
                    first_name = clean_name
                    last_name = ""

                query("""
                    INSERT INTO doctors (
                        name, first_name, last_name, gender, phone, emergency_phone,
                        department_id, specialization,
                        op_consultation_fee, ip_consultation_fee,
                        email, address, is_active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (name, first_name, last_name, gender, phone, emergency_phone,
                      department_id, specialization, op_fee, ip_fee,
                      email, address, is_active_val),
                fetch=False, commit=True)
                imported += 1

        except Exception as e:
            errors.append(f"Row {idx + 1}: {str(e)}")

    log_audit(actor_id, "IMPORT_DOCTORS", "Doctor", 0, f"Imported {imported} doctors")
    return jsonify({
        "imported": imported,
        "errors": errors,
        "message": f"Successfully imported {imported} doctors",
    }), 200

# ============================================================
# EXPORT DOCTORS
# ============================================================
@doctors_bp.route("/export", methods=["GET"])
@jwt_required()
def export_doctors():
    rows = query("""
        SELECT d.name AS Name,
               d.gender AS Gender,
               d.phone AS Phone,
               d.emergency_phone AS `Emergency Phone Number`,
               dep.name AS Department,
               d.specialization AS Specialization,
               d.op_consultation_fee AS OPConsultantFee,
               d.ip_consultation_fee AS IPConsultantFee,
               d.email AS Email,
               d.address AS Address,
               IF(d.is_active=1, 'Active', 'Inactive') AS Status
        FROM doctors d
        LEFT JOIN departments dep ON dep.id = d.department_id
        ORDER BY d.name
    """, many=True)
    return jsonify(rows or [])