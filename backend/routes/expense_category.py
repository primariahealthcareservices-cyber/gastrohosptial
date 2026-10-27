from flask import Blueprint, request, jsonify
from db import query

expense_category_bp = Blueprint('expense_category', __name__, url_prefix='/expense-category')

@expense_category_bp.route('/', methods=['GET'])
def get_expense_categories():
    try:
        # TODO: Implement Database Query Here
        data = []
        return jsonify({"data": data, "message": "Expense Category API ready"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500