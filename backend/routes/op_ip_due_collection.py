from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from datetime import datetime

op_ip_due_collection_bp = Blueprint('op_ip_due_collection', __name__, url_prefix='/op-ip-due-collection')

@op_ip_due_collection_bp.route('/patients', methods=['GET'])
@jwt_required()
def get_patients():
    try:
        p_type = request.args.get('type', 'INPATIENT').upper()
        search = request.args.get('search', '').strip()
        
        # Map frontend dropdown to database sale_type
        if p_type == 'INPATIENT':
            db_sale_type = 'IP'
        elif p_type == 'OUTPATIENT':
            db_sale_type = 'OP'
        else:
            db_sale_type = 'Direct'

        # Base query to find patients with dues in pharmacy_sales
        # We group by patient/registration to get total due per person
        sql = """
            SELECT 
                s.sale_type,
                COALESCE(r_op.opd_reg_no, r_ip.ip_reg_no, 'DIRECT') as reg_no,
                COALESCE(CONCAT(r_op.first_name, ' ', IFNULL(r_op.last_name, '')), 
                         CONCAT(r_ip.first_name, ' ', IFNULL(r_ip.last_name, '')), 
                         'Direct Patient') as name,
                COALESCE(r_op.mobile, r_ip.mobile, '') as phone,
                SUM(s.due_amount) as due_amount
            FROM pharmacy_sales s
            LEFT JOIN op_registrations r_op ON s.op_registration_id = r_op.id
            LEFT JOIN ip_registrations r_ip ON s.ip_registration_id = r_ip.id
            WHERE s.sale_type = %s AND s.due_amount > 0 AND s.status != 'Draft'
        """
        params = [db_sale_type]

        # Apply search filter across registration no, name, or phone
        if search:
            sql += """ 
                AND (
                    r_op.opd_reg_no LIKE %s OR r_ip.ip_reg_no LIKE %s 
                    OR r_op.first_name LIKE %s OR r_ip.first_name LIKE %s
                    OR r_op.mobile LIKE %s OR r_ip.mobile LIKE %s
                )
            """
            term = f"%{search}%"
            params.extend([term, term, term, term, term, term])

        sql += " GROUP BY reg_no, name, phone, s.sale_type"
        
        patients = query(sql, tuple(params), many=True)
        
        # Format for frontend
        formatted_data = []
        for p in patients:
            formatted_data.append({
                "reg_no": p['reg_no'],
                "name": p['name'] or "Unknown Patient",
                "phone": p['phone'] or "-",
                "due_amount": float(p['due_amount'] or 0)
            })
            
        return jsonify({"data": formatted_data}), 200
    except Exception as e:
        print(f"Error fetching patients: {e}")
        return jsonify({"error": str(e)}), 500


@op_ip_due_collection_bp.route('/details', methods=['GET'])
@jwt_required()
def get_details():
    try:
        reg_no = request.args.get('reg_no')
        if not reg_no:
            return jsonify({"error": "Patient Reg No is required"}), 400

        # Determine type based on reg_no prefix (IP or OP)
        if reg_no.startswith('IP'):
            patient_query = "SELECT id as reg_id, ip_reg_no as reg_no, CONCAT(first_name, ' ', IFNULL(last_name, '')) as name, mobile as phone FROM ip_registrations WHERE ip_reg_no = %s"
            invoice_where = "s.ip_registration_id = %s"
        elif reg_no.startswith('OP'):
            patient_query = "SELECT id as reg_id, opd_reg_no as reg_no, CONCAT(first_name, ' ', IFNULL(last_name, '')) as name, mobile as phone FROM op_registrations WHERE opd_reg_no = %s"
            invoice_where = "s.op_registration_id = %s"
        else:
            # Direct patient
            patient_query = "SELECT NULL as reg_id, %s as reg_no, 'Direct Patient' as name, '' as phone"
            invoice_where = "s.patient_id IS NULL AND s.sale_type = 'Direct' AND %s = 'DIRECT'" # Handle separately if needed

        # 1. Fetch Patient Info
        if reg_no.startswith('IP') or reg_no.startswith('OP'):
            patient_info = query(patient_query, (reg_no,), fetch_one=True)
            if not patient_info:
                return jsonify({"error": "Patient not found"}), 404
            reg_id = patient_info['reg_id']
        else:
            patient_info = {"reg_no": reg_no, "name": "Direct Patient", "phone": "-"}
            reg_id = None

        # 2. Fetch Due Invoices from pharmacy_sales
        if reg_no.startswith('IP') or reg_no.startswith('OP'):
            invoice_sql = f"""
                SELECT 
                    id,
                    sale_no as invoice_no, 
                    DATE_FORMAT(created_at, '%%d-%%m-%%Y %%h:%%i %%p') as date, 
                    (SELECT name FROM users WHERE id = s.created_by) as created_by, 
                    IFNULL(remarks, 'NA') as remarks, 
                    total_amount as amount, 
                    due_amount as due 
                FROM pharmacy_sales s
                WHERE {invoice_where} AND s.due_amount > 0 AND s.status != 'Draft'
                ORDER BY s.id DESC
            """
            invoices = query(invoice_sql, (reg_id,), many=True)
        else:
            invoices = [] # Adjust logic for Direct patients if needed

        return jsonify({
            "patient": patient_info,
            "invoices": invoices or []
        }), 200
        
    except Exception as e:
        print(f"Error fetching details: {e}")
        return jsonify({"error": str(e)}), 500


@op_ip_due_collection_bp.route('/collect', methods=['POST'])
@jwt_required()
def collect_payment():
    try:
        data = request.json
        sale_id = data.get('sale_id') # We will pass the actual ID from frontend
        paid_amount = float(data.get('paid_amount', 0))
        discount_amount = float(data.get('discount_amount', 0))
        payment_mode = data.get('payment_mode')
        remarks = data.get('remarks')
        user_id = get_jwt_identity()

        if paid_amount <= 0 and discount_amount <= 0:
            return jsonify({"error": "Paid or Discount amount must be greater than zero"}), 400

        # 1. Fetch current sale record
        sale = query("SELECT due_amount, paid_amount, discount_amount FROM pharmacy_sales WHERE id = %s", (sale_id,), fetch_one=True)
        if not sale:
            return jsonify({"error": "Invoice not found"}), 404

        current_due = float(sale['due_amount'])
        
        # 2. Calculate new values
        total_reduction = paid_amount + discount_amount
        new_due = max(0, current_due - total_reduction)
        new_paid = float(sale['paid_amount']) + paid_amount
        new_discount = float(sale['discount_amount']) + discount_amount

        # 3. Update pharmacy_sales
        update_sql = """
            UPDATE pharmacy_sales 
            SET due_amount = %s, paid_amount = %s, discount_amount = %s, payment_mode = %s, remarks = CONCAT(IFNULL(remarks, ''), ' | ', %s)
            WHERE id = %s
        """
        query(update_sql, (new_due, new_paid, new_discount, payment_mode, remarks, sale_id), commit=True)

        # Optional: Insert into a pharmacy_sale_payments table if you have one for history
        
        return jsonify({"message": "Payment collected successfully", "new_due": new_due}), 200
    except Exception as e:
        print(f"Error collecting payment: {e}")
        return jsonify({"error": str(e)}), 500