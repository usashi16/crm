import os
import secrets
import sqlite3
from datetime import date
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, redirect, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import safe_join

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "instance" / "gbtech.sqlite3"
DIST_DIR = BASE_DIR / "dist"  # output of `npm run build`
app = Flask(__name__, static_folder=None)
app.config.update(
    SECRET_KEY=os.environ.get("GBTECH_SECRET_KEY") or secrets.token_urlsafe(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("GBTECH_SECURE_COOKIES", "0") == "1",
)
# Old .html addresses still work for bookmarks and redirect to the React routes
LEGACY_ROUTES = {
    "index.html": "/",
    "admin-login.html": "/admin-login",
    "login.html": "/admin-login",
    "crm.html": "/crm",
}


def get_db():
    if "db" not in g:
        DATABASE.parent.mkdir(exist_ok=True)
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error):
    database = g.pop("db", None)
    if database is not None:
        database.close()


def init_db():
    database = get_db()
    database.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            account_status TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('pending', 'active')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'New',
            value INTEGER NOT NULL DEFAULT 0,
            source TEXT NOT NULL DEFAULT 'Website',
            owner TEXT NOT NULL DEFAULT 'Unassigned',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'On leave', 'Inactive')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            student_number TEXT UNIQUE NOT NULL,
            program TEXT NOT NULL,
            enrollment_status TEXT NOT NULL,
            start_date TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id),
            program TEXT NOT NULL,
            status TEXT NOT NULL,
            submitted_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            assignee TEXT NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Open'
        );
        CREATE TABLE IF NOT EXISTS enquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'New',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    user_columns = {row["name"] for row in database.execute("PRAGMA table_info(users)")}
    if "account_status" not in user_columns:
        database.execute(
            "ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' "
            "CHECK(account_status IN ('pending', 'active'))"
        )
    database.commit()


def bootstrap_admin():
    username = os.environ.get("GBTECH_ADMIN_USERNAME")
    password = os.environ.get("GBTECH_ADMIN_PASSWORD")
    if not username or not password:
        return
    database = get_db()
    existing = database.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing is None:
        database.execute(
            "INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, 'admin', ?, ?)",
            (username, generate_password_hash(password), "GB Tech Administrator", username),
        )
        database.commit()


def row_to_dict(row):
    return dict(row) if row else None


def auth_required(role=None):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if "user_id" not in session:
                return jsonify({"error": "Authentication required"}), 401
            if role and session.get("role") != role:
                return jsonify({"error": "Forbidden"}), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator


def spa_index():
    if not (DIST_DIR / "index.html").exists():
        return (
            "The React front end has not been built yet. Run `npm install` and `npm run build`, "
            "or use `npm run dev` and open http://127.0.0.1:5173.",
            503,
        )
    return send_from_directory(DIST_DIR, "index.html")


@app.get("/")
def home():
    return spa_index()


@app.get("/<path:filename>")
def frontend(filename):
    if filename.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    if filename in LEGACY_ROUTES:
        return redirect(LEGACY_ROUTES[filename])
    route = filename.rstrip("/")
    if route == "crm":
        # The API enforces admin access too; this keeps signed-out visitors off the CRM page
        if "user_id" not in session or session.get("role") != "admin":
            return redirect("/admin-login")
        return spa_index()
    if route == "admin-login":
        return spa_index()
    safe_path = safe_join(str(DIST_DIR), filename)
    if safe_path and Path(safe_path).is_file():
        return send_from_directory(DIST_DIR, filename)
    return "Not found", 404


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "database": str(DATABASE.name)})


@app.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    requested_role = payload.get("role")
    user = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401
    if user["role"] == "student" and user["account_status"] != "active":
        return jsonify({"error": "Your registration is awaiting administrator approval"}), 403
    if requested_role and user["role"] != requested_role:
        return jsonify({"error": "This account is not authorized for this portal"}), 403
    session.clear()
    session.update(user_id=user["id"], role=user["role"], full_name=user["full_name"])
    return jsonify({"user": {"id": user["id"], "role": user["role"], "full_name": user["full_name"]}})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"status": "ok"})


@app.get("/api/auth/me")
def current_user():
    if "user_id" not in session:
        return jsonify({"user": None})
    return jsonify({"user": {"id": session["user_id"], "role": session["role"], "full_name": session["full_name"]}})


