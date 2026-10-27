from flask import Blueprint, request, jsonify
from db import query

pharmacy_duplicate_invoice_bp = Blueprint('pharmacy_duplicate_invoice', __name__, url_prefix='/pharmacy-duplicate-invoice')

# ==========================================
# LIST ENDPOINTS
# ==========================================

@pharmacy_duplicate_invoice_bp.route('/op', methods=['GET'])
def get_op_invoices():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search', '')

        # Use COALESCE to grab patient details from op_registrations, then fallback to patients table
        sql = """
            SELECT 
                s.id, 
                COALESCE(op.first_name, p.name) AS patient_name, 
                s.sale_no AS invoice_no, 
                COALESCE(op.mobile, p.phone) AS mobile, 
                u.name AS created_by_name, 
                s.created_at, 
                s.net_amount AS total_amount, 
                s.remarks
            FROM pharmacy_sales s
            LEFT JOIN op_registrations op ON op.id = s.op_registration_id
            LEFT JOIN patients p ON p.id = s.patient_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.sale_type = 'OP' 
              AND DATE(s.created_at) BETWEEN %s AND %s
        """
        params = [start_date, end_date]

        if search:
            sql += " AND (COALESCE(op.first_name, p.name) LIKE %s OR s.sale_no LIKE %s OR COALESCE(op.mobile, p.phone) LIKE %s)"
            search_term = f'%{search}%'
            params.extend([search_term, search_term, search_term])

        sql += " ORDER BY s.created_at DESC"
        
        data = query(sql, tuple(params), fetch=True, many=True)
        return jsonify({"data": data}), 200
    except Exception as e:
        print("DB Error OP List:", str(e))
        return jsonify({"data": [], "error": str(e)}), 500


@pharmacy_duplicate_invoice_bp.route('/ip', methods=['GET'])
def get_ip_invoices():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search', '')

        # Use COALESCE to grab patient details from ip_registrations, then fallback to patients table
        sql = """
            SELECT 
                s.id, 
                COALESCE(ip.first_name, p.name) AS patient_name, 
                s.sale_no AS invoice_no, 
                COALESCE(ip.mobile, p.phone) AS mobile, 
                u.name AS created_by_name, 
                s.created_at, 
                s.net_amount AS total_amount, 
                s.remarks
            FROM pharmacy_sales s
            LEFT JOIN ip_registrations ip ON ip.id = s.ip_registration_id
            LEFT JOIN patients p ON p.id = s.patient_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.sale_type = 'IP' 
              AND DATE(s.created_at) BETWEEN %s AND %s
        """
        params = [start_date, end_date]

        if search:
            sql += " AND (COALESCE(ip.first_name, p.name) LIKE %s OR s.sale_no LIKE %s OR COALESCE(ip.mobile, p.phone) LIKE %s)"
            search_term = f'%{search}%'
            params.extend([search_term, search_term, search_term])

        sql += " ORDER BY s.created_at DESC"
        
        data = query(sql, tuple(params), fetch=True, many=True)
        return jsonify({"data": data}), 200
    except Exception as e:
        print("DB Error IP List:", str(e))
        return jsonify({"data": [], "error": str(e)}), 500


@pharmacy_duplicate_invoice_bp.route('/returns', methods=['GET'])
def get_return_invoices():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search', '')

        sql = """
            SELECT 
                s.id, 
                COALESCE(op.first_name, ip.first_name, p.name) AS patient_name, 
                s.sale_no AS invoice_no, 
                COALESCE(op.mobile, ip.mobile, p.phone) AS mobile, 
                u.name AS created_by_name, 
                s.created_at, 
                s.net_amount AS total_amount, 
                s.remarks
            FROM pharmacy_sales s
            LEFT JOIN op_registrations op ON op.id = s.op_registration_id
            LEFT JOIN ip_registrations ip ON ip.id = s.ip_registration_id
            LEFT JOIN patients p ON p.id = s.patient_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE (s.sale_type = 'Return' OR s.net_amount < 0) 
              AND DATE(s.created_at) BETWEEN %s AND %s
        """
        params = [start_date, end_date]

        if search:
            sql += " AND (COALESCE(op.first_name, ip.first_name, p.name) LIKE %s OR s.sale_no LIKE %s OR COALESCE(op.mobile, ip.mobile, p.phone) LIKE %s)"
            search_term = f'%{search}%'
            params.extend([search_term, search_term, search_term])

        sql += " ORDER BY s.created_at DESC"
        
        data = query(sql, tuple(params), fetch=True, many=True)
        return jsonify({"data": data}), 200
    except Exception as e:
        print("DB Error Returns List:", str(e))
        return jsonify({"data": [], "error": str(e)}), 500


# ==========================================
# DETAILS ENDPOINTS
# ==========================================

