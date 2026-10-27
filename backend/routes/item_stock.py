from flask import Blueprint, request, jsonify
from db import query # Ensure this is your actual DB import

item_stock_bp = Blueprint('item_stock', __name__, url_prefix='/item-stock')

@item_stock_bp.route('/', methods=['GET'])
def get_item_stock():
    try:
        # 1. Get filters from frontend
        item_type = request.args.get('item_type', '')
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        offset = (page - 1) * limit

        # 2. Build the dynamic base query
        # IMPORTANT: Adjust 'pharmacy_stock', 'item_type', 'item_name', etc. to match your actual database table and column names.
        base_query = """
            FROM pharmacy_stock s
            LEFT JOIN pharmacy_items i ON s.item_id = i.id
            WHERE 1=1
        """
        params = []
        
        # Filter by Item Type (e.g., when you click 'KIT')
        if item_type and item_type != '--All--':
            base_query += " AND i.item_type = %s"
            params.append(item_type)
            
        # Filter by Search
        if search:
            base_query += " AND (s.batch_no LIKE %s OR i.name LIKE %s OR s.hsn_code LIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])

        # 3. Get Total Count for Pagination
        count_query = f"SELECT COUNT(*) as total {base_query}"
        count_result = query(count_query, params, fetch_one=True)
        total_records = count_result['total'] if count_result else 0

        # 4. Get Paginated Data
        data_query = f"""
            SELECT 
                s.id,
                s.hsn_code,
                i.name as item_name,
                s.batch_no,
                s.composition,
                s.drug_combination,
                TO_CHAR(s.purchase_date, 'DD-MM-YYYY') as purchase_date,
                TO_CHAR(s.exp_date, 'DD-MM-YYYY') as exp_date,
                s.original_qty,
                s.current_qty,
                s.mrp,
                s.rate,
                s.eff_rate,
                -- Example logic for red/green status based on expiry (adjust as needed)
                CASE 
                    WHEN s.exp_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'red'
                    ELSE 'green'
                END as status
            {base_query}
            ORDER BY s.id DESC
            LIMIT %s OFFSET %s
        """
        data_params = params + [limit, offset]
        rows = query(data_query, data_params, fetch_all=True)

        # 5. Get Totals for Bottom Summary (Based on the filtered query, not just the paginated page)
        summary_query = f"""
            SELECT 
                COALESCE(SUM(s.original_qty), 0) as original_stock,
                COALESCE(SUM(s.current_qty), 0) as current_stock,
                COALESCE(SUM(s.original_qty * s.rate), 0) as original_amount,
                COALESCE(SUM(s.current_qty * s.rate), 0) as current_amount,
                COALESCE(SUM(s.original_qty * s.mrp), 0) as original_rate,
                COALESCE(SUM(s.current_qty * s.mrp), 0) as current_rate
            {base_query}
        """
        summary_data = query(summary_query, params, fetch_one=True)

        # 6. Get Expiry Summary (Example: Only items expiring in the next 90 days)
        expiry_query = f"""
            SELECT 
                COALESCE(SUM(s.original_qty), 0) as original_stock,
                COALESCE(SUM(s.current_qty), 0) as current_stock,
                COALESCE(SUM(s.original_qty * s.rate), 0) as original_amount,
                COALESCE(SUM(s.current_qty * s.rate), 0) as current_amount,
                COALESCE(SUM(s.original_qty * s.mrp), 0) as original_rate,
                COALESCE(SUM(s.current_qty * s.mrp), 0) as current_rate
            {base_query} AND s.exp_date <= CURRENT_DATE + INTERVAL '90 days'
        """
        expiry_summary_data = query(expiry_query, params, fetch_one=True)

        return jsonify({
            "data": rows or [], 
            "total": total_records,
            "summary": summary_data or {}, 
            "expiry_summary": expiry_summary_data or {}
        }), 200

    except Exception as e:
        print(f"Error in item_stock: {str(e)}")
        return jsonify({"error": str(e)}), 500