@app.get("/api/admin/summary")
@auth_required("admin")
def admin_summary():
    database = get_db()
    lead_count = database.execute("SELECT COUNT(*) AS count FROM leads").fetchone()["count"]
    qualified_count = database.execute("SELECT COUNT(*) AS count FROM leads WHERE status = 'Qualified'").fetchone()["count"]
    revenue = database.execute("SELECT COALESCE(SUM(value), 0) AS total FROM leads").fetchone()["total"]
    employee_count = database.execute("SELECT COUNT(*) AS count FROM employees WHERE status = 'Active'").fetchone()["count"]
    open_tasks = database.execute(
        "SELECT COUNT(*) AS count FROM tasks WHERE lower(status) NOT IN ('completed', 'complete', 'done')"
    ).fetchone()["count"]
    return jsonify({
        "leads": lead_count,
        "qualified": qualified_count,
        "revenue": revenue,
        "employees": employee_count,
        "open_tasks": open_tasks,
    })


@app.get("/api/admin/leads")
@auth_required("admin")
def get_leads():
    query = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    sql = "SELECT * FROM leads WHERE 1=1"
    params = []
    if query:
        sql += " AND (name LIKE ? OR company LIKE ? OR email LIKE ? OR owner LIKE ?)"
        params.extend([f"%{query}%"] * 4)
    if status:
        sql += " AND status = ?"
        params.append(status)
    sql += " ORDER BY id DESC"
    rows = get_db().execute(sql, params).fetchall()
    return jsonify({"leads": [row_to_dict(row) for row in rows]})


