const API_URL = window.location.origin;
const API_URL = "https://smart-finance-tracker-nfz1.vercel.app";
let myChart;

// --- 1. VẼ BIỂU ĐỒ ---
function renderChart(labels, values) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (myChart) myChart.destroy();
    if (!labels || labels.length === 0) return;
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } }
            }
        }
    });
}

// --- 2. CẬP NHẬT DASHBOARD ---
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard`);
        const data = await response.json();

        const income = data.summary.total_income || 0;
        const expense = data.summary.total_expense || 0;
        const balance = income - expense;

        document.getElementById('totalIncome').innerText = income.toLocaleString('vi-VN') + " đ";
        document.getElementById('totalExpense').innerText = expense.toLocaleString('vi-VN') + " đ";
        const balEl = document.getElementById('totalBalance');
        balEl.innerText = balance.toLocaleString('vi-VN') + " đ";
        balEl.style.color = balance >= 0 ? '#10b981' : '#ef4444';

        if (data.chart.labels.length > 0) {
            renderChart(data.chart.labels, data.chart.values);
        }

        // Render lịch sử giao dịch
        renderHistory(data.history || []);

        return data;
    } catch (e) {
        console.error("Lỗi kết nối Backend 8000:", e);
        return null;
    }
}

// --- 3. RENDER LỊCH SỬ GIAO DỊCH ---
function renderHistory(history) {
    const container = document.getElementById('historyList');
    if (!container) return;
    if (!history.length) {
        container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">Chưa có giao dịch nào</p>';
        return;
    }
    container.innerHTML = history.map(tx => {
        const isChi = tx.type === 'Chi';
        const color = isChi ? '#ef4444' : '#10b981';
        const sign = isChi ? '-' : '+';
        const icon = isChi ? '↓' : '↑';
        const dateStr = tx.date ? new Date(tx.date).toLocaleDateString('vi-VN') : '';
        return `
        <div class="history-item">
            <div class="history-icon" style="background:${isChi ? '#fef2f2' : '#ecfdf5'}; color:${color}">${icon}</div>
            <div class="history-info">
                <span class="history-cat">${tx.category}</span>
                <span class="history-note">${tx.note || dateStr}</span>
            </div>
            <div class="history-amount" style="color:${color}">${sign}${tx.amount.toLocaleString('vi-VN')}đ</div>
        </div>`;
    }).join('');
}

// --- 4. XỬ LÝ AI ---
async function processAI() {
    const textInput = document.getElementById('aiInput');
    const statusBox = document.getElementById('aiStatus');
    const text = textInput.value.trim();
    const btn = document.getElementById('btnAI');

    if (!text) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...';
    statusBox.style.display = "block";
    statusBox.className = "ai-status-box loading";
    statusBox.innerHTML = `<div class="ai-thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span> AI đang phân tích dữ liệu...</div>`;

    // Lấy context đầy đủ từ màn hình
    const dashboardData = await loadDashboard();
    let context = "Chưa có dữ liệu.";
    if (dashboardData) {
        const { summary, chart, history } = dashboardData;
        const topCats = chart.labels.map((l, i) => `${l}: ${chart.values[i].toLocaleString('vi-VN')}đ`).join(', ');
        const recentTx = (history || []).slice(0, 3).map(t => `${t.type} ${t.category} ${t.amount.toLocaleString('vi-VN')}đ`).join('; ');
        context = `Tổng thu: ${summary.total_income.toLocaleString('vi-VN')}đ | Tổng chi: ${summary.total_expense.toLocaleString('vi-VN')}đ | Số dư: ${(summary.total_income - summary.total_expense).toLocaleString('vi-VN')}đ. Chi theo danh mục: ${topCats || 'Chưa có'}. Giao dịch gần đây: ${recentTx || 'Chưa có'}.`;
    }

    try {
        const aiRes = await fetch(`${AI_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, context })
        });
        const aiData = await aiRes.json();

        if (aiData.status === "success") {
            const result = aiData.data;

            if (result.amount > 0) {
                // Ghi giao dịch vào DB
                await fetch(`${API_URL}/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result)
                });
                await loadDashboard();

                const typeColor = result.type === 'Chi' ? '#ef4444' : '#10b981';
                const typeIcon = result.type === 'Chi' ? '💸' : '💰';
                statusBox.className = "ai-status-box success";
                statusBox.innerHTML = `
                    <div class="ai-result-row">
                        <span class="ai-result-icon">${typeIcon}</span>
                        <div>
                            <div class="ai-result-main">Đã ghi <strong style="color:${typeColor}">${result.amount.toLocaleString('vi-VN')}đ</strong> — <strong>${result.category}</strong></div>
                            <div class="ai-result-note">${result.note}</div>
                        </div>
                    </div>`;
            } else {
                // Phân tích / tư vấn
                statusBox.className = "ai-status-box analysis";
                statusBox.innerHTML = `
                    <div class="ai-analysis">
                        <div class="ai-analysis-header">🧠 Phân tích AI</div>
                        <div class="ai-analysis-body">${result.note}</div>
                    </div>`;
            }
            textInput.value = "";
        } else {
            statusBox.className = "ai-status-box error";
            statusBox.innerHTML = `❌ <strong>Lỗi AI:</strong> ${aiData.message}`;
        }
    } catch (error) {
        statusBox.className = "ai-status-box error";
        statusBox.innerHTML = `❌ <strong>Lỗi kết nối:</strong> Hãy kiểm tra server AI đang chạy tại port 8001. <br><small>${error.message}</small>`;
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi';
}

// Enter để gửi
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    document.getElementById('aiInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') processAI();
    });
});

// Form nhập tay
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        amount: parseInt(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        note: document.getElementById('note').value
    };
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;

    await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    e.target.reset();
    await loadDashboard();

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu!';
    setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-save"></i> LƯU DỮ LIỆU';
        btn.disabled = false;
    }, 1500);
});



async function processAI() {
    const textInput = document.getElementById('aiInput');
    const statusText = document.getElementById('aiStatus');
    const text = textInput.value;

    // GOM DỮ LIỆU ĐỂ AI ĐƯA RA ĐỊNH HƯỚNG
    const income = document.getElementById('totalIncome').innerText;
    const expense = document.getElementById('totalExpense').innerText;
    const balance = document.getElementById('totalBalance').innerText;

    const dashboardContext = `Thu: ${income}, Chi: ${expense}, Dư: ${balance}`;

    if (!text) return;

    statusText.style.display = "block";
    statusText.innerHTML = "🤖 <b>Qwen</b> đang phân tích biểu đồ và lập định hướng...";

    try {
        const aiRes = await fetch('http://127.0.0.1:8001/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, context: dashboardContext })
        });
        const aiData = await aiRes.json();

        if (aiData.status === "success") {
            const result = aiData.data;

            // Nếu AI đưa ra định hướng (amount = 0)
            if (result.amount === 0) {
                statusText.innerHTML = `🚀 <b>Định hướng tài chính:</b> <br>${result.note.replace(/\n/g, '<br>')}`;
            }
            // Nếu AI thực hiện ghi chép giao dịch
            else {
                await fetch('http://127.0.0.1:8000/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result)
                });
                await loadDashboard();
                statusText.innerHTML = `✅ <b>AI đã ghi:</b> ${result.amount.toLocaleString()}đ vào ${result.category}. <br><i>Ghi chú: ${result.note}</i>`;
            }
            textInput.value = "";
        }
    } catch (error) {
        statusText.innerHTML = "❌ Lỗi: Hãy kiểm tra Ollama và Server 8001!";
    }
}