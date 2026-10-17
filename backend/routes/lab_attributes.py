import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query
from utils import log_audit

lab_attributes_bp = Blueprint("lab_attributes", __name__)


def blank_to_none(v):
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


# ---------------- LAB ATTRIBUTES ----------------

@lab_attributes_bp.route("/lab-attributes", methods=["GET"])
@jwt_required()
def list_lab_attributes():
    rows = query("""
        SELECT id, attribute_name, method_name, alias_names,
               is_long_text, suggest_results, options, sub_category_id, is_active
        FROM lab_attributes
        ORDER BY attribute_name
    """, many=True)
    for r in rows:
        if r.get("options"):
            try:
                r["options"] = json.loads(r["options"])
            except Exception:
                r["options"] = []
        else:
            r["options"] = []
    return jsonify(rows)


@lab_attributes_bp.route("/lab-attributes", methods=["POST"])
@jwt_required()
def upsert_lab_attribute():
    d = request.get_json() or {}
    attr_id = d.get("id")
    actor_id = get_jwt_identity()

    attribute_name = (d.get("attribute_name") or "").strip()
    method_name = blank_to_none(d.get("method_name"))
    alias_names = blank_to_none(d.get("alias_names"))
    is_long_text = 1 if d.get("is_long_text") else 0
    suggest_results = 1 if d.get("suggest_results") else 0
    sub_category_id = d.get("sub_category_id") or None

    options = d.get("options") or []
    options_json = json.dumps(options)

    if not attribute_name:
        return jsonify({"error": "Lab-Attribute Name is required"}), 400

    if attr_id:
        query("""
            UPDATE lab_attributes
            SET attribute_name=%s, method_name=%s, alias_names=%s,
                is_long_text=%s, suggest_results=%s, options=%s,
                sub_category_id=%s
            WHERE id=%s
        """, (attribute_name, method_name, alias_names, is_long_text,
              suggest_results, options_json, sub_category_id, attr_id),
        fetch=False, commit=True)
        log_audit(actor_id, "UPDATE_LAB_ATTRIBUTE", "Lab Attribute", attr_id)
        return jsonify({"id": attr_id, "message": "Lab Attribute updated"}), 200

    new_id = query("""
        INSERT INTO lab_attributes
          (attribute_name, method_name, alias_names, is_long_text,
           suggest_results, options, sub_category_id, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
    """, (attribute_name, method_name, alias_names, is_long_text,
          suggest_results, options_json, sub_category_id),
    fetch=False, commit=True)
    log_audit(actor_id, "CREATE_LAB_ATTRIBUTE", "Lab Attribute", new_id)
    return jsonify({"id": new_id, "message": "Lab Attribute created"}), 201


@lab_attributes_bp.route("/lab-attributes/<int:attr_id>", methods=["DELETE"])
@jwt_required()
def delete_lab_attribute(attr_id):
    row = query("SELECT id FROM lab_attributes WHERE id=%s", (attr_id,))
    if not row:
        return jsonify({"error": "Lab Attribute not found"}), 404
    query("DELETE FROM lab_attributes WHERE id=%s", (attr_id,), fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE_LAB_ATTRIBUTE", "Lab Attribute", attr_id)
    return jsonify({"success": True}), 200


# ---------------- SUB-CATEGORIES ----------------

@lab_attributes_bp.route("/lab-attribute-subcategories", methods=["GET"])
@jwt_required()
def list_subcategories():
    rows = query("""
        SELECT id, name
        FROM lab_attribute_subcategories
        ORDER BY name
    """, many=True)
    return jsonify(rows)


@lab_attributes_bp.route("/lab-attribute-subcategories", methods=["POST"])
@jwt_required()
def upsert_subcategory():
    d = request.get_json() or {}
    sc_id = d.get("id")
    name = (d.get("name") or "").strip()
    actor_id = get_jwt_identity()

    if not name:
        return jsonify({"error": "Sub-Category Name is required"}), 400

    if sc_id:
        existing = query("SELECT id FROM lab_attribute_subcategories WHERE id=%s", (sc_id,))
        if not existing:
            return jsonify({"error": "Sub-category not found"}), 404
        query("UPDATE lab_attribute_subcategories SET name=%s WHERE id=%s",
              (name, sc_id), fetch=False, commit=True)
        log_audit(actor_id, "UPDATE_SUBCATEGORY", "Sub-Category", sc_id)
        return jsonify({"id": sc_id, "name": name, "message": "Sub-category updated"}), 200

    dup = query("SELECT id FROM lab_attribute_subcategories WHERE LOWER(name)=LOWER(%s)", (name,))
    if dup:
        return jsonify({"error": "Sub-category already exists"}), 409

    new_id = query("INSERT INTO lab_attribute_subcategories (name) VALUES (%s)",
                   (name,), fetch=False, commit=True)
    log_audit(actor_id, "CREATE_SUBCATEGORY", "Sub-Category", new_id)
    return jsonify({"id": new_id, "name": name, "message": "Sub-category created"}), 201


@lab_attributes_bp.route("/lab-attribute-subcategories/<int:sc_id>", methods=["DELETE"])
@jwt_required()
def delete_subcategory(sc_id):
    row = query("SELECT id FROM lab_attribute_subcategories WHERE id=%s", (sc_id,))
    if not row:
        return jsonify({"error": "Sub-category not found"}), 404
    query("DELETE FROM lab_attribute_subcategories WHERE id=%s", (sc_id,), fetch=False, commit=True)
    log_audit(get_jwt_identity(), "DELETE_SUBCATEGORY", "Sub-Category", sc_id)
    return jsonify({"success": True}), 200