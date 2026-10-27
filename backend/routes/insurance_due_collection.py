from flask import Blueprint, request, jsonify
# from db import query # Uncomment when connecting to DB

insurance_due_collection_bp = Blueprint('insurance_due_collection', __name__, url_prefix='/insurance-due-collection')

# Mock List of Insurances (from your screenshot)
MOCK_INSURANCES = [
    "ADITYA BIRLA INSURANCE", "BAJAJ", "FHPL", "FHPL INSURANCE TPA",
    "GO DIGIT GENERAL INSURANCE", "HEALTH ASSIST TPA", "MANAGEMENT",
    "MEDI ASSIST", "VIDAL TPA"
]

@insurance_due_collection_bp.route('/companies', methods=['GET'])
def get_companies():
    try:
        return jsonify({"data": MOCK_INSURANCES}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@insurance_due_collection_bp.route('/', methods=['GET'])
def get_insurance_dues():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        insurance_name = request.args.get('insurance_name', 'Select')
        
        # TODO: Implement Database Query Here based on dates and insurance_name
        # For now, return mock data so you can see the table
        mock_data = [
            {
                "invoice_no": "INV-INS-001",
                "date": "22-10-2026",
                "patient_name": "Mr. J KRISHNA REDDY",
                "reg_no": "IP10210001032",
                "insurance_name": "ADITYA BIRLA INSURANCE",
                "claim_amount": 15000,
                "due_amount": 1400
            },
            {
                "invoice_no": "INV-INS-002",
                "date": "21-10-2026",
                "patient_name": "Mrs. Sita Devi",
                "reg_no": "OP10210001033",
                "insurance_name": "FHPL",
                "claim_amount": 8000,
                "due_amount": 500
            }
        ]
        
        # Filter logic (if specific insurance selected)
        if insurance_name and insurance_name not in ['Select', '--ALL--']:
            mock_data = [d for d in mock_data if d['insurance_name'] == insurance_name]
            
        return jsonify({"data": mock_data, "message": "Success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500