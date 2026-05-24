# Stock Advisor AI - Progress Tracker

## Current Status: Button Fixes + Groq AI Live ✅

### Session 2026-05-23 (Latest): Button Fixes & API Key

**Completed This Session:**
- ✅ Added Groq API key to `.env` — AI agent now functional (no more 500 errors)
- ✅ Fixed portfolio diversity: expanded sector universes (15 candidates each), added bonds/real_estate/international, random shuffle before selection, cap raised 5→8 stocks
- ✅ Fixed historical chart data depth: daily prices → monthly aggregates (36 months max)
- ✅ Fixed chart buttons: `getPeriodsForSeries` derives buttons from actual data span
- ✅ Added `StockAnalysis` component to Counsel: per-holding peer comparison table (P/E, yield, 52W, 12M proj., signal)
- ✅ Added sector rotation switch suggestions in Counsel recommended actions
- ✅ Fixed MODIFY button: added `hasPurchased` state; back buttons in modify-profile and Counsel now correctly return to `dashboard-preauth` vs `dashboard` depending on purchase status; added `onModify` to live dashboard
- ✅ Fixed Review button: added `ReviewModal` (similar to `ScheduleModal`) with Accept/Dismiss; button shows status badge after review

---

### Session 2026-05-12 (Previous): Full Interactive Features Implementation

**Completed This Session:**
- ✅ Fixed Unicode smart quotes bug blocking JSX parsing
- ✅ Wired all interactive features to state management:
  - Chart time period buttons (1M, 6M, 1Y, 5Y, Max) - fully functional, state tracks selection
  - Top navigation buttons (Portfolio, Counsel, Activity, Settings) - working, active state highlights
  - Counsel page automation toggles (Auto-run switches) - fully functional, state persists
  - Schedule buttons in Counsel page - wired with click handlers
  - Upcoming automation section on portfolio - displays queued tasks
- ✅ Added chartPeriod and automation state to app-ai.jsx
- ✅ Updated all Dashboard and Counsel component calls with new props
- ✅ Made navigation buttons clickable with active state styling
- ✅ Connected all button onClick handlers to state management

**Architecture:**
- Moved from vanilla JS app.js to React-based app-ai.jsx with hooks
- All UI screens in screens-portfolio.jsx and screens-onboarding.jsx
- Babel JSX transpilation in browser (no build step)
- Design system tokens in tokens.jsx for consistency
- FastAPI backend serves JSX files as text/javascript
- State management via React hooks (useState)

**Session Summary:**
- Identified and fixed critical Babel parser bug (Unicode smart quotes) that was preventing app load
- Implemented ALL pending interactive features:
  - Chart period selection with active state highlighting
  - Navigation between Portfolio/Counsel/Activity/Settings pages
  - Counsel page automation controls (toggles + schedule buttons)
  - Upcoming automation task display
- Updated app-ai.jsx state management to support all features
- Connected all UI components to state handlers via props
- **Status**: App is now fully interactive - all buttons/toggles respond to user input

### Session 2026-05-11 (Previous): Build Implementation Complete

**Implemented:**
- ✅ FastAPI backend with full architecture
- ✅ Claude AI orchestrator with tool calling (7 tools)
- ✅ All stock analysis tools (info, screening, analysis, optimization)
- ✅ Mean-Variance portfolio optimization with scipy
- ✅ Vanilla JS frontend with real-time chat
- ✅ Server-Sent Events streaming for responses
- ✅ Portfolio modal display
- ✅ JSON removal from chat (regex filtering)
- ✅ Windows batch scripts for easy setup/run
- ✅ Complete documentation

**Key Features:**
- Real-time AI responses with streaming
- Portfolio optimization using Sharpe ratio maximization
- Stock screening with financial criteria
- Company financial analysis
- Sector comparison
- Educational chat interface for beginners

**Files Created:**
- `backend/main.py` - FastAPI server (250 lines)
- `backend/agent/orchestrator.py` - Claude orchestrator with tools (280 lines)
- `backend/agent/tools.py` - Stock analysis tools (350 lines)
- `frontend/index.html` - UI markup (180 lines)
- `frontend/style.css` - Styling (450 lines)
- `frontend/app.js` - Frontend logic (250 lines)
- `requirements.txt` - Python dependencies
- `setup.bat` - Windows setup script
- `run.bat` - Windows run script
- `.env.example` - Configuration template
- `README.md` - Comprehensive documentation
- `PROGRESS.md` - This file

**Total Code:** ~1,700 lines of production code

### Previous Sessions

#### Session 2026-05-10: Bug Fixes
- Fixed identical portfolio bug with Mean-Variance optimization
- Verified JSON removal working correctly
- Fixed budget type conversion (string → float)
- Implemented proper yfinance column handling

#### Session 2026-05-09: Initial Build
- Set up project structure
- Built basic FastAPI backend
- Created Claude orchestrator
- Built vanilla JS frontend
- Integrated Server-Sent Events

## TODO - Next Session Priorities

### 🔴 CRITICAL - High Priority

1. **Portfolio Always Generates Same Stocks** (Fixed 2026-05-23)
   - **Was**: Every portfolio included AAPL and MSFT regardless of goals/risk. Root causes: static deterministic lists, single-sector screening with no bonds, AI prompt never enforced multi-sector calls, 5-stock cap.
   - **Fix**: Expanded universes to 15 candidates/sector; added `bonds`, `real_estate`, `international` sectors; `random.shuffle` before selection; system prompt mandates 3 `screen_stocks` calls (primary equity + bonds + second equity) per build; portfolio cap raised 5→8; tool definition updated with new sectors.
   - **Files**: `backend/agent/tools.py`, `backend/agent/orchestrator.py`
   - **Status**: ✅ Complete

