import time

import pg8000
from flask import Flask, jsonify, request

# Database connection settings (match your db service in docker-compose)
DB_CONFIG = {
    "user": "demo",
    "password": "demo",
    "host": "db",
    "port": 5432,
    "database": "demo",
}

def get_connection():
    """Create a new connection to the Postgres database."""
    return pg8000.connect(
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        host=DB_CONFIG["host"],
        port=DB_CONFIG["port"],
        database=DB_CONFIG["database"],
    )

def init_db(retries=5, delay=2):
    """
    Ensure the 'users' table exists.
    Retry a few times in case the db container is still starting.
    """
    for attempt in range(1, retries + 1):
        try:
            print("Initializing database (attempt " + str(attempt) + ")...", flush=True)
            conn = get_connection()
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL
                );
                """
            )
            conn.commit()
            cur.close()
            conn.close()
            print("Database initialized successfully.", flush=True)
            return
        except Exception as e:
            print("DB init failed: " + str(e), flush=True)
            if attempt == retries:
                print("Giving up on DB init after " + str(retries) + " attempts.", flush=True)
                return
            time.sleep(delay)

app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "api"}), 200

@app.route("/")
def index():
    return "API container on public_net and private_net\n"

@app.route("/users", methods=["GET"])
def get_users():
    """
    Return all users from the database as JSON.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, email FROM users ORDER BY id;")
        rows = cur.fetchall()
        cur.close()
        conn.close()

        users = []
        for row in rows:
            users.append({
                "id": row[0],
                "name": row[1],
                "email": row[2],
            })

        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": "failed to fetch users", "details": str(e)}), 500

@app.route("/users", methods=["POST"])
def create_user():
    """
    Insert a new user into the database.
    Expects JSON: { "name": "...", "email": "..." }
    """
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")

    if not name or not email:
        return jsonify({"error": "name and email are required"}), 400

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING id;",
            (name, email),
        )
        row = cur.fetchone()
        new_id = row[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"id": new_id, "name": name, "email": email}), 201
    except Exception as e:
        return jsonify({"error": "failed to create user", "details": str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000)

