import os
import traceback
from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
import importlib

DEBUG = os.getenv("FLASK_ENV", "development") == "development"


# ============================================================
# Safe blueprint loader
# ============================================================
def _load_blueprint(module_name, bp_name, prefix, required=False):
    """
    Import a blueprint module safely.

    - If the module or the blueprint attribute is missing:
        * required=True  → raise (so you know a critical file is gone)
        * required=False → print [SKIP] and return None
    - Otherwise return (blueprint, prefix)
    """
    try:
        mod = importlib.import_module(module_name)
    except ModuleNotFoundError as e:
        if required:
            raise
        print(f"[SKIP] Missing module: {module_name}  ({e})")
        return None
    try:
        bp = getattr(mod, bp_name)
    except AttributeError as e:
        if required:
            raise
        print(f"[SKIP] Module '{module_name}' has no attribute '{bp_name}'  ({e})")
        return None
    return (bp, prefix)


# ============================================================
# Blueprint manifest
# ============================================================
# required=True  → Flask will crash loudly if it's missing (fix the file)
# required=False → Flask will print [SKIP] and continue

BLUEPRINTS = [
    # ---- core, must exist ----
    ("routes.auth",                       "auth_bp",                       "/api/auth",                       True),
    ("routes.patients",                   "patients_bp",                   "/api/patients",                   True),
    ("routes.appointments",               "appointments_bp",               "/api/appointments",               True),
    ("routes.dashboard",                  "dashboard_bp",                  "/api/dashboard",                  True),
    ("routes.op_billing",                 "op_billing_bp",                 "/api/op-billing",                 True),
    ("routes.ip_billing",                 "ip_billing_bp",                 "/api/ip-billing",                 True),
    ("routes.admissions",                 "admissions_bp",                 "/api/admissions",                 True),
    ("routes.billing_management",         "billing_mgmt_bp",               "/api/billing-management",         True),
    ("routes.reports",                    "reports_bp",                    "/api/reports",                    True),
    ("routes.users",                      "users_bp",                      "/api/users",                      True),
    ("routes.permissions",                "permissions_bp",                "/api/permissions",                True),
    ("routes.ip_registrations",           "ip_reg_bp",                     "/api/ip-registrations",           True),
    ("routes.op_registrations",           "op_reg_bp",                     "/api/op-registrations",           True),
    ("routes.patient_overview",           "patient_overview_bp",           "/api/patient-overview",           True),

    # ---- everything else, optional ----
    ("routes.doctors",                    "doctors_bp",                    "/api/doctors",                    False),
    ("routes.departments",                "departments_bp",                "/api/departments",                False),
    ("routes.referral_doctors",           "referral_doctors_bp",           "/api/referral-doctors",           False),
    ("routes.patient_records",            "patient_records_bp",            "/api/patient-records",            False),
    ("routes.room_occupancy",             "room_occupancy_bp",             "/api/room-occupancy",             False),
    ("routes.direct_services",            "direct_services_bp",            "/api/direct-services",            False),
    ("routes.catalog",                    "catalog_bp",                    "/api/catalog",                    False),
    ("routes.pharmacy_items",             "pharmacy_items_bp",             "/api/pharmacy-items",             False),
    ("routes.pharmacy_sales",             "pharmacy_sales_bp",             "/api/pharmacy-sales",             False),
    ("routes.patient_indents",            "patient_indents_bp",            "/api/patient-indents",            False),
    ("routes.ot_indents",                 "ot_indents_bp",                 "/api/ot-indents",                 False),
    ("routes.advance_payments",           "advance_payments_bp",           "/api/advance-payments",           False),
    ("routes.ip_lab",                     "ip_lab_bp",                     "/api/ip-lab",                     False),
    ("routes.ip_services",                "ip_services_bp",                "/api/ip-services",                False),
    ("routes.ip_procedures",              "ip_procedures_bp",              "/api/ip-procedures",              False),
    ("routes.discharge_summary",          "discharge_summary_bp",          "/api/discharge-summary",          False),
    ("routes.op_lab",                     "op_lab_bp",                     "/api/op-lab",                     False),
    ("routes.op_services",                "op_services_bp",                "/api/op-services",                False),
    ("routes.op_procedures",              "op_procedures_bp",              "/api/op-procedures",              False),
    ("routes.grn",                        "grn_bp",                        "/api/grn",                        False),
    ("routes.stock_adjustments",          "stock_adj_bp",                  "/api/stock-adjustments",          False),
    ("routes.suppliers",                  "suppliers_bp",                  "/api/suppliers",                  False),
    ("routes.lab_reports",                "lab_reports_bp",                "/api/lab-reports",                False),
    ("routes.lab_tests",                  "lab_tests_bp",                  "/api/lab-tests",                  False),
    ("routes.bulk_import",                "bulk_import_bp",                "/api/superadmin",                 False),
    ("routes.manufacturers",              "manufacturers_bp",              "/api/manufacturers",              False),
    ("routes.purchase_orders",            "purchase_orders_bp",            "/api/purchase-orders",            False),
    ("routes.item_stock",                 "item_stock_bp",                 "/api/item-stock",                 False),

    # ---- known missing files: keep them here so you can restore later ----
    ("routes.lab_attributes",             "lab_attributes_bp",             "/api",                            False),
    ("routes.pharmacy_inventory_types",   "pharmacy_inventory_types_bp",   "/api/pharmacy/inventory-types",   False),
    ("routes.pharmacy_item_types",        "pharmacy_item_types_bp",        "/api/pharmacy/item-types",        False),
]


def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
    app.config["JWT_SECRET_KEY"] = Config.JWT_SECRET_KEY
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
    app.config["DEBUG"] = DEBUG
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    loaded = 0
    skipped = 0
    missing_required = []

    for module_name, bp_name, prefix, required in BLUEPRINTS:
        try:
            result = _load_blueprint(module_name, bp_name, prefix, required=required)
            if result:
                bp, url_prefix = result
                app.register_blueprint(bp, url_prefix=url_prefix)
                loaded += 1
            else:
                skipped += 1
        except ModuleNotFoundError:
            missing_required.append((module_name, bp_name))

    # If any REQUIRED module is missing, surface a clear message
    if missing_required:
        print("\n===============================================")
        print("CRITICAL: These required route files are missing:")
        for m, b in missing_required:
            print(f"  ✗ {m}  (needs {b})")
        print("Create each missing file under backend/routes/ and restart.")
        print("===============================================\n")
        raise RuntimeError("Required route modules are missing.")

    print(f"\n[OK] {loaded} blueprints loaded, {skipped} optional skipped.\n")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        traceback.print_exc()
        original = getattr(e, "original_exception", e)
        return jsonify({"error": "Internal server error", "detail": str(original)}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=DEBUG, port=5000)