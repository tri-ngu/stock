// Mock data + portfolio generator for Meridian.

// Fetch real market data from backend
async function fetchRealMarketData(tickers) {
  try {
    const tickerString = tickers.join(',');
    const response = await fetch(`/api/market-data?tickers=${tickerString}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.data || {};
  } catch (error) {
    console.error('Error fetching market data:', error);
    return {};
  }
}

// Build portfolio using real market data
async function buildPortfolioWithRealData(budget, risk, term, tickers) {
  try {
    // Fetch real data for the tickers
    const marketData = await fetchRealMarketData(tickers);

    if (Object.keys(marketData).length === 0) {
      // Fallback to synthetic if real data unavailable
      return buildPortfolio(budget, risk, term);
    }

    // Use real prices and metrics
    const positions = [];
    let totalWeight = 0;
    const allocations = {};

    // Calculate allocation weights based on risk
    const r = risk / 100;
    const eqUS    = 0.20 + 0.40 * r;
    const eqIntl  = 0.05 + 0.18 * r;
    const em      = 0.02 + 0.08 * r;
    const bonds   = 0.50 - 0.40 * r;
    const real    = 0.05 + 0.03 * r;
    const gold    = 0.04 + 0.02 * (1 - r);
    const cash    = Math.max(0.03, 0.10 - 0.05 * r);

    // Map tickers to their real data
    for (const ticker of tickers) {
      if (!marketData[ticker]) continue;

      const data = marketData[ticker];
      const holding = HOLDINGS_UNIVERSE.find(h => h.ticker === ticker);
      if (!holding) continue;

      const weight = allocations[ticker] || (1 / tickers.length);
      const dollars = weight * budget;
      const shares = +(dollars / data.current_price).toFixed(4);

      positions.push({
        ...holding,
        price: data.current_price,
        weight,
        dollars,
        shares,
      });

      totalWeight += weight;
    }

    // Calculate real metrics from market data
    let avgReturn = 0;
    let avgVol = 0;
    for (const ticker of tickers) {
      if (marketData[ticker]) {
        avgReturn += marketData[ticker].avg_return / tickers.length;
        avgVol += marketData[ticker].volatility / tickers.length;
      }
    }

    // Adjust metrics based on risk and diversification
    const expReturn = Math.max(2, avgReturn * (0.5 + r)) + (4.2 - 4.2 * r * 0.3);
    const vol = Math.max(3, avgVol * r);
    const sharpe = +((expReturn - 2) / vol).toFixed(2);
    const maxDD = -(vol * 1.5 + 5);

    // Build historical series from real data
    const yrs = term || 10;
    const series = [];
    const dates = marketData[tickers[0]]?.dates || [];

    if (dates.length > 0) {
      // Use last 60 data points or less
      const startIdx = Math.max(0, dates.length - 60);
      const dayPrices = marketData[tickers[0]]?.prices || [];

      for (let i = startIdx; i < dates.length; i++) {
        const dayIdx = i;
        const historicalPrice = dayPrices[dayIdx] || budget;
        // Normalize to match budget at end
        const value = (historicalPrice / (dayPrices[dayPrices.length - 1] || 1)) * budget * (0.8 + Math.random() * 0.4);
        series.push({
          time: dates[dayIdx],
          value: +value.toFixed(2)
        });
      }
    }

    // If no real series, use synthetic
    if (series.length === 0) {
      const seed = (risk * 9301 + 49297) % 233280;
      const rng = (n) => ((seed * (n + 1) * 9301 + 49297) % 233280) / 233280;
      let v = budget;
      const ANCHOR = { y: 2026, m: 4 };
      for (let i = 0; i < 60; i++) {
        const monthlyMu = expReturn / 1200;
        const monthlySigma = vol / Math.sqrt(12) / 100;
        const shock = (rng(i) - 0.5) * 2 * monthlySigma * 2;
        v = v * (1 + monthlyMu + shock);
        const monthsBack = 59 - i;
        let m = ANCHOR.m - monthsBack;
        let y = ANCHOR.y;
        while (m < 0) { m += 12; y--; }
        while (m > 11) { m -= 12; y++; }
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        series.push({ time: dateStr, value: +v.toFixed(2) });
      }
    }

    // Daily series (30 days ending May 12, 2026)
    const dailySeries = [];
    const dailySeed = (risk * 1049 + 7919) % 233280;
    const drng = (n) => ((dailySeed * (n + 1) * 9301 + 49297) % 233280) / 233280;
    let dv = series[series.length - 1].value;
    const END = new Date(2026, 4, 12);
    for (let i = 29; i >= 0; i--) {
      const date = new Date(END);
      date.setDate(date.getDate() - i);
      const dailyMu = expReturn / 36500;
      const dailySigma = vol / Math.sqrt(252) / 100;
      const shock = (drng(i) - 0.5) * 2 * dailySigma * 1.5;
      dv = dv * (1 + dailyMu + shock);
      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dailySeries.push({ time: ds, value: +dv.toFixed(2) });
    }

    // Projected trajectory (forward-looking)
    const projectedSeries = [];
    const projSeed = (risk * 7919 + 1049) % 233280;
    const prng = (n) => ((projSeed * (n + 1) * 9301 + 49297) % 233280) / 233280;
    let pv = dv;
    const START = new Date(2026, 4, 12);
    for (let i = 0; i <= yrs * 12; i++) {
      const date = new Date(START);
      date.setMonth(date.getMonth() + i);
      const monthlyMu = expReturn / 1200;
      const monthlySigma = vol / Math.sqrt(12) / 100;
      const shock = (prng(i) - 0.5) * 2 * monthlySigma * 2;
      pv = pv * (1 + monthlyMu + shock);
      const ps = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      projectedSeries.push({ time: ps, value: +pv.toFixed(2) });
    }

    // Projected metrics
    const projLow  = budget * Math.pow(1 + (expReturn / 100) - vol / 100, yrs);
    const projMid  = budget * Math.pow(1 + expReturn / 100, yrs);
    const projHigh = budget * Math.pow(1 + (expReturn / 100) + vol / 200, yrs);

    return {
      budget, risk, term: yrs,
      positions,
      metrics: { expReturn, vol, sharpe, maxDD, projLow, projMid, projHigh },
      series,
      dailySeries,
      projectedSeries,
    };
  } catch (error) {
    console.error('Error building portfolio with real data:', error);
    // Fallback to synthetic
    return buildPortfolio(budget, risk, term);
  }
}

const HOLDINGS_UNIVERSE = [
  { ticker: 'VTI',  name: 'Total US Market ETF',           sector: 'US Equity',     price: 274.51, day: 0.42 },
  { ticker: 'VXUS', name: 'Total Intl Stock ETF',          sector: 'Intl Equity',   price:  65.20, day: 0.18 },
  { ticker: 'VWO',  name: 'Emerging Markets ETF',          sector: 'Emerging Mkts', price:  46.83, day: -0.31 },
  { ticker: 'BND',  name: 'Total Bond Market ETF',         sector: 'Bonds',         price:  73.84, day: 0.06 },
  { ticker: 'TLT',  name: '20+ Yr Treasury Bond',          sector: 'Bonds',         price:  93.12, day: -0.22 },
  { ticker: 'GLD',  name: 'SPDR Gold Shares',              sector: 'Commodities',   price: 218.40, day: 0.55 },
  { ticker: 'AAPL', name: 'Apple Inc.',                    sector: 'US Equity',     price: 226.74, day: 1.12 },
  { ticker: 'MSFT', name: 'Microsoft Corp.',               sector: 'US Equity',     price: 438.21, day: 0.84 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.',                  sector: 'US Equity',     price: 142.17, day: 2.04 },
  { ticker: 'GOOGL',name: 'Alphabet Inc.',                 sector: 'US Equity',     price: 178.92, day: 0.66 },
  { ticker: 'BRK.B',name: 'Berkshire Hathaway',            sector: 'US Equity',     price: 471.50, day: 0.21 },
  { ticker: 'JNJ',  name: 'Johnson & Johnson',             sector: 'US Equity',     price: 155.40, day: -0.18 },
  { ticker: 'VNQ',  name: 'Vanguard Real Estate ETF',      sector: 'Real Estate',   price:  93.05, day: 0.32 },
  { ticker: 'SHV',  name: 'Short Treasury Bond ETF',       sector: 'Cash Eq.',      price: 110.21, day: 0.01 },
];

// Build an allocation given budget + risk (0–100).
function buildPortfolio(budget, risk, term) {
  // risk 0 → conservative, 100 → aggressive
  const r = risk / 100;
  const eqUS    = 0.20 + 0.40 * r;
  const eqIntl  = 0.05 + 0.18 * r;
  const em      = 0.02 + 0.08 * r;
  const bonds   = 0.50 - 0.40 * r;
  const real    = 0.05 + 0.03 * r;
  const gold    = 0.04 + 0.02 * (1 - r);
  const cash    = Math.max(0.03, 0.10 - 0.05 * r);

  const targets = {
    'US Equity':     eqUS,
    'Intl Equity':   eqIntl,
    'Emerging Mkts': em,
    'Bonds':         bonds,
    'Real Estate':   real,
    'Commodities':   gold,
    'Cash Eq.':      cash,
  };

  // Normalize.
  const total = Object.values(targets).reduce((s, v) => s + v, 0);
  for (const k in targets) targets[k] /= total;

  // Pick holdings per bucket. For US Equity, blend an index ETF + 2-3 leaders
  // when risk is high.
  const positions = [];
  const push = (ticker, weight) => {
    const h = HOLDINGS_UNIVERSE.find((x) => x.ticker === ticker);
    if (!h) return;
    const dollars = weight * budget;
    const shares = +(dollars / h.price).toFixed(4);
    positions.push({ ...h, weight, dollars, shares });
  };

  // US Equity: VTI core + leaders proportional to risk
  push('VTI', targets['US Equity'] * (r > 0.6 ? 0.55 : r > 0.3 ? 0.75 : 0.95));
  if (r > 0.3) {
    push('AAPL', targets['US Equity'] * (r > 0.6 ? 0.12 : 0.10));
    push('MSFT', targets['US Equity'] * (r > 0.6 ? 0.12 : 0.08));
  }
  if (r > 0.6) {
    push('NVDA', targets['US Equity'] * 0.10);
    push('GOOGL', targets['US Equity'] * 0.08);
  }
  if (r < 0.3) {
    push('BRK.B', targets['US Equity'] * 0.05);
  }

  push('VXUS', targets['Intl Equity']);
  push('VWO', targets['Emerging Mkts']);

  // Bonds: BND + TLT split
  push('BND', targets['Bonds'] * (r > 0.5 ? 0.65 : 0.55));
  push('TLT', targets['Bonds'] * (r > 0.5 ? 0.35 : 0.45));

  push('VNQ', targets['Real Estate']);
  push('GLD', targets['Commodities']);
  push('SHV', targets['Cash Eq.']);

  // Renormalize so total weight ≈ 1 after rounding artifacts.
  const wSum = positions.reduce((s, p) => s + p.weight, 0);
  for (const p of positions) {
    p.weight /= wSum;
    p.dollars = p.weight * budget;
    p.shares = +(p.dollars / p.price).toFixed(4);
  }

  // Compute aggregate metrics.
  const expReturn = 4.2 + 6.8 * r;       // annualized %
  const vol       = 4.5 + 12 * r;        // annualized stdev %
  const sharpe    = +((expReturn - 4.2) / vol).toFixed(2);
  const maxDD     = -(8 + 22 * r);

  // Projected value at term
  const yrs = term || 10;
  const projLow  = budget * Math.pow(1 + (expReturn / 100) - vol / 100, yrs);
  const projMid  = budget * Math.pow(1 + expReturn / 100, yrs);
  const projHigh = budget * Math.pow(1 + (expReturn / 100) + vol / 200, yrs);

  // Synthetic backtest sparkline (60 months = 5 years)
  const seed = (risk * 9301 + 49297) % 233280;
  const rng = (n) => ((seed * (n + 1) * 9301 + 49297) % 233280) / 233280;
  const series = [];
  let v = budget;
  const ANCHOR = { y: 2026, m: 4 }; // May 2026 (0-indexed month)
  for (let i = 0; i < 60; i++) {
    const monthlyMu = expReturn / 1200;
    const monthlySigma = vol / Math.sqrt(12) / 100;
    const shock = (rng(i) - 0.5) * 2 * monthlySigma * 2;
    v = v * (1 + monthlyMu + shock);
    const monthsBack = 59 - i;
    let m = ANCHOR.m - monthsBack;
    let y = ANCHOR.y;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    series.push({ time: dateStr, value: +v.toFixed(2) });
  }

  // Daily series for 1M view (30 days ending May 12, 2026)
  const dailySeries = [];
  const dailySeed = (risk * 1049 + 7919) % 233280;
  const drng = (n) => ((dailySeed * (n + 1) * 9301 + 49297) % 233280) / 233280;
  let dv = series[series.length - 1].value;
  const END = new Date(2026, 4, 12);
  for (let i = 29; i >= 0; i--) {
    const date = new Date(END);
    date.setDate(date.getDate() - i);
    const dailyMu = expReturn / 36500;
    const dailySigma = vol / Math.sqrt(252) / 100;
    const shock = (drng(i) - 0.5) * 2 * dailySigma * 1.5;
    dv = dv * (1 + dailyMu + shock);
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dailySeries.push({ time: ds, value: +dv.toFixed(2) });
  }

  // Projected trajectory (forward-looking for portfolio.term years)
  const projectedSeries = [];
  const projSeed = (risk * 7919 + 1049) % 233280;
  const prng = (n) => ((projSeed * (n + 1) * 9301 + 49297) % 233280) / 233280;
  let pv = dv;
  const START = new Date(2026, 4, 12);
  for (let i = 0; i <= yrs * 12; i++) {
    const date = new Date(START);
    date.setMonth(date.getMonth() + i);
    const monthlyMu = expReturn / 1200;
    const monthlySigma = vol / Math.sqrt(12) / 100;
    const shock = (prng(i) - 0.5) * 2 * monthlySigma * 2;
    pv = pv * (1 + monthlyMu + shock);
    const ps = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    projectedSeries.push({ time: ps, value: +pv.toFixed(2) });
  }

  return {
    budget, risk, term: yrs,
    positions,
    targets,
    metrics: { expReturn, vol, sharpe, maxDD, projLow, projMid, projHigh },
    series,
    dailySeries,
    projectedSeries,
  };
}

const SECTOR_COLORS = {
  'US Equity':     'oklch(0.52 0.10 145)',
  'Intl Equity':   'oklch(0.55 0.10 220)',
  'Emerging Mkts': 'oklch(0.58 0.13 60)',
  'Bonds':         'oklch(0.48 0.05 280)',
  'Real Estate':   'oklch(0.55 0.10 30)',
  'Commodities':   'oklch(0.65 0.12 90)',
  'Cash Eq.':      'oklch(0.65 0.02 280)',
};

const RISK_LABELS = [
  { max: 15,  label: 'Capital preservation', desc: 'Income & stability. Minimal equity exposure.' },
  { max: 35,  label: 'Conservative',         desc: 'Income with modest growth. Bond-heavy.' },
  { max: 55,  label: 'Balanced',             desc: 'Equal weighting of growth and income.' },
  { max: 75,  label: 'Growth',               desc: 'Long-horizon appreciation. Equity-tilted.' },
  { max: 101, label: 'Aggressive growth',    desc: 'Maximum compounding. Concentrated in equities.' },
];
const riskLabelFor = (r) => RISK_LABELS.find((x) => r < x.max);

const GOALS = [
  { id: 'retire',  label: 'Retirement',           hint: 'Long horizon, tax-efficient compounding' },
  { id: 'house',   label: 'Down payment',         hint: 'Capital preservation for a near-term purchase' },
  { id: 'wealth',  label: 'Wealth building',      hint: 'Open-ended growth across the cycle' },
  { id: 'income',  label: 'Passive income',       hint: 'Dividend + interest yield orientation' },
  { id: 'edu',     label: 'Education fund',       hint: 'Medium horizon, glide-path de-risking' },
  { id: 'legacy',  label: 'Legacy & estate',      hint: 'Multi-decade horizon, tax-advantaged' },
];

const MARKET_HEADLINES = [
  { t: '14:02', kind: 'macro',  text: 'Fed minutes signal patient stance; long-end yields rally 4 bps.' },
  { t: '13:48', kind: 'sector', text: 'Semiconductors lead tape — equipment names breaking out on cycle.' },
  { t: '13:35', kind: 'flow',   text: 'Net buying in investment-grade credit for the fourth session.' },
  { t: '13:12', kind: 'note',   text: 'Earnings revisions for the S&P 500 turned positive month-over-month.' },
  { t: '12:55', kind: 'macro',  text: 'Core CPI prints in line; rates market trims one cut from year-end.' },
];

const AGENT_STEPS = [
  { label: 'Reading market conditions',          detail: 'Pulling end-of-day prices across 8,412 securities.' },
  { label: 'Modeling risk-return frontier',      detail: 'Optimizing weights against your declared posture.' },
  { label: 'Stress-testing against 2008, 2020',  detail: 'Validating drawdown tolerance at 95% confidence.' },
  { label: 'Selecting cost-efficient instruments', detail: 'Preferring low-fee ETFs and tax-aware lots.' },
  { label: 'Drafting position summary',          detail: 'Compiling allocations, projections, and counsel.' },
];

const WEEKLY_ACTIVITY = {
  weekOf: 'May 4 — May 10, 2026',
  summary: {
    pnl: 412.38,
    pnlPct: 0.83,
    trades: 4,
    dividends: 22.14,
    bestTicker: 'NVDA',
    worstTicker: 'TLT',
  },
  movers: [
    { ticker: 'NVDA', name: 'NVIDIA Corp.',     wk:  6.84, note: 'Lifted by record data-center guide.' },
    { ticker: 'AAPL', name: 'Apple Inc.',       wk:  2.12, note: 'Services revenue surprised to the upside.' },
    { ticker: 'VTI',  name: 'Total US Market',  wk:  1.04, note: 'Broad tape ground higher on cooling CPI.' },
    { ticker: 'VWO',  name: 'Emerging Markets', wk: -0.92, note: 'USD strength weighed on EM equities.' },
    { ticker: 'TLT',  name: '20+ Yr Treasury',  wk: -1.46, note: 'Long-end sold off after hot retail sales.' },
  ],
  ledger: [
    { d: 'May 10', kind: 'DIV',  ticker: 'VTI',  detail: 'Dividend received',         amt:  14.22 },
    { d: 'May 09', kind: 'BUY',  ticker: 'MSFT', detail: '+0.42 sh @ 438.21',         amt: -184.05 },
    { d: 'May 08', kind: 'REBAL',ticker: 'BND',  detail: 'Rebalance · trim',          amt:  +96.40 },
    { d: 'May 07', kind: 'DIV',  ticker: 'VNQ',  detail: 'Dividend received',         amt:   7.92 },
    { d: 'May 06', kind: 'BUY',  ticker: 'NVDA', detail: '+0.18 sh @ 142.17',         amt:  -25.59 },
    { d: 'May 04', kind: 'SELL', ticker: 'GLD',  detail: '−0.05 sh @ 218.40',         amt:  +10.92 },
  ],
};

const FUTURE_ACTIONS = [
  { when: 'Within 30 days',  action: 'Rebalance', detail: 'Quarterly drift exceeds 4% threshold in US equity.', impact: '+ 0.18% expected return' },
  { when: 'Q3 2026',         action: 'Tax-loss harvest', detail: 'Realize losses in VWO to offset year-to-date gains.', impact: 'Est. $312 tax savings' },
  { when: 'On milestone',    action: 'Glide-path step', detail: 'Term horizon shortens — shift 5% from equities to bonds.', impact: '↓ Volatility by 1.4%' },
];

// Categorized recommendations for the Counsel page. Each category has an
// `auto` flag (mapped onto a tweak key) which, when on, lets the agent run
// any of its actions without per-action authorization.
const ACTION_CATEGORIES = [
  {
    id: 'rebalance',
    tweakKey: 'autoRebalance',
    label: 'Rebalancing',
    desc: 'Bring allocations back to target as they drift.',
    actions: [
      { when: 'Within 30 days', action: 'Quarterly rebalance',  detail: 'Drift exceeds 4% threshold in US equity.',                       impact: '+0.18% expected return' },
      { when: 'On milestone',   action: 'Glide-path step',      detail: 'Term horizon shortens — shift 5% from equities to bonds.',       impact: '↓ Volatility 1.4%' },
    ],
  },
  {
    id: 'tax',
    tweakKey: 'autoTax',
    label: 'Tax optimization',
    desc: 'Reduce drag from taxes through systematic harvesting.',
    actions: [
      { when: 'Q3 2026',  action: 'Tax-loss harvest',     detail: 'Realize losses in VWO to offset year-to-date gains.',                 impact: 'Est. $312 tax savings' },
      { when: 'Year-end', action: 'Lot-level selection',  detail: 'Prefer high-cost-basis lots when raising cash.',                      impact: 'Est. $185 deferred' },
    ],
  },
  {
    id: 'income',
    tweakKey: 'autoIncome',
    label: 'Income & cash sweep',
    desc: 'Put idle cash and distributions to work.',
    actions: [
      { when: 'Weekly',      action: 'Dividend reinvestment', detail: 'Auto-reinvest VTI, VNQ, BND distributions.',                       impact: '+$22 / quarter' },
      { when: 'On deposit',  action: 'Cash sweep to SHV',     detail: 'Move balances over $500 into short Treasuries.',                   impact: '+4.8% APY on idle' },
    ],
  },
  {
    id: 'risk',
    tweakKey: 'autoRisk',
    label: 'Risk management',
    desc: 'Monitor exposures and intervene during stress.',
    actions: [
      { when: 'Monthly',     action: 'Concentration check',   detail: 'Trim any position exceeding 12% of portfolio weight.',             impact: 'Caps idiosyncratic risk' },
      { when: 'On drawdown', action: 'Volatility hedge',      detail: 'Buy 2% protective puts on the index if VIX exceeds 28.',           impact: '↓ Max drawdown ~3%' },
    ],
  },
];

// Tradable instruments for the search/trade UI — superset of HOLDINGS_UNIVERSE.
const TRADABLE_UNIVERSE = [
  ...HOLDINGS_UNIVERSE,
  { ticker: 'TSLA', name: 'Tesla, Inc.',                   sector: 'US Equity',     price: 218.92, day: -1.24 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.',               sector: 'US Equity',     price: 192.30, day:  0.74 },
  { ticker: 'META', name: 'Meta Platforms',                sector: 'US Equity',     price: 528.41, day:  1.32 },
  { ticker: 'JPM',  name: 'JPMorgan Chase',                sector: 'US Equity',     price: 218.10, day:  0.21 },
  { ticker: 'XLE',  name: 'Energy Select Sector SPDR',     sector: 'US Equity',     price:  94.32, day: -0.84 },
  { ticker: 'IEFA', name: 'Core MSCI EAFE ETF',            sector: 'Intl Equity',   price:  78.55, day:  0.12 },
  { ticker: 'AGG',  name: 'Core US Aggregate Bond',        sector: 'Bonds',         price:  98.40, day:  0.04 },
  { ticker: 'TIP',  name: 'TIPS Bond ETF',                 sector: 'Bonds',         price: 108.92, day:  0.10 },
];

// Apply an array of {ticker, side, shares} orders to a portfolio.
// Returns a NEW portfolio object — does not mutate.
function applyOrdersToPortfolio(portfolio, orders) {
  if (!orders || !orders.length) return portfolio;
  const positions = portfolio.positions.map((p) => ({ ...p }));
  for (const o of orders) {
    const idx = positions.findIndex((p) => p.ticker === o.ticker);
    const sign = o.side === 'buy' ? 1 : -1;
    if (idx >= 0) {
      const p = positions[idx];
      const newShares = +(p.shares + sign * o.shares).toFixed(4);
      if (newShares <= 0.0001) {
        positions.splice(idx, 1);
      } else {
        positions[idx] = { ...p, shares: newShares, dollars: newShares * p.price };
      }
    } else if (sign === 1) {
      const inst = TRADABLE_UNIVERSE.find((t) => t.ticker === o.ticker);
      if (inst) {
        positions.push({ ...inst, shares: o.shares, dollars: o.shares * inst.price, weight: 0 });
      }
    }
  }
  const totalDollars = positions.reduce((s, p) => s + p.dollars, 0) || 1;
  for (const p of positions) p.weight = p.dollars / totalDollars;
  return { ...portfolio, positions, budget: totalDollars };
}

// Portfolio period buttons based on investment horizon
function getPeriodsForTerm(term) {
  if (term <= 0.5) return ['1M', '3M', '6M'];           // 6-month horizon: only show up to horizon
  if (term <= 1) return ['1M', '3M', '6M', '1Y'];       // 1-year horizon: show up to 1Y
  if (term <= 3) return ['1M', '3M', '6M', '1Y'];       // Up to 3 years
  if (term <= 7) return ['1M', '3M', '6M', '1Y', '3Y'];  // Up to 7 years
  return ['1M', '3M', '6M', '1Y', '3Y', '5Y'];          // 7+ years
}

Object.assign(window, { HOLDINGS_UNIVERSE, TRADABLE_UNIVERSE, buildPortfolio, buildPortfolioWithRealData, applyOrdersToPortfolio, SECTOR_COLORS, RISK_LABELS, riskLabelFor, GOALS, MARKET_HEADLINES, AGENT_STEPS, FUTURE_ACTIONS, ACTION_CATEGORIES, WEEKLY_ACTIVITY, getPeriodsForTerm });
