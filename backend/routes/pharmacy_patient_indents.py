# backend/routes/pharmacy_patient_indents.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query

pharmacy_patient_indents_bp = Blueprint("pharmacy_patient_indents", __name__)

# ============================================================
# 1. Get all Patient Indents (for the list view)
# ============================================================
@pharmacy_patient_indents_bp.route("", methods=["GET"])
@jwt_required()
def list_indents():
    search = request.args.get("search", "").strip()
    
    sql = """
        SELECT 
            pi.id, 
            p.patient_uid AS mr_number, 
            CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) AS patient_name,
            r.ip_reg_no, 
            pi.status, 
            pi.created_at,
            u.name AS requested_by_name,
            (SELECT GROUP_CONCAT(item_name SEPARATOR ', ') FROM patient_indent_items WHERE indent_id = pi.id) AS medicine_details
        FROM patient_indents pi
        JOIN ip_registrations r ON r.id = pi.ip_registration_id
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN users u ON u.id = pi.requested_by
        WHERE 1=1
    """
    params = []
    
    if search:
        sql += " AND (p.patient_uid LIKE %s OR r.ip_reg_no LIKE %s OR r.first_name LIKE %s)"
        term = f"%{search}%"
        params.extend([term, term, term])
        
    sql += " ORDER BY pi.id DESC"
    
    try:
        indents = query(sql, tuple(params), many=True)
        return jsonify({"data": indents or []})
    except Exception as e:
        print(f"Error fetching indents: {e}")
        return jsonify({"data": []})

# ============================================================
# 2. Create a new Patient Indent
# ============================================================
@pharmacy_patient_indents_bp.route("", methods=["POST"])
@jwt_required()
def create_indent():
    d = request.get_json()
    ip_registration_id = d.get("ip_registration_id")
    items = d.get("items", [])
    
    if not ip_registration_id:
        return jsonify({"error": "Patient is required"}), 400
    if not items:
        return jsonify({"error": "At least one medicine is required"}), 400

    user_id = get_jwt_identity()

    try:
        # 1. Insert into patient_indents
        indent_id = query("""
            INSERT INTO patient_indents (ip_registration_id, status, requested_by)
            VALUES (%s, 'Pending', %s)
        """, (ip_registration_id, user_id), fetch=False, commit=True)

        # 2. Insert items
        for item in items:
            query("""
                INSERT INTO patient_indent_items (indent_id, item_name, qty)
                VALUES (%s, %s, %s)
            """, (indent_id, item.get("item_name"), item.get("qty", 1)), fetch=False, commit=True)

        return jsonify({"message": "Indent created successfully", "id": indent_id}), 201
    except Exception as e:
        print(f"Error creating indent: {e}")
        return jsonify({"error": str(e)}), 500