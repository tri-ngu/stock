# 📈 Stock Advisor AI

An AI-powered web application that helps beginners invest in stocks safely and wisely. Get personalized stock recommendations, portfolio building, and investment education powered by Claude AI.

## ✨ Features

- **AI Chat Interface**: Talk to an intelligent stock investment advisor
- **Stock Analysis**: Get detailed information on any stock
- **Portfolio Building**: Build diversified portfolios matched to your risk tolerance
- **Stock Screening**: Find stocks based on fundamental criteria
- **Sector Comparison**: Compare stocks across different sectors
- **Educational**: Learn investment concepts in beginner-friendly language
- **Streaming Responses**: Real-time AI responses for better UX

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- NVIDIA API Key (for Claude API access via NVIDIA NIM)

### Setup

1. **Clone and navigate to project**
   ```bash
   cd C:\Users\billn\documents\claude\stock
   ```

2. **Run setup script**
   ```bash
   setup.bat
   ```
   This will:
   - Create a Python virtual environment
   - Install all dependencies

3. **Configure API Key**
   - Copy `.env.example` to `.env`
   - Add your NVIDIA API key to `.env`

4. **Start the server**
   ```bash
   run.bat
   ```

5. **Open in browser**
   - Navigate to `http://localhost:8000`
   - Start chatting with Stock Advisor AI!

## 📁 Project Structure

```
stock/
├── backend/
│   ├── main.py              # FastAPI server
│   └── agent/
│       ├── orchestrator.py   # Claude AI orchestrator with tool calling
│       └── tools.py          # Stock analysis tools
├── frontend/
│   ├── index.html           # Main UI
│   ├── style.css            # Styling
│   └── app.js               # Frontend logic
├── requirements.txt         # Python dependencies
├── setup.bat               # Setup script (Windows)
├── run.bat                 # Run script (Windows)
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🛠️ Technology Stack

**Backend:**
- FastAPI - Modern web framework
- Claude 3.5 Sonnet - AI model for reasoning and tool calling
- Anthropic SDK - API client
- yfinance - Free stock data
- SciPy - Portfolio optimization

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Server-Sent Events (SSE) for streaming
- No build tools or dependencies

## 🤖 How It Works

1. **User Message** → FastAPI endpoint
2. **Claude Processing** → Orchestrator receives message
3. **Tool Calling** → Claude decides which tools to use
4. **Tool Execution** → Stock data fetched via yfinance
5. **Response Stream** → Results sent back via SSE
6. **Frontend Update** → Chat and portfolio displayed

## 📊 Available Tools

The AI can use these tools to help you:

- `get_stock_info` - Current stock metrics
- `screen_stocks` - Find stocks by criteria
- `get_historical_data` - Price history and volatility
- `optimize_portfolio` - Mean-Variance optimization
- `build_portfolio_recommendation` - Full portfolio building
- `analyze_company` - Financial fundamentals
- `get_sector_comparison` - Sector analysis

## 💡 Example Conversations

**Beginner Portfolio:**
> "I have $10,000 and I'm a beginner. Build me a conservative portfolio."

**Stock Analysis:**
> "Tell me about Microsoft. Should I invest?"

**Stock Screening:**
> "Find tech stocks with P/E under 25 and strong earnings growth"

**Portfolio Help:**
> "Build me a $50,000 moderate-risk portfolio for retirement"

## ⚠️ Important Disclaimers

- This is **educational advice only**, not financial guidance
- Past performance does not guarantee future results
- Always do your own research before investing
- Consult a licensed financial advisor for personalized advice
- The AI's recommendations are based on historical data and may not predict future performance

## 🔄 How Data is Fetched

- Stock data comes from **yfinance** (free, public data)
- No paid APIs used to keep costs low
- Data is fetched in real-time when requested
- Portfolio optimization uses 5-year historical price data

## 🔧 Configuration

Edit `backend/main.py` to customize:
- `SYSTEM_PROMPT` - AI personality and guidelines
- Screening criteria in `tools.py`
- Asset allocation percentages
- Risk level definitions

## 📈 Future Roadmap

- Phase 2: User accounts and database
- Phase 3: Broker integration (Alpaca)
- Phase 4: Advanced charting and analytics
- Phase 5: Smart alerts and automation
- Phase 6: Backtesting and historical analysis
- Phase 7: Mobile app
- Phase 8: International stocks and crypto

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Change SERVER_PORT in .env to a different port (e.g., 8001)
```

**API key errors:**
```bash
# Verify NVIDIA API key is correct in .env
# Check that the key is not expired
```

**Stock data errors:**
```bash
# yfinance may temporarily fail - try again
# Some tickers may not be available on yfinance
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the project roadmap
3. Check `PROGRESS.md` for known issues

## 📝 License

This is an educational project. Use responsibly.

## 🎯 Success Metrics

- User satisfaction: Target NPS > 40
- Accuracy: > 70% positive outcomes
- Growth: 10K users year 1, 100K year 3
- Revenue: $10K-$50K/month at scale (Pro tiers)

---

Happy investing! 📚💰
