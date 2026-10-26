from flask import Flask, render_template, request, jsonify
import sqlite3
from pathlib import Path
from datetime import date

app = Flask(__name__)
DATABASE = Path(__file__).with_name("database.db")

CATEGORIES = {
    "Food", "Travel", "Shopping",
    "Bills", "Education", "Other"
}


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL,
                amount REAL NOT NULL CHECK(amount > 0),
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                category TEXT NOT NULL,
                date TEXT NOT NULL
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                monthly_budget REAL NOT NULL DEFAULT 0
            )
        """)

        db.execute("""
            INSERT OR IGNORE INTO settings (id, monthly_budget)
            VALUES (1, 0)
        """)


def transaction_dict(row):
    return {
        "id": row["id"],
        "description": row["description"],
        "amount": row["amount"],
        "type": row["type"],
        "category": row["category"],
        "date": row["date"]
    }


def read_transaction(data):
    if not isinstance(data, dict):
        raise ValueError("Invalid transaction data.")

    description = str(data.get("description", "")).strip()
    category = str(data.get("category", "Other")).strip()
    transaction_type = str(data.get("type", "")).lower()
    raw_amount = data.get("amount")
    transaction_date = str(data.get("date", ""))

    if not description or len(description) > 200:
        raise ValueError("Description is required (max 200 characters).")

    if transaction_type not in ("income", "expense"):
        raise ValueError("Choose income or expense.")

    if category not in CATEGORIES:
        raise ValueError("Choose a valid category.")

    try:
        amount = float(raw_amount)
    except (TypeError, ValueError):
        raise ValueError("Enter a valid amount.")

    if not 0 < amount < float("inf"):
        raise ValueError("Amount must be greater than zero.")

    try:
        parsed_date = date.fromisoformat(transaction_date)
        if parsed_date.isoformat() != transaction_date:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Enter a valid date.")

    return (
        description,
        amount,
        transaction_type,
        category,
        transaction_date
    )


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    with get_db() as db:
        rows = db.execute("""
            SELECT * FROM transactions
            ORDER BY date DESC, id DESC
        """).fetchall()

    return jsonify([transaction_dict(row) for row in rows])


@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    try:
        values = read_transaction(request.get_json(silent=True))

        with get_db() as db:
            cursor = db.execute("""
                INSERT INTO transactions
                (description, amount, type, category, date)
                VALUES (?, ?, ?, ?, ?)
            """, values)

            row = db.execute(
                "SELECT * FROM transactions WHERE id = ?",
                (cursor.lastrowid,)
            ).fetchone()

        return jsonify(transaction_dict(row)), 201

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
def edit_transaction(transaction_id):
    try:
        values = read_transaction(request.get_json(silent=True))

        with get_db() as db:
            existing = db.execute(
                "SELECT id FROM transactions WHERE id = ?",
                (transaction_id,)
            ).fetchone()

            if existing is None:
                return jsonify({"error": "Transaction not found."}), 404

            db.execute("""
                UPDATE transactions
                SET description = ?, amount = ?, type = ?,
                    category = ?, date = ?
                WHERE id = ?
            """, (*values, transaction_id))

            row = db.execute(
                "SELECT * FROM transactions WHERE id = ?",
                (transaction_id,)
            ).fetchone()

        return jsonify(transaction_dict(row))

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    with get_db() as db:
        cursor = db.execute(
            "DELETE FROM transactions WHERE id = ?",
            (transaction_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Transaction not found."}), 404

    return jsonify({"message": "Transaction deleted."})


@app.route("/api/budget", methods=["GET"])
def get_budget():
    with get_db() as db:
        row = db.execute(
            "SELECT monthly_budget FROM settings WHERE id = 1"
        ).fetchone()

    return jsonify({"monthlyBudget": row["monthly_budget"]})


@app.route("/api/budget", methods=["PUT"])
def save_budget():
    data = request.get_json(silent=True) or {}

    try:
        amount = float(data.get("monthlyBudget"))

        if not 0 < amount < float("inf"):
            raise ValueError()

    except (ValueError, TypeError):
        return jsonify({
            "error": "Budget must be a valid number greater than zero."
        }), 400

    with get_db() as db:
        db.execute("""
            UPDATE settings
            SET monthly_budget = ?
            WHERE id = 1
        """, (amount,))

    return jsonify({"monthlyBudget": amount})


@app.errorhandler(500)
def server_error(error):
    app.logger.exception("Internal server error")
    return jsonify({"error": "Server error. Check the terminal."}), 500


init_db()

if __name__ == "__main__":
    app.run(debug=True)