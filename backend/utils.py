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
    row = query("SELECT role, permissions FROM users WHERE id=%s", (uid,))
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

    A user has access if any of their stored permission paths
    equals a prefix OR starts with `prefix + "/"`.
    Super admin (permissions == ['*']) always passes.
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
    e.g. next_code("PT", "patients", "patient_uid") -> "PT001"

    Scans existing values matching '<prefix>%', extracts the numeric suffix,
    and returns prefix + (max + 1), zero-padded to 3 digits (or wider if
    existing codes are already wider than 3 digits).
    """
    from db import query

    rows = query(
        f"SELECT {column} AS c FROM {table} WHERE {column} LIKE %s",
        (f"{prefix}%",),
    ) or []

    max_n = 0
    width = 3
    for r in rows:
        raw = (r.get("c") if isinstance(r, dict) else r[0]) or ""
        digits = "".join(ch for ch in str(raw) if ch.isdigit())
        if digits:
            n = int(digits)
            if n > max_n:
                max_n = n
            if len(digits) > width:
                width = len(digits)
    return f"{prefix}{max_n + 1:0{width}d}"


# ---------- audit trail ----------
def log_audit(user_id, action, entity=None, entity_id=None, details=None):
    """
    Insert a row into audit_logs.

    Callers pass: (user_id, action, entity, entity_id[, details])
    Mapped to table columns: entity -> module, entity_id -> reference_id,
    details -> reason.
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