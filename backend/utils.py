from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity


def current_user_permissions():
    """
    Return the list of permission paths for the current JWT identity.
    Super admin → ['*'] (wildcard = full access).
    Returns None if the user no longer exists.
    """
    from db import query
    import json as _json

    uid = get_jwt_identity()
    row = query("SELECT role, permissions FROM users WHERE id=%s", (uid,), many=False)
    if not row:
        return None
    if row.get("role") == "super_admin":
        return ["*"]
    raw = row.get("permissions")
    if not raw:
        return []
    try:
        val = _json.loads(raw) if isinstance(raw, (str, bytes)) else raw
        return val if isinstance(val, list) else []
    except Exception:
        return []


def permission_required(*prefixes):
    """
    Usage:
        @permission_required("/pharmacy")
        @permission_required("/pharmacy/sales", "/pharmacy/reports")
        @permission_required("/executive")
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            perms = current_user_permissions()
            if perms is None:
                return jsonify({"error": "User not found"}), 401
            if "*" in perms:
                return fn(*args, **kwargs)
            ok = False
            for p in prefixes:
                p = p.rstrip("/")
                if any(perm == p or perm.startswith(p + "/") for perm in perms):
                    ok = True
                    break
            if not ok:
                return jsonify({
                    "error": "Forbidden: missing permission for this page",
                    "required": list(prefixes),
                    "path": request.path,
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------- code generation ----------

def next_code(prefix, table, column):
    """
    Return the next sequential code for `table`.`column` with the given prefix.
    e.g. next_code("PT", "patients", "patient_uid") -> "PT000002"

    Uses SQL to extract only the numeric part, ensuring accurate max calculations
    even if existing codes have different padding (like PT001 vs PT000001).
    """
    from db import query

    # Use MySQL's SUBSTRING to remove the prefix characters and cast the rest to integer
    # This handles 'PT001', 'PT000001', 'PT1' all as the same numeric base (1)
    sql = f"""
        SELECT MAX(CAST(SUBSTRING({column}, %s) AS UNSIGNED)) AS max_num
        FROM {table}
        WHERE {column} LIKE %s
    """
    # Prefix length + 1 (because MySQL SUBSTRING is 1-indexed)
    prefix_len = len(prefix) + 1
    like_pattern = f"{prefix}%"

    row = query(sql, (prefix_len, like_pattern), many=False)
    
    max_num = 0
    if row and row.get("max_num") is not None:
        max_num = int(row["max_num"])

    # Generate the new code padded to 6 digits
    return f"{prefix}{max_num + 1:06d}"


# ---------- audit trail ----------
def log_audit(user_id, action, entity=None, entity_id=None, details=None):
    """
    Insert a row into audit_logs.
    """
    from db import query
    import json as _json

    if details is not None and not isinstance(details, str):
        details = _json.dumps(details, default=str)

    try:
        query(
            "INSERT INTO audit_logs (user_id, action, module, reference_id, reason) "
            "VALUES (%s, %s, %s, %s, %s)",
            (user_id, action, entity or "General", entity_id, details),
            fetch=False,
            commit=True,
        )
    except Exception as e:
        # Auditing must never break the main request
        print(f"[AUDIT LOG FAILED] {e}")


def role_required(*roles):
    """Allow only users whose JWT 'role' claim is in `roles`."""
    if len(roles) == 1 and isinstance(roles[0], (list, tuple, set)):
        allowed = set(roles[0])
    else:
        allowed = set(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if get_jwt().get("role") not in allowed:
                return jsonify({
                    "error": "Forbidden: insufficient role",
                    "required": sorted(allowed),
                    "path": request.path,
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator