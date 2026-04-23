import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os


app = FastAPI(title="Hệ thống Quản lý Tài chính - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if os.environ.get("VERCEL"):
    DB_NAME = "/tmp/finance.db"
else:
    DB_NAME = "finance.db"

def init_db():
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount INTEGER NOT NULL,
            category TEXT NOT NULL,
            type TEXT NOT NULL,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Chạy khởi tạo DB
init_db()

# --- CẤU TRÚC DỮ LIỆU ---
class Transaction(BaseModel):
    amount: int
    category: str
    type: str
    note: str = ""

# --- API ENDPOINTS ---

@app.get("/")
def home():
    return {"status": "online", "message": "Backend đang chạy trên Vercel!"}

@app.post("/api/transactions")
async def add_transaction(item: Transaction):
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        clean_type = "Chi" if "Chi" in item.type else "Thu"
        cursor.execute(
            "INSERT INTO transactions (amount, category, type, note) VALUES (?, ?, ?, ?)",
            (item.amount, item.category, clean_type, item.note)
        )
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
async def get_dashboard_data():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # 1. Biểu đồ
        cursor.execute("SELECT category, SUM(amount) FROM transactions WHERE type = 'Chi' GROUP BY category")
        chart_rows = cursor.fetchall()
        chart_data = {
            "labels": [row[0] for row in chart_rows],
            "values": [row[1] for row in chart_rows]
        }

        # 2. Tổng kết
        cursor.execute("SELECT type, SUM(amount) FROM transactions GROUP BY type")
        summary_rows = dict(cursor.fetchall())
        summary = {
            "total_income": summary_rows.get("Thu", 0),
            "total_expense": summary_rows.get("Chi", 0)
        }

        # 3. Lịch sử
        cursor.execute("SELECT amount, category, type, note, created_at FROM transactions ORDER BY id DESC LIMIT 5")
        history = [
            {"amount": r[0], "category": r[1], "type": r[2], "note": r[3], "date": r[4]} 
            for r in cursor.fetchall()
        ]

        conn.close()
        return {"chart": chart_data, "summary": summary, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

