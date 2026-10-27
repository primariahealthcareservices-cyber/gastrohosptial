from flask import Blueprint, request, jsonify
from db import query

pharmacy_expenses_bp = Blueprint('pharmacy_expenses', __name__, url_prefix='/pharmacy-expenses')

@pharmacy_expenses_bp.route('/', methods=['GET'])
def get_pharmacy_expenses():
    try:
        # TODO: Implement Database Query Here
        data = []
        return jsonify({"data": data, "message": "Pharmacy Expenses API ready"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500