@app.post("/api/admin/leads")
@auth_required("admin")
def create_lead():
    payload = request.get_json(silent=True) or {}
    required = ["name", "company", "email", "phone", "owner"]
    if any(not str(payload.get(field, "")).strip() for field in required):
        return jsonify({"error": "Name, company, email, phone, and owner are required"}), 400
    database = get_db()
    cursor = database.execute(
        """INSERT INTO leads (name, company, email, phone, status, value, source, owner)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            payload["name"].strip(), payload["company"].strip(), payload["email"].strip(),
            payload["phone"].strip(), payload.get("status", "New"), int(payload.get("value", 0)),
            payload.get("source", "Website"), payload["owner"].strip(),
        ),
    )
    database.commit()
    lead = database.execute("SELECT * FROM leads WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"lead": row_to_dict(lead)}), 201


@app.delete("/api/admin/leads/<int:lead_id>")
@auth_required("admin")
def delete_lead(lead_id):
    database = get_db()
    database.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    database.commit()
    return jsonify({"status": "ok"})


@app.get("/api/admin/employees")
@auth_required("admin")
def admin_employees():
    rows = get_db().execute("SELECT * FROM employees ORDER BY full_name COLLATE NOCASE").fetchall()
    return jsonify({"employees": [row_to_dict(row) for row in rows]})


@app.post("/api/admin/employees")
@auth_required("admin")
def create_employee():
    payload = request.get_json(silent=True) or {}
    required = ("full_name", "email", "title", "department")
    values = {field: str(payload.get(field, "")).strip() for field in required}
    if any(not values[field] for field in required):
        return jsonify({"error": "Name, email, title, and department are required"}), 400
    if "@" not in values["email"] or any(character.isspace() for character in values["email"]):
        return jsonify({"error": "Enter a valid email address"}), 400
    status = str(payload.get("status", "Active")).strip()
    if status not in {"Active", "On leave", "Inactive"}:
        return jsonify({"error": "Choose a valid employee status"}), 400
    database = get_db()
    try:
        cursor = database.execute(
            """INSERT INTO employees (full_name, email, title, department, phone, status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (*[values[field] for field in required], str(payload.get("phone", "")).strip(), status),
        )
        database.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "An employee with that email already exists"}), 409
    employee = database.execute("SELECT * FROM employees WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"employee": row_to_dict(employee)}), 201


@app.patch("/api/admin/employees/<int:employee_id>")
@auth_required("admin")
def update_employee(employee_id):
    payload = request.get_json(silent=True) or {}
    status = str(payload.get("status", "")).strip()
    if status not in {"Active", "On leave", "Inactive"}:
        return jsonify({"error": "Choose a valid employee status"}), 400
    database = get_db()
    cursor = database.execute("UPDATE employees SET status = ? WHERE id = ?", (status, employee_id))
    if cursor.rowcount == 0:
        return jsonify({"error": "Employee not found"}), 404
    database.commit()
    employee = database.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()
    return jsonify({"employee": row_to_dict(employee)})


@app.get("/api/admin/students")
@auth_required("admin")
def admin_students():
    rows = get_db().execute(
        """SELECT students.*, users.full_name, users.email, users.account_status
           FROM students JOIN users ON users.id = students.user_id ORDER BY students.id DESC"""
    ).fetchall()
    return jsonify({"students": [row_to_dict(row) for row in rows]})


@app.post("/api/admin/students/<int:user_id>/approve")
@auth_required("admin")
def approve_student(user_id):
    database = get_db()
    student = database.execute(
        "SELECT id, account_status FROM users WHERE id = ? AND role = 'student'",
        (user_id,),
    ).fetchone()
    if student is None:
        return jsonify({"error": "Student account not found"}), 404
    if student["account_status"] == "active":
        return jsonify({"error": "Student account is already approved"}), 409
    database.execute(
        "UPDATE users SET account_status = 'active' WHERE id = ? AND role = 'student'",
        (user_id,),
    )
    database.commit()
    return jsonify({"status": "approved"})


@app.get("/api/admin/applications")
@auth_required("admin")
def admin_applications():
    rows = get_db().execute(
        """SELECT applications.*, students.student_number, users.full_name
           FROM applications JOIN students ON students.id = applications.student_id
           JOIN users ON users.id = students.user_id ORDER BY applications.id DESC"""
    ).fetchall()
    return jsonify({"applications": [row_to_dict(row) for row in rows]})


@app.get("/api/admin/tasks")
@auth_required("admin")
def admin_tasks():
    rows = get_db().execute(
        """SELECT * FROM tasks
           ORDER BY CASE WHEN lower(status) IN ('completed', 'complete', 'done') THEN 1 ELSE 0 END,
                    due_date ASC, id DESC"""
    ).fetchall()
    return jsonify({"tasks": [row_to_dict(row) for row in rows]})


@app.post("/api/admin/tasks")
@auth_required("admin")
def create_task():
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    assignee = str(payload.get("assignee", "")).strip()
    due_date = str(payload.get("due_date", "")).strip()
    status = str(payload.get("status", "Open")).strip()
    if not title or not assignee or not due_date:
        return jsonify({"error": "Task, assignee, and due date are required"}), 400
    try:
        date.fromisoformat(due_date)
    except ValueError:
        return jsonify({"error": "Enter a valid due date"}), 400
    if status not in {"Open", "In Progress", "Completed"}:
        return jsonify({"error": "Choose a valid task status"}), 400
    database = get_db()
    cursor = database.execute(
        "INSERT INTO tasks (title, assignee, due_date, status) VALUES (?, ?, ?, ?)",
        (title, assignee, due_date, status),
    )
    database.commit()
    task = database.execute("SELECT * FROM tasks WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"task": row_to_dict(task)}), 201


@app.patch("/api/admin/tasks/<int:task_id>")
@auth_required("admin")
def update_task(task_id):
    payload = request.get_json(silent=True) or {}
    status = str(payload.get("status", "")).strip()
    if status not in {"Open", "In Progress", "Completed"}:
        return jsonify({"error": "Choose a valid task status"}), 400
    database = get_db()
    cursor = database.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404
    database.commit()
    task = database.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return jsonify({"task": row_to_dict(task)})


@app.get("/api/admin/enquiries")
@auth_required("admin")
def admin_enquiries():
    rows = get_db().execute("SELECT * FROM enquiries ORDER BY id DESC").fetchall()
    return jsonify({"enquiries": [row_to_dict(row) for row in rows]})


@app.post("/api/enquiries")
def create_enquiry():
    payload = request.get_json(silent=True) or {}
    required = ["name", "email", "subject", "message"]
    if any(not str(payload.get(field, "")).strip() for field in required):
        return jsonify({"error": "All enquiry fields are required"}), 400
    database = get_db()
    database.execute(
        "INSERT INTO enquiries (name, email, subject, message) VALUES (?, ?, ?, ?)",
        tuple(str(payload[field]).strip() for field in required),
    )
    database.commit()
    return jsonify({"status": "received"}), 201


with app.app_context():
    init_db()
    bootstrap_admin()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), debug=os.environ.get("FLASK_DEBUG") == "1")
