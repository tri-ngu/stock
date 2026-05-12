# Stock Advisor AI - Project Summary

## Executive Summary

**StockAdvisor AI** is a full-stack web application that helps beginner investors make smarter stock investment decisions through an AI-powered chat interface. Built with FastAPI, Claude AI, and vanilla JavaScript, the MVP provides real-time stock analysis, portfolio building, and investment education.

## Problem Statement

Most beginner investors struggle with:
- Understanding stock fundamentals
- Building diversified portfolios
- Making data-driven investment decisions
- Finding reliable financial guidance

Stock Advisor AI solves this by combining:
- **AI Intelligence** - Claude provides context and reasoning
- **Real Data** - Live stock metrics from yfinance
- **Tool Use** - 7 specialized tools for stock analysis
- **Education** - Beginner-friendly explanations

## Solution Overview

An interactive web application where users chat with an AI investment advisor that:
1. Analyzes stocks and companies
2. Screens stocks by financial criteria
3. Builds diversified portfolios optimized for risk level
4. Explains recommendations in simple terms
5. Provides investment education

## Key Features

### Core Features (MVP)
1. **Chat Interface** - Real-time conversation with AI advisor
2. **Stock Analysis** - Get detailed company metrics
3. **Portfolio Builder** - Create diversified portfolios
4. **Stock Screening** - Find stocks by criteria
5. **Sector Analysis** - Compare stocks across sectors
6. **Portfolio Optimization** - Mean-Variance optimization for Sharpe ratio

### Technical Highlights
- **Streaming Responses** - Real-time SSE for better UX
- **Tool Calling** - Claude autonomously uses 7 tools
- **Portfolio Optimization** - Scipy-based financial optimization
- **No Build Tools** - Vanilla JS, zero frontend dependencies
- **Free Data** - yfinance eliminates API costs

## Architecture

### Backend
```
FastAPI Server (main.py)
├── Chat Endpoint → Orchestrator
├── Health Check → Status
└── Portfolio Endpoint → Handler

Orchestrator (orchestrator.py)
├── Claude Client
├── Tool Manager
├── Message History
└── Response Streaming

Tools (tools.py)
├── get_stock_info() → Current data
├── screen_stocks() → Filter by criteria
├── get_historical_data() → Price history
├── optimize_portfolio() → Sharpe ratio max
├── build_portfolio_recommendation() → Full recommendation
├── analyze_company() → Fundamentals
└── get_sector_comparison() → Sector analysis
```

### Frontend
```
HTML/CSS/JavaScript (Vanilla)
├── Chat UI → Message history
├── Input Area → User message form
├── Sidebar → Quick tips & examples
└── Portfolio Modal → Recommendation display

SSE Stream Handler
├── Text Messages
├── Tool Calls
└── Portfolio Events
```

## Data Flow

