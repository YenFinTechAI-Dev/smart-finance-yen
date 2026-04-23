import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sử dụng Qwen 2.5 (phiên bản 3B là đủ thông minh để tư vấn)
llm = ChatOllama(model="qwen2.5:3b", format="json", temperature=0.3)

# --- ĐỊNH HƯỚNG TƯ DUY CHO AI ---
SYSTEM_PROMPT = """Bạn là một Chuyên gia Tài chính Cá nhân (Financial Coach).
Ngữ cảnh Dashboard hiện tại (Tổng thu, Tổng chi, Số dư): {context}

Nhiệm vụ của bạn:
1. Nếu người dùng nhập giao dịch: Trích xuất JSON (amount > 0).
2. Nếu người dùng hỏi về định hướng, phân tích hoặc lời khuyên:
   - Hãy so sánh Tổng chi và Tổng thu trong ngữ cảnh.
   - Đưa ra định hướng cụ thể (VD: Tiết kiệm thêm bao nhiêu %, nên cắt giảm mục nào).
   - Trả về JSON với amount: 0 và trường 'note' là bài phân tích định hướng dài, có tâm.

BẮT BUỘC TRẢ VỀ JSON:
{{
    "amount": <số nguyên>,
    "type": "Chi/Thu",
    "category": "Ăn uống/Di chuyển/Mua sắm/Hóa đơn/Lương/Khác",
    "note": "<Lời tư vấn định hướng tài chính chi tiết>"
}}"""

prompt_template = PromptTemplate.from_template(SYSTEM_PROMPT)
ai_chain = prompt_template | llm

class AIRequest(BaseModel):
    text: str
    context: str = "0"

@app.post("/api/analyze")
async def analyze_text(request: AIRequest):
    try:
        response = ai_chain.invoke({"user_text": request.text, "context": request.context})
        data = json.loads(response.content)
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)