# Meridian AI Agent - Development Roadmap

## Current Status (Post Priority 5 - FULLY COMPLETE)
✅ **Priority 1 Complete:** Frontend receives and uses AI's portfolio response
✅ **Priority 2 Complete:** Backend tools respond to AI decisions
✅ **Priority 3 Complete:** Users see AI Agent Reasoning
✅ **Priority 4 Complete:** Interactive agent refinement via chat
✅ **Priority 5 Complete:** Real market data integration - all projections grounded in reality

---

## ✅ Priority 1: Make AI Agent Functional (COMPLETE)

**File:** `frontend/app-ai.jsx`

Modified `callAIAgent` to collect:
- `portfolio` events from backend
- `tool_call` events for reasoning visibility
- `agentReasoning.steps` array to show what agent did

Modified `goGenerateAI` to:
- Use `result.portfolio` when AI returns it
- Fall back to `buildPortfolio()` only if AI returns null
- Attach reasoning steps to portfolio object

**Impact:** AI's response now drives the displayed portfolio. Same user input can produce different portfolios based on AI's reasoning about goals and risk.

---

## ✅ Priority 2: Backend Tools - Make AI Decisions Matter (COMPLETE)

**Files:** `backend/agent/tools.py`, `backend/agent/orchestrator.py`, `backend/main.py`

### Changes Made

#### Dynamic Stock Screener
- Created dynamic stock universe by sector: tech, healthcare, finance, energy, consumer, diversified
- Returns `{stocks, sector, reasoning, count}` instead of simple list
- Filters based on sector, market_cap, dividend_yield, user_goals
- If 'income'/'retire' in goals, filters for high dividend stocks
- If 'wealth' in goals, emphasizes growth stocks

#### Dynamic Portfolio Builder
- Updated signature: `build_portfolio_recommendation(budget, risk_level, stocks=None, user_goals=None, time_horizon=10)`
- Accepts AI-selected stocks from screen_stocks
- Optimizes ONLY over AI-selected stocks, not hardcoded basket
- Modifies allocation based on user_goals (increase bonds for retire, increase dividends for income)
- Returns reasoning field explaining AI's decisions

#### Tool Definitions
- screen_stocks definition includes detailed schema for sector, market_cap, dividend_yield, user_goals
- build_portfolio_recommendation definition updated to show new parameters
- System prompt explicitly guides AI: "Use screen_stocks BEFORE build_portfolio_recommendation"

#### Execute Tool
- Updated to pass new parameters: stocks, user_goals, time_horizon=10

**Impact:** Same user input with different risk levels/goals now produces different portfolios based on AI reasoning.

---

## ✅ Priority 3: Reasoning Visibility (COMPLETE)

**Files:** `frontend/screens-portfolio.jsx`, `backend/agent/orchestrator.py`, `backend/main.py`

### Changes Made

#### Frontend Display
- Added "AI Agent Reasoning" section on dashboard (after Projected Trajectory, before Holdings table)
- Displays each tool the AI called and the input parameters
- Shows reasoning as formatted JSON for clarity
- Styled to match portfolio design system

#### Backend Events
- Updated orchestrator to include `input` in yielded tool_call chunks
- Updated main.py to emit tool_call events for ALL tools (not just screen_stocks)
- Tool call events include: `{type: 'tool_call', tool: name, input: params}`

**Impact:** Users understand AI's decision-making process, builds trust, enables refinement.

---

## ✅ Priority 4: Interactive Agent Refinement (COMPLETE)

**Files:** `frontend/app-ai.jsx`, `frontend/screens-portfolio.jsx`

### Changes Made

#### Frontend Chat Interface
- Added chat state to Counsel component: `agentMessages`, `agentInput`, `agentLoading`
- Added `askAgent` async function that:
  - Collects user question
  - Formats it with portfolio context (budget, risk, holdings)
  - Calls `window.callAIAgent` to get AI response
  - Appends both user and AI messages to chat history
  - Handles errors gracefully
- Added chat UI in Counsel screen right sidebar with:
  - Message history display (user in dark, AI in light)
  - Text input field with send button
  - Loading state indicator ("Thinking…")
  - Suggested questions as placeholder
  - Enter key support for sending

#### Global Export
- Exported `callAIAgent` on window object for cross-component access
- Passed `sessionId` to Counsel component for API calls

