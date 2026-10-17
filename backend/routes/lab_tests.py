from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit

lab_tests_bp = Blueprint("lab_tests", __name__)


def blank_to_none(v):
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


def safe_float(val):
    try:
        return float(str(val).strip() or 0)
    except (ValueError, TypeError):
        return 0


# ============================================================
# BASIC CRUD FOR LAB TESTS
# ============================================================

@lab_tests_bp.route("", methods=["GET"])
@jwt_required()
def list_lab_tests():
    search = request.args.get("search", "")
    is_active = request.args.get("is_active")

    sql = """
        SELECT id, test_name, short_name, cost, is_active, created_at, updated_at
        FROM lab_tests
        WHERE 1=1
    """
    params = []

    if search:
        sql += " AND test_name LIKE %s"
        params.append(f"%{search}%")

    if is_active is not None:
        sql += " AND is_active = %s"
        params.append(1 if is_active in ('1', 'true', 'True') else 0)

    sql += " ORDER BY test_name"
    rows = query(sql, tuple(params), many=True)
    return jsonify(rows)


@lab_tests_bp.route("/<int:test_id>", methods=["GET"])
@jwt_required()
def get_lab_test(test_id):
    row = query("SELECT * FROM lab_tests WHERE id=%s", (test_id,))
    if not row:
        return jsonify({"error": "Lab test not found"}), 404
    return jsonify(row)


@lab_tests_bp.route("", methods=["POST"])
@jwt_required()
def upsert_lab_test():
    d = request.get_json() or {}
    test_id = d.get("id")
    actor_id = get_jwt_identity()

    test_name = d.get("test_name", "").strip()
    short_name = blank_to_none(d.get("short_name"))
    cost = safe_float(d.get("cost"))
    is_active = 1 if d.get("is_active") else 0

    if not test_name:
        return jsonify({"error": "Test name is required"}), 400

    if test_id:
        query("""
            UPDATE lab_tests
            SET test_name=%s, short_name=%s, cost=%s, is_active=%s
            WHERE id=%s
        """, (test_name, short_name, cost, is_active, test_id),
        fetch=False, commit=True)
        log_audit(actor_id, "UPDATE_LAB_TEST", "Lab Test", test_id)
        return jsonify({"id": test_id, "message": "Lab test updated"}), 200
    else:
        # Prevent duplicates: if a test with this name already exists,
        # reuse it instead of inserting a second row.
        dup = query(
            "SELECT id FROM lab_tests WHERE LOWER(TRIM(test_name)) = LOWER(TRIM(%s)) LIMIT 1",
            (test_name,),
        )
        if dup:
            # Keep existing short_name / cost unless a real value was sent
            query("""
                UPDATE lab_tests
                SET short_name = COALESCE(%s, short_name),
                    cost = IF(%s > 0, %s, cost),
                    is_active = %s
                WHERE id=%s
            """, (short_name, cost, cost, is_active, dup["id"]),
            fetch=False, commit=True)
            log_audit(actor_id, "UPDATE_LAB_TEST", "Lab Test", dup["id"])
            return jsonify({"id": dup["id"], "message": "Lab test already exists, updated"}), 200

        new_id = query("""
            INSERT INTO lab_tests (test_name, short_name, cost, is_active)
            VALUES (%s, %s, %s, %s)
        """, (test_name, short_name, cost, is_active),
        fetch=False, commit=True)
        log_audit(actor_id, "CREATE_LAB_TEST", "Lab Test", new_id)
        return jsonify({"id": new_id, "message": "Lab test created"}), 201


