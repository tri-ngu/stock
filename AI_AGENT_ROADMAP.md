# Meridian AI Agent - Development Roadmap

## Current Status (Post Priority 1)
✅ **Priority 1 Complete:** Frontend now receives and uses AI's portfolio response
- callAIAgent collects portfolio, tool_calls, and reasoning from backend
- goGenerateAI uses AI portfolio when available (fallback to local buildPortfolio)
- AI reasoning steps are passed to portfolio object

---

## Priority 2: Backend Tools - Make AI Decisions Matter

### Current State
- Stock screener hardcoded to 10 megacap tech stocks
- Portfolio builder uses fixed 5-ticker basket regardless of AI reasoning
- AI's judgment about user goals has zero influence on stock selection

### Required Changes

**File:** `backend/agent/tools.py`

#### 2a. Dynamic Stock Screener
```python
def stock_screener(criteria: dict) -> dict:
  """
  criteria: {
    'market_cap': 'large' | 'mid' | 'small',
    'sector': 'tech' | 'healthcare' | 'finance' | 'energy' | 'consumer',
    'dividend_yield': 'high' | 'moderate' | 'growth',
    'user_goals': ['retire', 'wealth', 'income']
  }
  """
  
  # Universe by sector - AI picks sector based on user goals
  all_stocks = {
    'tech': ['AAPL', 'MSFT', 'NVDA', 'META', 'CRM'],
    'healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV', 'TMO'],
    'finance': ['JPM', 'BAC', 'GS', 'MS', 'BLK'],
    'energy': ['XOM', 'CVX', 'COP', 'SLB', 'MPC'],
    'consumer': ['PG', 'KO', 'WMT', 'HD', 'MCD'],
  }
  
  sector = criteria.get('sector', 'tech')
  candidates = all_stocks.get(sector, all_stocks['tech'])
  
  # Filter by dividend if user goal is 'income'
  if 'income' in criteria.get('user_goals', []):
    candidates = filter_by_dividend_yield(candidates, 'high')
  
  return {
    'stocks': candidates[:5],
    'reasoning': f'Selected {sector} stocks for {criteria.get("user_goals", [])}'
  }
```

#### 2b. Dynamic Portfolio Builder
- Accept AI-selected stocks from stock_screener
- Optimize over those stocks, not hardcoded basket
- Return portfolio that reflects AI's reasoning

**Impact:** Same user input now produces different portfolios based on AI reasoning about goals and risk.

---

## Priority 3: Add Reasoning Visibility

### Goal
Users see what the AI is thinking - which tools it called, why, and what it concluded.

### Required Changes

**File:** `frontend/screens-portfolio.jsx`

Add reasoning section after projected trajectory:
```jsx
{portfolio.agentReasoning?.steps && portfolio.agentReasoning.steps.length > 0 && (
  <section style={{ marginTop: 28 }}>
    <Eyebrow>AI Agent Reasoning</Eyebrow>
    <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.6 }}>
      {portfolio.agentReasoning.steps.map((step, i) => (
        <div key={i} style={{ marginBottom: 8, padding: '8px', background: 'var(--surface)', border: '1px solid var(--rule)' }}>
          <strong style={{ color: 'var(--ink)' }}>→ {step.tool}</strong>
          <div style={{ color: 'var(--ink-mute)', marginTop: 4 }}>{JSON.stringify(step.reasoning)}</div>
        </div>
      ))}
    </div>
  </section>
)}
```

**Impact:** Users understand AI's decision-making process, builds trust, makes refinement easier.

---

## Priority 4: Interactive Agent Refinement

### Goal
Let users chat with agent about recommendations, ask "why?", request alternatives.

### Required Changes

**File:** `frontend/screens-portfolio.jsx` (Counsel section)

Add agent chat interface:
```jsx
const [agentMessages, setAgentMessages] = useState([]);
const [agentInput, setAgentInput] = useState('');

const askAgent = async (question) => {
  const msg = `The user asked about the portfolio: "${question}"`;
  const result = await callAIAgent(msg, sessionId);
  
  setAgentMessages(prev => [...prev, {
    role: 'user',
    content: question
  }, {
    role: 'assistant',
    content: result.text
  }]);
};
```

Suggested user flows:
- "Why did you choose NVDA?"
- "Make this more conservative"
- "Show me an alternative portfolio"
- "Reduce tech exposure"

**Impact:** Agent becomes conversational, can refine recommendations in real-time.

---

## Priority 5: Real Market Data Integration

### Goal
Replace synthetic historical data with real market data so projections are grounded in reality.

### Required Changes

#### 5a. Add Real Data API
**File:** `backend/main.py`

```python
@app.route('/api/prices', methods=['GET'])
def get_prices():
  """Fetch real historical prices for given tickers"""
  tickers = request.args.get('tickers', '').split(',')
  # Use yfinance, finnhub, or other provider
  prices = fetch_historical_prices(tickers, period='5y')
  return jsonify(prices)
```

#### 5b. Use Real Data in Projections
**File:** `frontend/data.jsx`

```js
async function buildPortfolioWithRealData(tickers, budget, risk, term) {
  const prices = await fetch(`/api/prices?tickers=${tickers.join(',')}`);
  const history = await prices.json();
  
  // Calculate REAL returns and volatility
  const expReturn = calculateFromHistory(history);
  const vol = calculateVolatilityFromHistory(history);
  const correlation = calculateCorrelationMatrix(history);
  
  // Optimize on real data
  const optimized = meanVarianceOptimization(tickers, expReturn, vol, correlation, risk);
  
  // Project based on real data patterns
  const series = generateProjections(history, expReturn, vol, term);
  
  return { portfolio: optimized, series };
}
```

**Impact:** Projections become realistic, AI recommendations grounded in market reality.

---

## Implementation Timeline

| Priority | Effort | Impact | Estimated Time |
|----------|--------|--------|-----------------|
| 1 (DONE) | 30 min | Agent output actually used | ✅ Complete |
| 2 | 4 hours | AI decisions matter | Week 2 |
| 3 | 2 hours | Users see reasoning | Week 3 |
| 4 | 6 hours | Interactive refinement | Week 4 |
| 5 | 8 hours | Production-grade data | Week 5 |

---

## Success Criteria

The AI Agent is fully functional when:

1. **Same user, different risk settings → different portfolios** (Priority 2)
2. **User can see which tools AI used and why** (Priority 3)
3. **User can ask follow-up questions and get refined recommendations** (Priority 4)
4. **Projections match real market data patterns** (Priority 5)
5. **Portfolio varies meaningfully across runs** (all above)

---

## Technical Debt

These should be addressed alongside the roadmap:

- **JSON parsing fragile** (`backend/main.py` line 50): Replace regex with proper JSON extraction
- **No error handling for malformed AI responses**: Add validation and schema checking
- **Tool definitions could be more specific**: Add input/output schemas to agent tools
- **No caching of historical data**: Add Redis or local cache for performance
- **Hardcoded portfolio metrics**: Make them AI-calculated based on selected stocks

---

## Success Metrics

Track these to measure progress:

- Percentage of portfolios using AI-selected stocks vs local fallback
- Average number of tool calls per request
- User engagement with reasoning section
- Time spent in Counsel screen (proxy for agent interaction)
- Portfolio diversity across different user inputs