**Suggested User Flows:**
- "Why did you choose NVDA?"
- "Make this more conservative"
- "Show me an alternative portfolio"
- "Reduce tech exposure"
- "What about bonds?" 
- "How much should I have in growth?"

**Impact:** Agent becomes conversational, can refine recommendations in real-time based on user feedback.

---

## Implementation Timeline

| Priority | Status | Effort | Impact | Completion |
|----------|--------|--------|--------|-----------|
| 1 | ✅ DONE | 30 min | Agent output actually used | Complete |
| 2 | ✅ DONE | 4 hours | AI decisions matter | Complete |
| 3 | ✅ DONE | 2 hours | Users see reasoning | Complete |
| 4 | ✅ DONE | 6 hours | Interactive refinement | Complete |
| 5 | ✅ DONE | 5 hours | Production-grade data | **COMPLETE** |

---

## ✅ Success Criteria Met

1. ✅ Same user, different risk settings → different portfolios (Priority 2)
2. ✅ User can see which tools AI used and why (Priority 3)
3. ✅ User can ask follow-up questions and get refined recommendations (Priority 4)
4. ✅ Projections match real market data patterns (Priority 5)
5. ✅ Portfolio varies meaningfully across runs (all above)
6. ✅ Real prices and metrics grounded in 5-year historical data (Priority 5)
7. ✅ Expected returns reflect asset class reality (Priority 5)
8. ✅ Volatility calculated from actual market movements (Priority 5)

---

## ✅ Priority 5: Real Market Data Integration (COMPLETE)

### Goal
Replace synthetic historical data with real market data so projections are grounded in reality.

### Implementation

#### 5a. Backend Market Data API
**File:** `backend/main.py`

Added new endpoint `/api/market-data`:
```python
@app.get("/api/market-data")
async def get_market_data(tickers: str = "VTI,VXUS,BND,AAPL,MSFT,NVDA"):
  """Fetch real historical market data for given tickers."""
  # Uses yfinance to fetch 5-year historical data
  # Calculates real average returns and volatility for each ticker
  # Returns: prices array, dates, current_price, avg_return%, volatility%
```

Returns for each ticker:
- `prices`: Last 5 years of closing prices
- `dates`: Corresponding dates
- `current_price`: Most recent close
- `avg_return`: Annualized % return (252-day calculation)
- `volatility`: Annualized % volatility
- `data_points`: Number of data points

#### 5b. Frontend Real Data Portfolio Builder
**File:** `frontend/data.jsx`

Added new async function `buildPortfolioWithRealData`:
- Fetches real market data from `/api/market-data` endpoint
- Calculates real metrics from actual price history
- Adjusts expected returns based on real volatility and risk profile
- Uses real historical prices to build historical series (last 60 data points)
- Generates projections using real volatility and expected returns
- Falls back to synthetic data if real data unavailable

#### 5c. Integration with AI Agent
**File:** `frontend/app-ai.jsx`

Updated `goGenerateAI` to:
- Call `buildPortfolioWithRealData` with AI-selected tickers
- Use default tickers (VTI, VXUS, BND, AAPL, MSFT) if AI provides no stocks
- Graceful fallback chain:
  1. Real data with AI-selected stocks
  2. Real data with default stocks
  3. Synthetic data (last resort)

**Impact:** 
- ✅ Projections based on real market data patterns
- ✅ Expected returns calculated from actual historical performance
- ✅ Volatility reflects real market conditions
- ✅ AI recommendations grounded in reality, not fiction
- ✅ Users see realistic "best-case" and "worst-case" scenarios

### Real Data Workflow

1. **User generates portfolio** with AI
2. **AI selects stocks** via screen_stocks tool (e.g., healthcare, tech, bonds)
3. **Frontend fetches real data** for those tickers via `/api/market-data`
4. **Calculations use real metrics**:
   - Current prices from last market close
   - Historical returns from 5-year price series
   - Volatility from actual daily movements
5. **Projections reflect reality**:
   - Expected return = real historical return + risk adjustment
   - Volatility = real historical volatility
   - Low/Mid/High scenarios based on actual variance
6. **Chart shows**:
   - Historical Performance: Last 60 months of actual prices
   - Projected Trajectory: Forward 1-10 years using real metrics

### Example Real Data Integration

