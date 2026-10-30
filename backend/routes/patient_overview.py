from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from db import query
import json

patient_overview_bp = Blueprint("patient_overview", __name__)


@patient_overview_bp.route("/<int:ip_registration_id>", methods=["GET"])
@jwt_required()
def patient_overview(ip_registration_id):
    # ---------- 1. Admission ----------
    admission = query("""
        SELECT r.id, r.ip_reg_no, r.patient_id,
               CONCAT(r.first_name, ' ', IFNULL(r.last_name, '')) AS name,
               r.mobile, r.gender, r.age, r.blood_group,
               r.admitted_date, r.status,
               r.room_type, r.room_no, r.bed_no,
               r.doctor_id, doc.name AS doctor_name
        FROM ip_registrations r
        LEFT JOIN doctors doc ON doc.id = r.doctor_id
        WHERE r.id = %s
    """, (ip_registration_id,))

    if not admission:
        return jsonify({"error": "Admission not found"}), 404

    patient_id = admission["patient_id"]

    # ---------- 2. IP Bill ----------
    bill = query("""
        SELECT id, bill_no, admission_charge, room_charge, doctor_visit_charge,
               lab_charge, radiology_charge, ot_charge, procedure_charge,
               medicine_charge, nursing_charge, service_charge, food_charge,
               misc_charge, gross_total, discount, grand_total,
               advance_adjusted, paid_amount, due_amount,
               payment_mode, status, created_at
        FROM ip_bills
        WHERE ip_registration_id = %s
        ORDER BY id DESC LIMIT 1
    """, (ip_registration_id,))

    # ---------- 3. Pharmacy sales ----------
    sales = query("""
        SELECT id, sale_no, sale_type, total_amount, discount_amount, net_amount,
               payment_mode, paid_amount, due_amount, status, created_at
        FROM pharmacy_sales
        WHERE patient_id = %s
        ORDER BY created_at DESC
    """, (patient_id,), many=True)

    for s in sales:
        s["items"] = query("""
            SELECT item_name, batch_no, qty, mrp, amount
            FROM pharmacy_sale_items
            WHERE sale_id = %s
            ORDER BY id
        """, (s["id"],), many=True)

    pharmacy_total = sum(float(s["net_amount"] or 0) for s in sales)

    # ---------- 4. IP Lab ----------
    ip_lab = query("""
        SELECT id, item_name, quantity, rate, amount, created_at
        FROM ip_lab
        WHERE ip_registration_id = %s
        ORDER BY created_at DESC
    """, (ip_registration_id,), many=True)
    ip_lab_total = sum(float(l["amount"] or 0) for l in ip_lab)

    # ---------- 5. OP Lab (via latest OP registration for the patient) ----------
    op_registration_id = None
    op_row = query("""
        SELECT id FROM op_registrations
        WHERE patient_id = %s
        ORDER BY id DESC LIMIT 1
    """, (patient_id,))
    if op_row:
        op_registration_id = op_row["id"]

    op_lab = []
    if op_registration_id:
        op_lab = query("""
            SELECT id, item_name, quantity, rate, amount, created_at
            FROM op_lab
            WHERE op_registration_id = %s
            ORDER BY created_at DESC
        """, (op_registration_id,), many=True)
    op_lab_total = sum(float(l["amount"] or 0) for l in op_lab)

    # ---------- 6. Discharge summary ----------
    discharge = query("""
        SELECT id, surgery_date, diagnosis, `procedure`, complaint,
               condition_discharge, discharge_advise, created_at
        FROM discharge_summaries
        WHERE ip_registration_id = %s
    """, (ip_registration_id,))

    if discharge:
        if isinstance(discharge.get("discharge_advise"), str):
            try:
                discharge["discharge_advise"] = json.loads(discharge["discharge_advise"])
            except Exception:
                discharge["discharge_advise"] = []
        # Derive "discharged_at" from the summary row
        admission["discharge_date"] = discharge.get("created_at")

    return jsonify({
        "admission": admission,
        "bill": bill,
        "pharmacy": {"sales": sales, "total": pharmacy_total},
        "lab": {
            "ip": ip_lab, "ip_total": ip_lab_total,
            "op": op_lab, "op_total": op_lab_total,
            "total": ip_lab_total + op_lab_total,
        },
        "discharge": discharge,
    })