@lab_tests_bp.route("/<int:test_id>", methods=["DELETE"])
@jwt_required()
def delete_lab_test(test_id):
    row = query("SELECT id FROM lab_tests WHERE id=%s", (test_id,))
    if not row:
        return jsonify({"error": "Lab test not found"}), 404
    query("DELETE FROM lab_tests WHERE id=%s", (test_id,), fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE_LAB_TEST", "Lab Test", test_id)
    return jsonify({"success": True}), 200


# ============================================================
# IMPORT / EXPORT
# ============================================================

@lab_tests_bp.route("/import", methods=["POST"])
@jwt_required()
def import_lab_tests():
    data = request.get_json() or {}
    tests_list = data.get("tests", [])
    if not tests_list:
        return jsonify({"error": "No data provided"}), 400

    actor_id = get_jwt_identity()
    imported = 0
    errors = []

    for idx, row in enumerate(tests_list):
        try:
            test_name = row.get("TEST NAME", "").strip()
            cost = safe_float(row.get("COST"))

            if not test_name:
                errors.append(f"Row {idx+1}: Test name is required")
                continue

            existing = query("SELECT id FROM lab_tests WHERE test_name=%s", (test_name,))
            if existing:
                query("UPDATE lab_tests SET cost=%s WHERE id=%s",
                      (cost, existing["id"]), fetch=False, commit=True)
                imported += 1
            else:
                query("""
                    INSERT INTO lab_tests (test_name, cost, is_active)
                    VALUES (%s, %s, 1)
                """, (test_name, cost), fetch=False, commit=True)
                imported += 1

        except Exception as e:
            errors.append(f"Row {idx+1}: {str(e)}")

    log_audit(actor_id, "IMPORT_LAB_TESTS", "Lab Test", 0, f"Imported {imported} lab tests")
    return jsonify({
        "imported": imported,
        "errors": errors,
        "message": f"Successfully imported {imported} lab tests"
    }), 200


@lab_tests_bp.route("/export", methods=["GET"])
@jwt_required()
def export_lab_tests():
    rows = query("""
        SELECT test_name AS `TEST NAME`,
               cost AS COST,
               IF(is_active=1, 'Active', 'Inactive') AS Status
        FROM lab_tests
        ORDER BY test_name
    """, many=True)
    return jsonify(rows)


# ============================================================
# LAB TEST ATTRIBUTES
# ============================================================

@lab_tests_bp.route("/<int:test_id>/detail", methods=["GET"])
@jwt_required()
def get_test_detail(test_id):
    test = query("SELECT * FROM lab_tests WHERE id=%s", (test_id,))
    if not test:
        return jsonify({"error": "Test not found"}), 404

    # Ordered by the user's drag-and-drop order (sort_order), then id as tiebreaker
    attributes = query("""
        SELECT id, attribute_name, unit, normal_range, is_active, sort_order
        FROM lab_test_attributes
        WHERE lab_test_id=%s
        ORDER BY sort_order ASC, id ASC
    """, (test_id,), many=True)

    test["attributes"] = attributes
    return jsonify(test)


@lab_tests_bp.route("/<int:test_id>/attributes", methods=["POST"])
@jwt_required()
def upsert_attribute(test_id):
    """
    Upsert an attribute for a specific lab test.

    Priority:
      1. If `id` is provided → update that exact row.
      2. Else if a row already exists with the same (lab_test_id, attribute_name)
         → update its unit / normal_range / is_active (no duplicate).
      3. Else → insert a new row (appended at the end of the order).
    """
    d = request.get_json() or {}
    attr_id = d.get("id")
    attribute_name = (d.get("attribute_name") or "").strip()
    unit = (d.get("unit") or "").strip()
    normal_range = (d.get("normal_range") or "").strip()
    is_active = 1 if d.get("is_active", True) else 0

    if not attribute_name:
        return jsonify({"error": "Attribute name is required"}), 400

    test = query("SELECT id FROM lab_tests WHERE id=%s", (test_id,))
    if not test:
        return jsonify({"error": "Test not found"}), 404

    actor = get_jwt_identity()

    # 1) Update by explicit id
    if attr_id:
        existing = query(
            "SELECT id FROM lab_test_attributes WHERE id=%s AND lab_test_id=%s",
            (attr_id, test_id),
        )
        if not existing:
            return jsonify({"error": "Attribute not found for this test"}), 404

        query("""
            UPDATE lab_test_attributes
            SET attribute_name=%s, unit=%s, normal_range=%s, is_active=%s
            WHERE id=%s AND lab_test_id=%s
        """, (attribute_name, unit, normal_range, is_active, attr_id, test_id),
        fetch=False, commit=True)
        log_audit(actor, "UPDATE_ATTRIBUTE", "Lab Test Attribute", attr_id)
        return jsonify({"id": attr_id, "message": "Attribute updated"}), 200

    # 2) Upsert by (test_id, attribute_name)
    existing = query("""
        SELECT id FROM lab_test_attributes
        WHERE lab_test_id=%s
          AND LOWER(TRIM(attribute_name)) = LOWER(TRIM(%s))
        LIMIT 1
    """, (test_id, attribute_name))

    if existing:
        query("""
            UPDATE lab_test_attributes
            SET unit=%s, normal_range=%s, is_active=%s
            WHERE id=%s
        """, (unit, normal_range, is_active, existing["id"]),
        fetch=False, commit=True)
        log_audit(actor, "UPDATE_ATTRIBUTE", "Lab Test Attribute", existing["id"])
        return jsonify({"id": existing["id"], "message": "Attribute updated"}), 200

    # 3) Insert new — put it at the end of the current order
    nxt = query("""
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
        FROM lab_test_attributes
        WHERE lab_test_id=%s
    """, (test_id,))
    next_order = int(nxt["next_order"]) if nxt else 0

    new_id = query("""
        INSERT INTO lab_test_attributes
          (lab_test_id, attribute_name, unit, normal_range, is_active, sort_order)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (test_id, attribute_name, unit, normal_range, is_active, next_order),
    fetch=False, commit=True)
    log_audit(actor, "CREATE_ATTRIBUTE", "Lab Test Attribute", new_id)
    return jsonify({"id": new_id, "message": "Attribute added"}), 201


@lab_tests_bp.route("/<int:test_id>/attributes/reorder", methods=["POST"])
@jwt_required()
def reorder_attributes(test_id):
    """
    Save the drag-and-drop order of a test's attributes.
    Body: { "order": [ { "id": 12, "sort_order": 0 }, { "id": 15, "sort_order": 1 }, ... ] }
    """
    d = request.get_json() or {}
    order = d.get("order")

    if not isinstance(order, list) or not order:
        return jsonify({"error": "order must be a non-empty list"}), 400

    test = query("SELECT id FROM lab_tests WHERE id=%s", (test_id,))
    if not test:
        return jsonify({"error": "Test not found"}), 404

    try:
        for item in order:
            attr_id = int(item["id"])
            sort_order = int(item["sort_order"])
            query("""
                UPDATE lab_test_attributes
                SET sort_order=%s
                WHERE id=%s AND lab_test_id=%s
            """, (sort_order, attr_id, test_id),
            fetch=False, commit=True)
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Each order item needs a numeric id and sort_order"}), 400

    log_audit(get_jwt_identity(), "REORDER_ATTRIBUTES", "Lab Test", test_id)
    return jsonify({"success": True}), 200


@lab_tests_bp.route("/attributes/<int:attr_id>", methods=["DELETE"])
@jwt_required()
def delete_attribute(attr_id):
    row = query("SELECT id FROM lab_test_attributes WHERE id=%s", (attr_id,))
    if not row:
        return jsonify({"error": "Attribute not found"}), 404
    query("DELETE FROM lab_test_attributes WHERE id=%s", (attr_id,),
          fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE_ATTRIBUTE", "Lab Test Attribute", attr_id)
    return jsonify({"success": True}), 200