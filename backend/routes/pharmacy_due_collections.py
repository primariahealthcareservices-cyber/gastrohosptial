from flask import Blueprint, request, jsonify
from db import query

pharmacy_due_collections_bp = Blueprint('pharmacy_due_collections', __name__, url_prefix='/pharmacy-due-collections')

# ==========================================
# 1. COMPANY DUE COLLECTION
# ==========================================
@pharmacy_due_collections_bp.route('/company', methods=['GET'])
def get_company_due_collections():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        company_name = request.args.get('company_name', 'All')
        
        # TODO: Replace with your actual SQL query for Company Dues
        # Example:
        # sql = """
        #     SELECT c.id, c.company_name, s.invoice_no, s.total_amount, s.due_amount 
        #     FROM pharmacy_sales s
        #     JOIN companies c ON c.id = s.company_id
        #     WHERE DATE(s.created_at) BETWEEN %s AND %s
        # """
        # params = [start_date, end_date]
        # if company_name != 'All':
        #     sql += " AND c.company_name = %s"
        #     params.append(company_name)
        # data = query(sql, tuple(params), fetch=True, many=True)

        data = [] # Placeholder until you add the SQL
        return jsonify({"data": data, "message": "Company Due Collection API ready"}), 200
    except Exception as e:
        print("DB Error Company Dues:", str(e))
        return jsonify({"data": [], "error": str(e)}), 500


# ==========================================
# 2. IP / OP DUE COLLECTION
# ==========================================
@pharmacy_due_collections_bp.route('/op-ip', methods=['GET'])
def get_op_ip_due_collections():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # TODO: Replace with your actual SQL query for OP/IP Dues
        # Example:
        # sql = """
        #     SELECT s.id, p.name AS patient_name, s.sale_type, s.invoice_no, 
        #            s.total_amount, s.due_amount 
        #     FROM pharmacy_sales s
        #     LEFT JOIN patients p ON p.id = s.patient_id
        #     WHERE DATE(s.created_at) BETWEEN %s AND %s
        #       AND s.due_amount > 0
        # """
        # data = query(sql, (start_date, end_date), fetch=True, many=True)

        data = [] # Placeholder until you add the SQL
        return jsonify({"data": data, "message": "IP / OP Due Collection API ready"}), 200
    except Exception as e:
        print("DB Error OP/IP Dues:", str(e))
        return jsonify({"data": [], "error": str(e)}), 500


# ==========================================
# 3. INSURANCE DUE COLLECTION
# ==========================================
@pharmacy_due_collections_bp.route('/insurance', methods=['GET'])
def get_insurance_due_collections():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # TODO: Replace with your actual SQL query for Insurance Dues
        # Example:
        # sql = """
        #     SELECT i.id, p.name AS patient_name, i.claim_no, 
        #            i.total_claim, i.due_amount 
        #     FROM insurance_claims i
        #     LEFT JOIN patients p ON p.id = i.patient_id
        #     WHERE DATE(i.created_at) BETWEEN %s AND %s
        # """
        # data = query(sql, (start_date, end_date), fetch=True, many=True)

        data = [] # Placeholder until you add the SQL
        return jsonify({"data": data, "message": "Insurance Due Collection API ready"}), 200
    except Exception as e:
        print("DB Error Insurance Dues:", str(e))
        return jsonify({"data": [], "error": str(e)}), 500