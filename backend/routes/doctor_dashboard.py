from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from db import query
from utils import role_required

doctor_dashboard_bp = Blueprint("doctor_dashboard", __name__)


def _resolve_doctor_id():
    """Doctors see their own data. Admin/super_admin pick one via ?doctor_id=."""
    if get_jwt().get("role") in ("admin", "super_admin"):
        return request.args.get("doctor_id", type=int)
    row = query("SELECT doctor_id FROM users WHERE id=%s", (get_jwt_identity(),))
    return row["doctor_id"] if row else None


@doctor_dashboard_bp.route("/overview", methods=["GET"])
@jwt_required()
@role_required("doctor", "admin", "super_admin")
def overview():
    doctor_id = _resolve_doctor_id()
    if not doctor_id:
        return jsonify({"linked": False}), 200

    doctor = query(
        """
        SELECT d.id, d.name, d.specialization, dep.name AS department
        FROM doctors d LEFT JOIN departments dep ON dep.id = d.department_id
        WHERE d.id=%s
        """,
        (doctor_id,),
    )
    if not doctor:
        return jsonify({"linked": False}), 200

    a = query(
        """
        SELECT COUNT(*) AS total,
               SUM(status='Completed') AS completed,
               SUM(status='Booked') AS waiting,
               SUM(status='Cancelled') AS cancelled
        FROM appointments
        WHERE doctor_id=%s AND appointment_date=CURDATE()
        """,
        (doctor_id,),
    ) or {}
    cancelled = int(a.get("cancelled") or 0)

    ip = query(
        """
        SELECT COUNT(*) AS admitted, SUM(admitted_date=CURDATE()) AS today
        FROM ip_registrations
        WHERE doctor_id=%s AND status='Admitted'
        """,
        (doctor_id,),
    ) or {}

    appointments = query(
        """
        SELECT a.id, a.appointment_no, a.token_no, a.time_slot, a.visit_type, a.status,
               p.id AS patient_id, p.name AS patient_name, p.patient_uid AS mr_number,
               p.age, p.gender
        FROM appointments a
        JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id=%s AND a.appointment_date=CURDATE()
        ORDER BY a.token_no, a.time_slot
        """,
        (doctor_id,),
        many=True,
    )

    admitted = query(
        """
        SELECT r.id, r.ip_reg_no, CONCAT(r.first_name,' ',IFNULL(r.last_name,'')) AS name,
               r.age, r.gender, r.room_type, r.room_no, r.bed_no, r.symptoms,
               DATE_FORMAT(r.admitted_date, '%%d %%b %%Y') AS admitted_on,
               r.patient_id
        FROM ip_registrations r
        WHERE r.doctor_id=%s AND r.status='Admitted'
        ORDER BY r.admitted_date DESC
        LIMIT 50
        """,
        (doctor_id,),
        many=True,
    )

    rows = query(
        """
        SELECT DATE_FORMAT(appointment_date, '%%Y-%%m-%%d') AS d, COUNT(*) AS c
        FROM appointments
        WHERE doctor_id=%s AND status<>'Cancelled'
          AND appointment_date >= CURDATE() - INTERVAL 6 DAY
        GROUP BY appointment_date
        """,
        (doctor_id,),
        many=True,
    )
    counts = {r["d"]: int(r["c"]) for r in rows}
    today = date.today()
    per_day = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        per_day.append({"day": day.strftime("%d %b"), "count": counts.get(day.isoformat(), 0)})

    return jsonify({
        "linked": True,
        "doctor": doctor,
        "summary": {
            "appointments_today": int(a.get("total") or 0) - cancelled,
            "completed": int(a.get("completed") or 0),
            "waiting": int(a.get("waiting") or 0),
            "cancelled": cancelled,
            "admitted_ip": int(ip.get("admitted") or 0),
            "ip_admissions_today": int(ip.get("today") or 0),
        },
        "appointments": appointments,
        "admitted": admitted,
        "appointments_per_day": per_day,
    })