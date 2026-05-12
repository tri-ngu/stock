// Configuration
const API_BASE = window.location.origin;
const SEND_BUTTON = document.getElementById('sendButton');
const MESSAGE_INPUT = document.getElementById('messageInput');
const CHAT_MESSAGES = document.getElementById('chatMessages');
const MESSAGE_FORM = document.getElementById('messageForm');

let sessionId = localStorage.getItem('sessionId') || generateSessionId();
document.getElementById('sessionId').textContent = sessionId.substring(0, 8) + '...';
localStorage.setItem('sessionId', sessionId);

// Generate unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Send message to backend
async function sendMessage() {
    const message = MESSAGE_INPUT.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, 'user');
    MESSAGE_INPUT.value = '';
    SEND_BUTTON.disabled = true;

    // Show loading state
    const loadingEl = addLoadingIndicator();

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Remove loading indicator
        loadingEl.remove();

        // Handle Server-Sent Events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));

                    if (data.type === 'text') {
                        addMessageToChat(data.content, 'assistant');
                    } else if (data.type === 'portfolio') {
                        showPortfolioModal(data.data);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        loadingEl.remove();
        addMessageToChat(`Error: ${error.message}`, 'error');
    } finally {
        SEND_BUTTON.disabled = false;
        MESSAGE_INPUT.focus();
    }
}

// Add message to chat UI
function addMessageToChat(text, role) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}-message`;

    const pEl = document.createElement('p');
    pEl.textContent = text;
    messageEl.appendChild(pEl);

    CHAT_MESSAGES.appendChild(messageEl);
    CHAT_MESSAGES.scrollTop = CHAT_MESSAGES.scrollHeight;

    return messageEl;
}

// Add loading indicator
function addLoadingIndicator() {
    const messageEl = document.createElement('div');
    messageEl.className = 'message assistant-message';
    messageEl.innerHTML = `
        <div class="loading">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
    `;
    CHAT_MESSAGES.appendChild(messageEl);
    CHAT_MESSAGES.scrollTop = CHAT_MESSAGES.scrollHeight;
    return messageEl;
}

// Show portfolio modal
function showPortfolioModal(portfolioData) {
    const content = document.getElementById('portfolioContent');
    let html = `
        <div class="portfolio-section">
            <h3>Budget: $${portfolioData.budget?.toLocaleString()}</h3>
            <p><strong>Risk Level:</strong> ${portfolioData.risk_level}</p>
    `;

    if (portfolioData.positions) {
        html += '<h4>Recommended Positions:</h4>';
        for (const [ticker, amount] of Object.entries(portfolioData.positions)) {
            const percentage = ((amount / portfolioData.budget) * 100).toFixed(1);
            html += `
                <div class="portfolio-item">
                    <span class="portfolio-ticker">${ticker}</span>
                    <span class="portfolio-amount">$${amount.toFixed(2)} (${percentage}%)</span>
                </div>
            `;
        }
    }

    if (portfolioData.expected_return !== undefined) {
        html += `
            <div class="portfolio-stats">
                <div class="stat-row">
                    <span class="stat-label">Expected Annual Return:</span>
                    <span class="stat-value">${(portfolioData.expected_return * 100).toFixed(2)}%</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Annual Volatility:</span>
                    <span class="stat-value">${(portfolioData.volatility * 100).toFixed(2)}%</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Sharpe Ratio:</span>
                    <span class="stat-value">${portfolioData.sharpe_ratio?.toFixed(3)}</span>
                </div>
            </div>
        `;
    }

    html += '</div>';
    content.innerHTML = html;

    const modal = document.getElementById('portfolioModal');
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('portfolioModal').classList.remove('active');
}

// Send example message
function sendExample(text) {
    MESSAGE_INPUT.value = text;
    sendMessage();
}

// New session
function newSession() {
    if (confirm('Clear chat history and start a new session?')) {
        sessionId = generateSessionId();
        localStorage.setItem('sessionId', sessionId);
        document.getElementById('sessionId').textContent = sessionId.substring(0, 8) + '...';
        CHAT_MESSAGES.innerHTML = `
            <div class="message assistant-message">
                <p>Hello! I'm your Stock Advisor AI. I'm here to help you understand stock investing and build a diversified portfolio tailored to your needs.</p>
                <p>You can ask me to:</p>
                <ul>
                    <li>Analyze specific stocks (e.g., "Tell me about Apple")</li>
                    <li>Screen stocks by criteria (e.g., "Find affordable tech stocks")</li>
                    <li>Build a portfolio (e.g., "Build a $10,000 portfolio for conservative investors")</li>
                    <li>Compare sectors (e.g., "Compare tech and healthcare stocks")</li>
                    <li>Learn investing concepts (e.g., "Explain diversification")</li>
                </ul>
            </div>
        `;
    }
}

// Event listeners
MESSAGE_FORM.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

MESSAGE_INPUT.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('portfolioModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Set focus on load
MESSAGE_INPUT.focus();
