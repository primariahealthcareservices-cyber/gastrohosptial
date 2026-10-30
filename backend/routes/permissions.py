from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit, role_required
import json

permissions_bp = Blueprint("permissions", __name__)


# ============================================================
# PERMISSION PROFILES
# ============================================================
@permissions_bp.route("/profiles", methods=["GET"])
@jwt_required()
@role_required("super_admin")
def list_profiles():
    rows = query("""
        SELECT id, name, description, permissions, is_active, created_at, updated_at
        FROM permission_profiles
        ORDER BY name
    """, many=True)
    for row in rows:
        if row.get("permissions"):
            try:
                row["permissions"] = json.loads(row["permissions"])
            except Exception:
                row["permissions"] = []
    return jsonify(rows)


@permissions_bp.route("/profiles", methods=["POST"])
@jwt_required()
@role_required("super_admin")
def upsert_profile():
    d = request.get_json() or {}
    profile_id = d.get("id")
    name = d.get("name")
    description = d.get("description")
    permissions = d.get("permissions", [])
    is_active = 1 if d.get("is_active") else 0

    if not name:
        return jsonify({"error": "Profile name is required"}), 400

    permissions_json = json.dumps(permissions) if permissions else "[]"

    if profile_id:
        query("""
            UPDATE permission_profiles
            SET name=%s, description=%s, permissions=%s, is_active=%s
            WHERE id=%s
        """, (name, description, permissions_json, is_active, profile_id),
        fetch=False, commit=True)
        log_audit(get_jwt_identity(), "UPDATE_PROFILE", "Permission Profile", profile_id)
        return jsonify({"id": profile_id, "message": "Profile updated"}), 200
    else:
        new_id = query("""
            INSERT INTO permission_profiles (name, description, permissions, is_active)
            VALUES (%s, %s, %s, %s)
        """, (name, description, permissions_json, is_active),
        fetch=False, commit=True)
        log_audit(get_jwt_identity(), "CREATE_PROFILE", "Permission Profile", new_id)
        return jsonify({"id": new_id, "message": "Profile created"}), 201


