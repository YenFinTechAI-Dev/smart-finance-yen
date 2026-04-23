import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import uvicorn

# Khởi tạo ứng dụng FastAPI
app = FastAPI(title="Hệ thống Quản lý Tài chính - Backend")

# Cấu hình CORS để Frontend (thường chạy ở port 5500) có thể kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả các nguồn (có thể siết chặt khi deploy)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CẤU TRÚC DỮ LIỆU (SCHEMA) ---

class Transaction(BaseModel):
    amount: int
    category: str
    type: str  # "Chi" hoặc "Thu"
    note: str = ""

# --- QUẢN LÝ DATABASE (SQLITE) ---

DB_NAME = "finance.db"

def init_db():
    """Khởi tạo bảng transactions nếu chưa tồn tại"""
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

# Chạy khởi tạo DB ngay khi file được load
init_db()

# --- CÁC ĐƯỜNG DẪN API (ENDPOINTS) ---

@app.get("/")
def home():
    return {"status": "online", "message": "Backend Quản lý chi tiêu đang hoạt động!"}

@app.post("/api/transactions")
async def add_transaction(item: Transaction):
    """Lưu một giao dịch mới vào Database"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Chuẩn hóa loại giao dịch để đồng bộ dữ liệu
        clean_type = "Chi" if "Chi" in item.type else "Thu"
        
        cursor.execute(
            "INSERT INTO transactions (amount, category, type, note) VALUES (?, ?, ?, ?)",
            (item.amount, item.category, clean_type, item.note)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Giao dịch đã được ghi vào sổ sách."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
async def get_dashboard_data():
    """Tính toán và trả về dữ liệu cho Dashboard & Biểu đồ"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # 1. Lấy tổng Chi theo từng Danh mục (Để vẽ biểu đồ vành khuyên)
        cursor.execute("""
            SELECT category, SUM(amount) 
            FROM transactions 
            WHERE type = 'Chi' 
            GROUP BY category
        """)
        chart_rows = cursor.fetchall()
        chart_data = {
            "labels": [row[0] for row in chart_rows],
            "values": [row[1] for row in chart_rows]
        }

        # 2. Lấy tổng Thu và tổng Chi (Để hiển thị thẻ thông số)
        cursor.execute("SELECT type, SUM(amount) FROM transactions GROUP BY type")
        summary_rows = dict(cursor.fetchall())
        
        summary = {
            "total_income": summary_rows.get("Thu", 0),
            "total_expense": summary_rows.get("Chi", 0)
        }

        # 3. Lấy 5 giao dịch gần đây nhất (Lịch sử)
        cursor.execute("SELECT amount, category, type, note, created_at FROM transactions ORDER BY id DESC LIMIT 5")
        history_rows = cursor.fetchall()
        history = [
            {"amount": r[0], "category": r[1], "type": r[2], "note": r[3], "date": r[4]} 
            for r in history_rows
        ]

        conn.close()
        return {
            "chart": chart_data,
            "summary": summary,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- CHẠY SERVER ---

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)