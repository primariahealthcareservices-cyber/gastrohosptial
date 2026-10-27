from flask import Blueprint, request, jsonify
from db import query

vendor_category_bp = Blueprint('vendor_category', __name__, url_prefix='/vendor-category')

@vendor_category_bp.route('/', methods=['GET'])
def get_vendor_categories():
    try:
        # TODO: Implement Database Query Here
        data = []
        return jsonify({"data": data, "message": "Vendor Category API ready"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500