@pharmacy_duplicate_invoice_bp.route('/op/details', methods=['GET'])
def get_op_details():
    try:
        invoice_id = request.args.get('invoice_id')

        items_sql = """
            SELECT 
                i.item_name AS medicine_name,
                i.batch_no,
                '-' AS expiry,
                i.qty,
                i.mrp AS rate,
                i.amount
            FROM pharmacy_sale_items i
            WHERE i.sale_id = %s
        """
        items = query(items_sql, (invoice_id,), fetch=True, many=True) or []
        
        header_sql = """
            SELECT 
                s.sale_no AS invoice_no, 
                COALESCE(op.first_name, p.name) AS patient_name, 
                COALESCE(op.mobile, p.phone) AS mobile, 
                u.name AS created_by_name, 
                s.created_at, 
                s.net_amount AS total_amount,
                s.discount_amount,
                s.total_amount AS gross_total
            FROM pharmacy_sales s
            LEFT JOIN op_registrations op ON op.id = s.op_registration_id
            LEFT JOIN patients p ON p.id = s.patient_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.id = %s
        """
        header = query(header_sql, (invoice_id,), fetch=True, many=False) or {}
        
        if header:
            header['patient_name'] = header.get('patient_name') or 'Unknown Patient'
            header['mobile'] = header.get('mobile') or 'N/A'
            header['items'] = items
        else:
            header = {'items': []}
        
        return jsonify({"data": header}), 200
    except Exception as e:
        print("DB Error OP Details:", str(e))
        return jsonify({"error": str(e)}), 500


@pharmacy_duplicate_invoice_bp.route('/ip/details', methods=['GET'])
def get_ip_details():
    try:
        invoice_id = request.args.get('invoice_id')

        items_sql = """
            SELECT 
                i.item_name AS medicine_name,
                i.batch_no,
                '-' AS expiry,
                i.qty,
                i.mrp AS rate,
                i.amount
            FROM pharmacy_sale_items i
            WHERE i.sale_id = %s
        """
        items = query(items_sql, (invoice_id,), fetch=True, many=True) or []
        
        header_sql = """
            SELECT 
                s.sale_no AS invoice_no, 
                COALESCE(ip.first_name, p.name) AS patient_name, 
                COALESCE(ip.mobile, p.phone) AS mobile, 
                u.name AS created_by_name, 
                s.created_at, 
                s.net_amount AS total_amount,
                s.discount_amount,
                s.total_amount AS gross_total
            FROM pharmacy_sales s
            LEFT JOIN ip_registrations ip ON ip.id = s.ip_registration_id
            LEFT JOIN patients p ON p.id = s.patient_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.id = %s
        """
        header = query(header_sql, (invoice_id,), fetch=True, many=False) or {}
        
        if header:
            header['patient_name'] = header.get('patient_name') or 'Unknown Patient'
            header['mobile'] = header.get('mobile') or 'N/A'
            header['items'] = items
        else:
            header = {'items': []}
        
        return jsonify({"data": header}), 200
    except Exception as e:
        print("DB Error IP Details:", str(e))
        return jsonify({"error": str(e)}), 500


@pharmacy_duplicate_invoice_bp.route('/returns/details', methods=['GET'])
def get_return_details():
    try:
        invoice_id = request.args.get('invoice_id')

        items_sql = """
            SELECT 
                i.item_name AS medicine_name,
                i.batch_no,
                '-' AS expiry,
                i.qty,
                i.mrp AS rate,
                i.amount
            FROM pharmacy_sale_items i
            WHERE i.sale_id = %s
        """
        items = query(items_sql, (invoice_id,), fetch=True, many=True) or []
        
        header_sql = """
            SELECT 
                s.sale_no AS invoice_no, 
                COALESCE(op.first_name, ip.first_name, p.name) AS patient_name, 
                COALESCE(op.mobile, ip.mobile, p.phone) AS mobile, 
                u.name AS created_by_name, 
                s.created_at, 
                s.net_amount AS total_amount,
                s.discount_amount,
                s.total_amount AS gross_total
            FROM pharmacy_sales s
            LEFT JOIN op_registrations op ON op.id = s.op_registration_id
            LEFT JOIN ip_registrations ip ON ip.id = s.ip_registration_id
            LEFT JOIN patients p ON p.id = s.patient_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.id = %s
        """
        header = query(header_sql, (invoice_id,), fetch=True, many=False) or {}
        
        if header:
            header['patient_name'] = header.get('patient_name') or 'Unknown Patient'
            header['mobile'] = header.get('mobile') or 'N/A'
            header['items'] = items
        else:
            header = {'items': []}
        
        return jsonify({"data": header}), 200
    except Exception as e:
        print("DB Error Returns Details:", str(e))
        return jsonify({"error": str(e)}), 500


# ==========================================
# UPDATE ENDPOINT
# ==========================================

@pharmacy_duplicate_invoice_bp.route('/update', methods=['POST'])
def update_invoice():
    try:
        data = request.get_json()
        invoice_id = data.get('invoice_id')
        discount_amount = data.get('discount_amount', 0)
        payment_mode = data.get('payment_mode', 'Cash')
        net_amount = data.get('net_amount')

        # Update the pharmacy_sales table
        sql = """
            UPDATE pharmacy_sales 
            SET discount_amount = %s, 
                net_amount = %s, 
                payment_mode = %s 
            WHERE id = %s
        """
        query(sql, (discount_amount, net_amount, payment_mode, invoice_id), fetch=False, commit=True)
        
        return jsonify({"message": "Invoice updated successfully"}), 200
    except Exception as e:
        print("DB Error Update:", str(e))
        return jsonify({"error": str(e)}), 500