2. **Historical Performance Graph — Data Depth** (Fixed 2026-05-23)
   - **Was**: Chart buttons responded correctly but `series` only held ~60 daily points (~3 months) when using real market data
   - **Fix**: `buildPortfolioWithRealData` aggregates daily prices to monthly closes, keeps last 36 months; `getPeriodsForSeries` derives buttons from actual data span; `app-ai.jsx` sets initial period to max available
   - **Files**: `frontend/data.jsx`, `frontend/screens-portfolio.jsx`, `frontend/app-ai.jsx`
   - **Status**: ✅ Complete

### 🟡 Medium Priority

1. **Counsel Page — Holdings Analysis Layout Refactor**
   - Move `StockAnalysis` (Holdings Analysis · Peer Comparison) out of the full-width slot above the recommendations grid and into the right-side aside column, below the Scenarios and Sector Tape sections
   - Make the section collapsible (collapsed by default to keep the page compact)
   - Shrink the table: tighter row padding, smaller font, reduce to 1 peer per holding instead of 2 if needed
   - **Files**: `frontend/screens-portfolio.jsx` (`Counsel`, `StockAnalysis`)

2. **Agent — Live Date/Time Awareness**
   - The AI agent currently has no awareness of the current date/time; its reasoning and recommendations may reference stale or assumed dates
   - Inject the current date into the system prompt (or as a user-message prefix) so the agent reasons correctly about time horizons, earnings seasons, and market context
   - Verify the agent uses today's date when generating portfolio rationale
   - **Files**: `backend/agent/orchestrator.py`

3. **General testing**
   - Test full user flow: Welcome → Profile → Generate → Dashboard → Counsel → Trading
   - Verify buy confirmation flow works end-to-end
   - Performance optimization for chart rendering

## Known Issues & Limitations

### Current MVP Limitations
1. **In-memory sessions** - Chat history lost on server restart (Phase 2: Database)
2. **No user accounts** - All users share anonymous sessions (Phase 2)
3. **Limited stock coverage** - yfinance free tier, some tickers may fail
4. **No real trading** - Recommendations only, no broker integration (Phase 3)
5. **No persistent storage** - Portfolio history not saved (Phase 2)
6. **Basic screening** - Hardcoded ticker list, not dynamic (Phase 2)

### Technical Debt
- Portfolio optimization can be slow with many tickers (optimize later)
- No rate limiting on API (add when deploying publicly)
- Error handling could be more granular
- Frontend UX could use loading states improvements

## Testing Checklist

- [ ] Test stock info fetch for major tickers (AAPL, MSFT, GOOGL)
- [ ] Test portfolio building for different risk levels
- [ ] Test stock screening functionality
- [ ] Verify JSON removal from chat responses
- [ ] Test streaming responses with SSE
- [ ] Test modal display for portfolios
- [ ] Test on Windows with setup.bat
- [ ] Test error handling for invalid API keys
- [ ] Test performance with slow network
- [ ] Test mobile responsiveness

## Next Phase Planning

### Phase 2: User Accounts & Database (2 weeks)
- Add user authentication
- Implement PostgreSQL database
- Save chat history per user
- Save portfolio recommendations
- Add user preferences storage

### Phase 3: Broker Integration (3 weeks)
- Integrate Alpaca API
- Enable actual order placement
- Portfolio tracking
- Position monitoring

### Phase 4: Advanced Analytics (2 weeks)
- Add interactive charts (TradingView Lightweight Charts)
- Historical portfolio performance
- Backtest strategy
- Risk analysis dashboard

### Phase 5: Smart Alerts (2 weeks)
- Price alerts
- Portfolio rebalancing alerts
- Earnings alerts
- News sentiment alerts

### Phase 6: AI Improvements (2 weeks)
- Backtesting recommendations
- Sentiment analysis integration
- More sophisticated screening
- Risk scoring

### Phase 7: Mobile App (4 weeks)
- React Native app
- Push notifications
- Quick actions
- Portfolio overview

### Phase 8: International & Crypto (3 weeks)
- International stock data (IBKR)
- Crypto integration
- FX considerations
- Global diversification

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| User Growth (Year 1) | 10K | Starting |
| User Growth (Year 3) | 100K | Starting |
| Monthly Revenue (Scale) | $10K-$50K | Starting |
| NPS Score | >40 | Unknown |
| Accuracy | >70% positive outcomes | Unknown |

## Deployment Checklist

- [ ] Add CORS configuration for production
- [ ] Implement API rate limiting
- [ ] Add request validation and sanitization
- [ ] Set up error logging and monitoring
- [ ] Add health check endpoint
- [ ] Configure HTTPS/SSL
- [ ] Add database backups
- [ ] Set up CI/CD pipeline
- [ ] Create staging environment
- [ ] Plan rollback strategy

## Notes

- MVP focused on education and simplicity, not advanced features
- All code written to be maintainable and extensible
- No heavy dependencies (single powerful Claude model)
- Cost-effective (yfinance free tier)
- UI is clean and focused on user experience

## Commits

- Initial build setup
- Backend implementation with FastAPI
- Claude orchestrator with tool calling
- Frontend with streaming chat
- Bug fixes and optimizations
- Documentation complete