```
User Message
    ↓
FastAPI Endpoint
    ↓
Claude Orchestrator
    ↓
Tool Calling Decision
    ├→ Tool 1 (Stock Info)
    ├→ Tool 2 (Screening)
    └→ Tool 3 (Portfolio)
    ↓
Tool Execution (yfinance)
    ↓
Result Processing
    ↓
Claude Response Generation
    ↓
SSE Stream to Frontend
    ↓
Chat UI Update
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **AI/LLM** | Claude 3.5 Sonnet | Most capable, handles complex reasoning |
| **Backend** | FastAPI + Uvicorn | Fast, modern, async-ready |
| **Tool Execution** | Python | Scientific libraries (SciPy, NumPy) |
| **Data** | yfinance | Free, reliable, no API keys |
| **Optimization** | SciPy (SLSQP) | Industry-standard portfolio optimization |
| **Frontend** | Vanilla JS + HTML/CSS | No build complexity, fast load |
| **Streaming** | Server-Sent Events | Simpler than WebSocket, sufficient for this use |
| **Hosting** | Local/Cloud Ready | Deployment agnostic |

## Business Model

### Monetization Strategy
- **Freemium Pricing**
  - Free Tier: Basic stock analysis, limited portfolios/month
  - Pro ($9.99/mo): Unlimited portfolios, premium stocks
  - Plus ($19.99/mo): Real-time alerts, backtesting
  - Elite ($29.99/mo): Broker integration, direct trading

### Revenue Projections
- Year 1: 10K users @ 10% conversion → $10K-$20K/month
- Year 2: 50K users @ 20% conversion → $50K-$100K/month
- Year 3: 100K users @ 25% conversion → $100K-$200K/month

## Competitive Advantages

1. **AI-Powered** - Claude's reasoning + tool use = better recommendations
2. **Cost-Effective** - Free data (yfinance) keeps costs low
3. **Educational** - Beginner focus, explains decisions
4. **Fast** - No build tools, vanilla JS, SSE streaming
5. **Extensible** - Easy to add new tools and features
6. **Privacy-First** - In-memory sessions, no tracking (Phase 2: optional DB)

## Metrics & KPIs

### Success Criteria
- **User Growth**: 10K users year 1, 100K year 3
- **Engagement**: NPS > 40, 5+ portfolio builds/user/month
- **Accuracy**: >70% positive investment outcomes
- **Retention**: >60% monthly active users
- **Revenue**: $10K-$50K/month at scale

### Monitoring
- User acquisition funnel
- Engagement metrics (chats/portfolios built)
- NPS surveys
- Investment outcome tracking
- Revenue per user
- Churn rate

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Market competition | Medium | Unique AI approach, education focus |
| Regulatory (SEC) | High | Disclaimer, not advice, no guarantees |
| Data accuracy | Medium | yfinance is reliable, disclaimer |
| User losses | High | Paper trading mode, risk education |
| Adoption | Medium | Aggressive free tier, network effects |

## Implementation Timeline

### Phase 1: MVP (Complete) ✅
- **Status**: Deployed and testable
- **Timeline**: 3 weeks
- **Key deliverable**: Working web app

### Phase 2: Scale (2 weeks)
- User accounts
- Database (PostgreSQL)
- Portfolio history
- Better screening

### Phase 3: Broker Integration (3 weeks)
- Alpaca API integration
- Paper trading
- Live orders
- Position tracking

### Phase 4: Analytics (2 weeks)
- Interactive charts
- Backtest engine
- Risk dashboard
- Performance tracking

### Phase 5-8: Growth (Ongoing)
- Smart alerts
- Mobile app
- International stocks
- Crypto support

## File Structure

```
stock/
├── backend/
│   ├── main.py (FastAPI server)
│   └── agent/
│       ├── orchestrator.py (Claude + tools)
│       └── tools.py (7 stock tools)
├── frontend/
│   ├── index.html (UI)
│   ├── style.css (Styling)
│   └── app.js (Client logic)
├── requirements.txt
├── setup.bat
├── run.bat
├── .env.example
└── README.md
```

## Deployment Options

- **Local Development**: `run.bat`
- **Cloud Deployment**: Docker + Vercel/AWS/GCP/Heroku
- **Scaling**: Database for users, CDN for frontend, background jobs for analysis

## Future Opportunities

1. **Mobile App** - React Native for iOS/Android
2. **International** - Add forex, international stocks, crypto
3. **Community** - Forums, portfolio sharing, leaderboards
4. **Partnerships** - Fintech integrations, robo-advisor white-label
5. **Data** - Sentiment analysis, analyst ratings, insider trading
6. **Content** - Video courses, investing blog, research reports
7. **Automation** - Smart rebalancing, auto-investing, drip investing
8. **Advanced** - Machine learning models, expert advisors, hedge fund strategies

## Success Story

A 25-year-old with $10,000:
1. Opens Stock Advisor AI
2. Chats "I have $10K and I'm new to investing"
3. Gets conservative portfolio (50% bonds, 30% dividend stocks, 20% growth)
4. Learns about diversification, risk, and long-term investing
5. Places orders through integrated broker
6. Tracks portfolio performance
7. Gets alerts for rebalancing
8. Scales to $100K+ over 5 years

---

**Status**: MVP Ready for Beta Testing  
**Next Step**: Deploy and gather user feedback  
**Contact**: tri.nguyen123211@gmail.com