**Scenario:** User asks for retirement portfolio, AI selects healthcare sector

1. AI calls `screen_stocks({sector: "healthcare", user_goals: ["retire"]})`
2. Returns: `['JNJ', 'UNH', 'PFE', 'MRK', 'LLY']`
3. Frontend calls `/api/market-data?tickers=JNJ,UNH,PFE,MRK,LLY`
4. Backend returns:
   ```
   JNJ: { current_price: 155.40, avg_return: 8.3%, volatility: 12.1% }
   UNH: { current_price: 487.50, avg_return: 12.7%, volatility: 15.8% }
   ...
   ```
5. Portfolio built using REAL metrics, not hardcoded formulas
6. Projections show realistic healthcare sector returns (~10% annualized)

### Code Changes Summary

**Backend:**
- Added `/api/market-data` endpoint (55 lines)
- Uses yfinance for 5-year historical data
- Calculates real returns and volatility with 252-day annualization
- Error handling for missing/invalid tickers

**Frontend:**
- Added `buildPortfolioWithRealData` function (150 lines)
- Async fetch with error recovery
- Real price series building from market data
- Real metric calculations with risk adjustment
- Graceful fallback to synthetic data
- Exported on window object for global access

**Integration:**
- Updated `goGenerateAI` with real data pipeline
- 3-level fallback chain for reliability
- Maintains existing UI/UX, enhances under the hood

### Testing Checklist

When testing Priority 5:
1. ✅ Generate portfolio normally
2. ✅ Check that portfolio metrics are realistic:
   - Expected return should be 4-12% (not 0-100%)
   - Volatility should be 3-25% (reflects asset class)
3. ✅ Verify historical chart shows last 5 years of actual data
4. ✅ Check that different stocks have different expected returns
   - Tech (NVDA): ~15-20% return, high volatility
   - Healthcare (JNJ): ~8-12% return, moderate volatility
   - Bonds (BND): ~4-6% return, low volatility
5. ✅ Projections should be realistic (not 100x returns)
6. ✅ Toggle between different portfolios to see real variation

---

## Key Achievements

**Architecture:**
- ✅ Full ReAct loop: Groq API → tool calling → result streaming → frontend display
- ✅ AI's reasoning visible at every step (tool selection, input parameters, outputs)
- ✅ Conversational refinement loop: user asks → AI responds → portfolio updates

**User Experience:**
- ✅ Same input can produce different portfolios (AI thinks, not deterministic)
- ✅ Full transparency: users see why AI made each choice
- ✅ Interactive refinement: ask follow-up questions in real-time
- ✅ Graceful fallbacks: local generation if AI fails

**Code Quality:**
- ✅ Dynamic tool execution with error handling
- ✅ Streaming response architecture (immediate feedback to user)
- ✅ Clean separation: agent logic (backend) vs UI (frontend)
- ✅ Type hints and logging throughout

---

## Next Steps

1. **Before Priority 5:** Test Priority 4 thoroughly
   - Ask agent various questions
   - Verify portfolio updates based on feedback
   - Check error handling for API failures

2. **Priority 5 Implementation:**
   - Replace synthetic data with yfinance real-time data
   - Calculate real volatility/returns from historical prices
   - Update system prompt to reference real market conditions
   - Validate that projections are realistic (not over-optimistic)

3. **Polish & Launch:**
   - Add caching for frequently-requested data
   - Implement rate limiting for Groq API calls
   - Add analytics to track user engagement with agent
   - Document suggested questions for different scenarios

---

## Technical Debt

These should be addressed alongside the roadmap:

- **JSON parsing fragile** (`backend/main.py` line 50): Replace regex with proper JSON extraction
- **No error handling for malformed AI responses**: Add validation and schema checking
- **Tool definitions could be more specific**: Add stricter input/output schemas
- **No caching of historical data**: Add Redis or local cache for performance
- **Hardcoded portfolio metrics**: Make them AI-calculated based on selected stocks

---

## Success Metrics

Track these to measure progress:

- Percentage of portfolios using AI-selected stocks vs local fallback
- Average number of tool calls per request
- User engagement with reasoning section (% views, hover time)
- Time spent in Counsel screen (proxy for agent interaction)
- Portfolio diversity across different user inputs
- Completion rate for follow-up questions (abandonment vs answers received)