@permissions_bp.route("/profiles/<int:profile_id>", methods=["DELETE"])
@jwt_required()
@role_required("super_admin")
def delete_profile(profile_id):
    row = query("SELECT id FROM permission_profiles WHERE id=%s", (profile_id,))
    if not row:
        return jsonify({"error": "Profile not found"}), 404
    query("DELETE FROM permission_profiles WHERE id=%s", (profile_id,), fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE_PROFILE", "Permission Profile", profile_id)
    return jsonify({"success": True}), 200


# ============================================================
# MENU TREE — full app coverage
# ============================================================
@permissions_bp.route("/menu", methods=["GET"])
@jwt_required()
def get_menu():
    menu = [
        {
            "label": "Executive",
            "children": [
                {"label": "Dashboard", "path": "/executive/dashboard"},
                {"label": "Billing Modifications", "path": "/executive/billing-modifications"},
                {"label": "Patient Registration", "path": "/executive/patient-registration"},
                {"label": "Appointments", "path": "/executive/appointments"},
                {"label": "Admission", "path": "/executive/admission"},
                {"label": "OP Billing", "path": "/executive/op-billing"},
                {"label": "IP Billing", "path": "/executive/ip-billing"},
                {"label": "Out Patients", "path": "/executive/out-patients"},
                {"label": "In Patients", "path": "/executive/in-patients"},
                {"label": "Patient Records", "path": "/executive/patient-records"},
                {"label": "Direct Services", "path": "/executive/direct-services"},
                {"label": "Room Occupation", "path": "/executive/room-occupation"},
                {"label": "Room Transfer Approval", "path": "/executive/room-transfer-approval"},
                {"label": "Patient Status", "path": "/executive/patient-status"},
                {"label": "IP Advance", "path": "/executive/ip-advance"},
                {"label": "IP Details", "path": "/executive/ip-details"},
                {"label": "IP Lab", "path": "/executive/ip-lab"},
                {"label": "IP Services", "path": "/executive/ip-services"},
                {"label": "IP Procedures", "path": "/executive/ip-procedures"},
                {"label": "Discharge Summary", "path": "/executive/discharge-summary"},
                {"label": "OP Lab", "path": "/executive/op-lab"},
                {"label": "OP Services", "path": "/executive/op-services"},
                {"label": "OP Procedures", "path": "/executive/op-procedures"},
            ]
        },
        {
            "label": "Reports",
            "children": [
                {"label": "IP Lab Reports", "path": "/executive/reports/ip-lab"},
                {"label": "OP Lab Reports", "path": "/executive/reports/op-lab"},
                {"label": "IP Radiology Reports", "path": "/executive/reports/ip-radiology"},
                {"label": "OP Radiology Reports", "path": "/executive/reports/op-radiology"},
            ]
        },
        {
            "label": "Pharmacy",
            "children": [
                {"label": "Pharmacy Dashboard", "path": "/pharmacy/dashboard"},
                {"label": "Inventory Type", "path": "/pharmacy/masters/inventory-type"},
                {"label": "Item Type", "path": "/pharmacy/masters/item-type"},
                {"label": "Manufacturer", "path": "/pharmacy/masters/manufacturer"},
                {"label": "Supplier Master", "path": "/pharmacy/masters/supplier"},
                {"label": "Purchase Order", "path": "/pharmacy/transaction/purchase-order"},
                {"label": "Goods Receive Note", "path": "/pharmacy/transaction/goods-receive-note"},
                {"label": "Stock Adjustments", "path": "/pharmacy/transaction/stock-adjustments"},
                {"label": "Inpatient Sales", "path": "/pharmacy/sales/inpatient"},
                {"label": "Outpatient Sales", "path": "/pharmacy/sales/outpatient"},
                {"label": "Patient Indents", "path": "/pharmacy/sales/patient-indents"},
                {"label": "OT Indents", "path": "/pharmacy/sales/ot-indents"},
                {"label": "Stock", "path": "/pharmacy/stock"},
                {"label": "Total Sales", "path": "/pharmacy/reports/total-sales"},
                {"label": "Due Received", "path": "/pharmacy/reports/due-received"},
                {"label": "Sales Returns", "path": "/pharmacy/reports/sales-returns"},
                {"label": "OP/IP Sales", "path": "/pharmacy/reports/op-ip-sales"},
                {"label": "OP/IP Due", "path": "/pharmacy/reports/op-ip-due"},
                {"label": "Pharmacy Due", "path": "/pharmacy/reports/pharmacy-due"},
                {"label": "Schedule Item", "path": "/pharmacy/reports/schedule-item"},
                {"label": "Purchasewise Item", "path": "/pharmacy/reports/purchasewise-item"},
                {"label": "Employee Sales", "path": "/pharmacy/reports/employee-sales"},
                {"label": "Sales", "path": "/pharmacy/reports/sales"},
                {"label": "New Sales", "path": "/pharmacy/reports/new-sales"},
                {"label": "Product Wise Sales", "path": "/pharmacy/reports/product-wise-sales"},
                {"label": "GRN Report", "path": "/pharmacy/reports/grn"},
                {"label": "GRN Adjustment", "path": "/pharmacy/reports/grn-adjustment"},
                {"label": "Profit Report", "path": "/pharmacy/reports/profit"},
                {"label": "Purchase Payments", "path": "/pharmacy/reports/purchase-payments"},
                {"label": "Stock Returns", "path": "/pharmacy/reports/stock-returns"},
                {"label": "Supplier Wise Purchase", "path": "/pharmacy/reports/supplier-wise-purchase"},
                {"label": "GRN Wise Purchase", "path": "/pharmacy/reports/grn-wise-purchase"},
                {"label": "OT Indents Report", "path": "/pharmacy/reports/ot-indents"},
                {"label": "Doctor Sales", "path": "/pharmacy/reports/doctor-sales"},
                {"label": "Doctor Wise Item Sales", "path": "/pharmacy/reports/doctor-wise-item-sales"},
                {"label": "Patient Wise Sale", "path": "/pharmacy/reports/patient-wise-sale"},
                {"label": "Item Wise Sale", "path": "/pharmacy/reports/item-wise-sale"},
                {"label": "Invoice Tax", "path": "/pharmacy/reports/invoice-tax"},
                {"label": "Stock Adjustment", "path": "/pharmacy/reports/stock-adjustment"},
                {"label": "Non Moving Stock", "path": "/pharmacy/reports/non-moving-stock"},
                {"label": "Minimum Stock", "path": "/pharmacy/reports/minimum-stock"},
                {"label": "Supplier Wise Item Purchase", "path": "/pharmacy/reports/supplier-wise-item-purchase"},
                {"label": "Invoice Status", "path": "/pharmacy/reports/invoice-status"},
                {"label": "Item Sale Tax", "path": "/pharmacy/reports/item-sale-tax"},
                {"label": "User Wise Discount", "path": "/pharmacy/reports/user-wise-discount"},
                {"label": "GRN Wise Sales", "path": "/pharmacy/reports/grn-wise-sales"},
                {"label": "Stock Ledger", "path": "/pharmacy/reports/stock-ledger"},
            ]
        },
        {
            "label": "Lab",
            "children": [
                {"label": "Lab Dashboard", "path": "/lab/dashboard"},
                {"label": "OP Reports", "path": "/lab/op-reports"},
                {"label": "IP Reports", "path": "/lab/ip-reports"},
            ]
        },
        {
            "label": "Super Admin",
            "children": [
                {"label": "User Management", "path": "/superadmin/users"},
                {"label": "Discount & Permissions", "path": "/superadmin/discount-permissions"},
                {"label": "Permission Profiles", "path": "/superadmin/permission-profiles"},
                {"label": "Doctors", "path": "/superadmin/doctors"},
                {"label": "Lab Tests", "path": "/superadmin/lab-tests"},
                {"label": "Bulk Import", "path": "/superadmin/bulk-import"},
            ]
        },
    ]
    return jsonify(menu)