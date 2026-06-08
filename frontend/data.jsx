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

// Build portfolio using real market data.
// aiPortfolio — full backend portfolio object (includes optimized positions dict).
async function buildPortfolioWithRealData(budget, risk, term, tickers, aiPortfolio) {
  try {
    const marketData = await fetchRealMarketData(tickers);
    const r = risk / 100;

    // Backend-optimized dollar allocations (ticker → dollars).
    // These come from the MVO optimizer and already enforce the risk-level split.
    const aiPos = aiPortfolio?.positions || null;

    // Per-position editorial analysis from backend (keyed by ticker)
    const posDetailsList = aiPortfolio?.position_details || [];
    const posDetails = {};
    for (const d of posDetailsList) posDetails[d.ticker] = d;

    // ── Build positions ──────────────────────────────────────────────────
    const positions = [];
    for (const ticker of tickers) {
      // Look up metadata — extended universe first, then 14-ticker base, then generic fallback
      const meta = EXTENDED_TICKER_LOOKUP[ticker]
        || HOLDINGS_UNIVERSE.find(h => h.ticker === ticker)
        || { ticker, name: ticker, sector: 'US Equity', price: 100, day: 0 };

      // Prefer live market price from backend; fall back to static lookup price
      const price = (marketData[ticker]?.current_price > 0)
        ? marketData[ticker].current_price
        : meta.price;

      // Dollar allocation: backend-optimized first, then equal-weight fallback
      const dollars = (aiPos && aiPos[ticker] != null)
        ? Math.max(0, Number(aiPos[ticker]))
        : budget / tickers.length;

      if (dollars <= 0 || price <= 0) continue;

      const d = posDetails[ticker] || {};
      // Frontend fallbacks — use curated TICKER_METRICS and SECTOR_ALT_POOL when backend didn't provide editorial data
      const tm = TICKER_METRICS[ticker] || {};
      const secPeers = (SECTOR_ALT_POOL[meta.sector] || [])
        .filter(a => a.ticker !== ticker).slice(0, 3)
        .map(p => ({ ticker: p.ticker, note: `→ ${p.ticker} offers comparable ${meta.sector} sector exposure as a sector peer.` }));
      const wPct = (dollars / budget * 100).toFixed(1);
      positions.push({
        ticker,
        name:   meta.name,
        sector: meta.sector,
        price,
        weight:  dollars / budget,   // provisional — normalised below
        dollars,
        shares:  +(dollars / price).toFixed(4),
        day:     meta.day || 0,
        // Editorial card fields — backend data first, frontend fallbacks second
        signal:         d.signal          || tm.signal || 'hold',
        headline:       d.headline        || '',
        whyThisStock:   d.why_this_stock  || tm.note   || '',
        allocationLogic:d.allocation_logic || `At ${wPct}%, this position is sized in line with its sector weight and risk-level allocation targets for the portfolio.`,
        sectorRole:     d.sector_role     || `${meta.sector} sector contribution — adds diversified exposure aligned with the portfolio's allocation targets.`,
        goalAlignment:  d.goal_alignment  || "This holding supports the portfolio's investment objectives through sector diversification and risk-adjusted allocation.",
        peers:          (d.peers && d.peers.length) ? d.peers : secPeers,
        verdicts:       d.verdicts        || [],
      });
    }

    if (positions.length === 0) return buildPortfolio(budget, risk, term);

    // Normalise weights → exactly 100 %
    const wSum = positions.reduce((s, p) => s + p.weight, 0);
    if (wSum > 0 && Math.abs(wSum - 1) > 0.001) {
      for (const p of positions) {
        p.weight  /= wSum;
        p.dollars  = p.weight * budget;
        p.shares   = +(p.dollars / p.price).toFixed(4);
      }
    }

    // Sort heaviest first for display
    positions.sort((a, b) => b.weight - a.weight);

    // ── Aggregate metrics from real market data ──────────────────────────
    let avgReturn = 0, avgVol = 0, n = 0;
    for (const t of tickers) {
      if (marketData[t]) { avgReturn += marketData[t].avg_return; avgVol += marketData[t].volatility; n++; }
    }
    if (n > 0) { avgReturn /= n; avgVol /= n; }

    const expReturn = n > 0
      ? Math.max(2, avgReturn * (0.5 + r) + (4.2 - 4.2 * r * 0.3))
      : 4.2 + 6.8 * r;
    const vol = n > 0
      ? Math.max(3, avgVol * (0.3 + 0.7 * r))
      : 4.5 + 12 * r;
    const sharpe = +((expReturn - 2) / Math.max(0.01, vol)).toFixed(2);
    const maxDD  = -(vol * 1.5 + 5);

    // ── Historical series (36 months from real data, or synthetic) ───────
    const yrs = term || 10;
    const series = [];
    const anchorTicker = tickers.find(t => marketData[t]?.dates?.length > 1);

    if (anchorTicker) {
      const dates = marketData[anchorTicker].dates;
      const prices = marketData[anchorTicker].prices;
      const monthMap = {};
      for (let i = 0; i < dates.length; i++) monthMap[dates[i].substring(0, 7)] = prices[i];
      const months = Object.keys(monthMap).sort().slice(-36);
      const endP   = monthMap[months[months.length - 1]] || 1;
      for (const mk of months) {
        series.push({ time: mk + '-01', value: +((monthMap[mk] / endP) * budget).toFixed(2) });
      }
    }

    if (series.length === 0) {
      const seed = (risk * 9301 + 49297) % 233280;
      const rng  = (i) => ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
      let v = budget;
      const A = { y: 2026, m: 4 };
      for (let i = 0; i < 60; i++) {
        v = v * (1 + expReturn / 1200 + (rng(i) - 0.5) * 2 * (vol / Math.sqrt(12) / 100) * 2);
        const mb = 59 - i;
        let m = A.m - mb, y = A.y;
        while (m < 0)  { m += 12; y--; }
        while (m > 11) { m -= 12; y++; }
        series.push({ time: `${y}-${String(m + 1).padStart(2, '0')}-01`, value: +v.toFixed(2) });
      }
    }

    // ── Daily 30-day series ──────────────────────────────────────────────
    const dailySeries = [];
    const ds = (risk * 1049 + 7919) % 233280;
    const drng = (i) => ((ds * (i + 1) * 9301 + 49297) % 233280) / 233280;
    let dv = series[series.length - 1].value;
    const END = new Date(2026, 4, 12);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(END); d.setDate(d.getDate() - i);
      dv = dv * (1 + expReturn / 36500 + (drng(i) - 0.5) * 2 * (vol / Math.sqrt(252) / 100) * 1.5);
      dailySeries.push({
        time:  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        value: +dv.toFixed(2),
      });
    }

    // ── Projected forward series ─────────────────────────────────────────
    const projectedSeries = [];
    const ps = (risk * 7919 + 1049) % 233280;
    const prng = (i) => ((ps * (i + 1) * 9301 + 49297) % 233280) / 233280;
    let pv = dv;
    const START = new Date(2026, 4, 12);
    for (let i = 0; i <= yrs * 12; i++) {
      const d = new Date(START); d.setMonth(d.getMonth() + i);
      pv = pv * (1 + expReturn / 1200 + (prng(i) - 0.5) * 2 * (vol / Math.sqrt(12) / 100) * 2);
      projectedSeries.push({
        time:  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        value: +pv.toFixed(2),
      });
    }

    const projLow  = budget * Math.pow(1 + (expReturn - vol) / 100, yrs);
    const projMid  = budget * Math.pow(1 + expReturn / 100, yrs);
    const projHigh = budget * Math.pow(1 + (expReturn + vol / 2) / 100, yrs);

    return {
      budget, risk, term: yrs,
      positions,
      metrics: { expReturn, vol, sharpe, maxDD, projLow, projMid, projHigh },
      series, dailySeries, projectedSeries,
    };
  } catch (error) {
    console.error('Error building portfolio with real data:', error);
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

// Comprehensive ticker lookup — covers every ticker the AI backend can return.
// Used by buildPortfolioWithRealData so no AI-selected stock is ever silently dropped.
const EXTENDED_TICKER_LOOKUP = {
  // ── Existing base tickers (keep sector labels compatible with SECTOR_COLORS) ──
  'VTI':  { name: 'Total US Market ETF',           sector: 'US Equity',    price: 274.51, day:  0.42 },
  'VXUS': { name: 'Total Intl Stock ETF',           sector: 'Intl Equity',  price:  65.20, day:  0.18 },
  'VWO':  { name: 'Emerging Markets ETF',           sector: 'Emerging Mkts',price:  46.83, day: -0.31 },
  'BND':  { name: 'Total Bond Market ETF',          sector: 'Bonds',        price:  73.84, day:  0.06 },
  'TLT':  { name: '20+ Yr Treasury Bond ETF',       sector: 'Bonds',        price:  93.12, day: -0.22 },
  'GLD':  { name: 'SPDR Gold Shares',               sector: 'Commodities',  price: 218.40, day:  0.55 },
  'VNQ':  { name: 'Vanguard Real Estate ETF',       sector: 'Real Estate',  price:  93.05, day:  0.32 },
  'SHV':  { name: 'Short Treasury Bond ETF',        sector: 'Bonds',        price: 110.21, day:  0.01 },
  // ── Technology ──────────────────────────────────────────────────────────────
  'AAPL': { name: 'Apple Inc.',                     sector: 'Technology',   price: 226.74, day:  1.12 },
  'MSFT': { name: 'Microsoft Corp.',                sector: 'Technology',   price: 438.21, day:  0.84 },
  'NVDA': { name: 'NVIDIA Corp.',                   sector: 'Technology',   price: 142.17, day:  2.04 },
  'GOOGL':{ name: 'Alphabet Inc.',                  sector: 'Technology',   price: 178.92, day:  0.66 },
  'META': { name: 'Meta Platforms',                 sector: 'Technology',   price: 528.41, day:  1.32 },
  'AMZN': { name: 'Amazon.com Inc.',                sector: 'Technology',   price: 192.30, day:  0.74 },
  'AMD':  { name: 'Advanced Micro Devices',         sector: 'Technology',   price: 160.42, day:  1.84 },
  'AVGO': { name: 'Broadcom Inc.',                  sector: 'Technology',   price: 198.50, day:  0.92 },
  'ORCL': { name: 'Oracle Corp.',                   sector: 'Technology',   price: 143.12, day:  0.56 },
  'CRM':  { name: 'Salesforce Inc.',                sector: 'Technology',   price: 263.44, day:  0.48 },
  'ADBE': { name: 'Adobe Inc.',                     sector: 'Technology',   price: 377.21, day:  0.38 },
  'NFLX': { name: 'Netflix Inc.',                   sector: 'Technology',   price: 648.10, day:  1.14 },
  'QCOM': { name: 'Qualcomm Inc.',                  sector: 'Technology',   price: 151.84, day:  0.64 },
  'TSLA': { name: 'Tesla, Inc.',                    sector: 'Technology',   price: 218.92, day: -1.24 },
  'INTC': { name: 'Intel Corp.',                    sector: 'Technology',   price:  20.14, day: -0.42 },
  'QQQ':  { name: 'Invesco QQQ Trust',              sector: 'Technology',   price: 481.22, day:  0.88 },
  // ── Healthcare ──────────────────────────────────────────────────────────────
  'JNJ':  { name: 'Johnson & Johnson',              sector: 'Healthcare',   price: 155.40, day: -0.18 },
  'LLY':  { name: 'Eli Lilly & Co.',                sector: 'Healthcare',   price: 782.34, day:  1.24 },
  'UNH':  { name: 'UnitedHealth Group',             sector: 'Healthcare',   price: 490.12, day: -0.84 },
  'ABBV': { name: 'AbbVie Inc.',                    sector: 'Healthcare',   price: 186.42, day:  0.32 },
  'TMO':  { name: 'Thermo Fisher Scientific',       sector: 'Healthcare',   price: 498.54, day:  0.44 },
  'ABT':  { name: 'Abbott Laboratories',            sector: 'Healthcare',   price: 118.22, day:  0.28 },
  'MDT':  { name: 'Medtronic plc',                  sector: 'Healthcare',   price:  84.62, day: -0.14 },
  'AMGN': { name: 'Amgen Inc.',                     sector: 'Healthcare',   price: 306.18, day:  0.42 },
  'GILD': { name: 'Gilead Sciences',                sector: 'Healthcare',   price:  86.34, day:  0.18 },
  'REGN': { name: 'Regeneron Pharmaceuticals',      sector: 'Healthcare',   price: 558.22, day:  0.64 },
  'VRTX': { name: 'Vertex Pharmaceuticals',         sector: 'Healthcare',   price: 468.14, day:  0.52 },
  'BMY':  { name: 'Bristol-Myers Squibb',           sector: 'Healthcare',   price:  57.84, day: -0.28 },
  'CI':   { name: 'The Cigna Group',                sector: 'Healthcare',   price: 340.22, day:  0.18 },
  'HUM':  { name: 'Humana Inc.',                    sector: 'Healthcare',   price: 290.84, day: -1.12 },
  'MRK':  { name: 'Merck & Co.',                    sector: 'Healthcare',   price:  88.42, day:  0.14 },
  // ── Financials ──────────────────────────────────────────────────────────────
  'BRK.B':{ name: 'Berkshire Hathaway',             sector: 'Financials',   price: 471.50, day:  0.21 },
  'BLK':  { name: 'BlackRock Inc.',                 sector: 'Financials',   price: 892.44, day:  0.62 },
  'GS':   { name: 'Goldman Sachs',                  sector: 'Financials',   price: 542.18, day:  0.84 },
  'JPM':  { name: 'JPMorgan Chase',                 sector: 'Financials',   price: 218.10, day:  0.21 },
  'MS':   { name: 'Morgan Stanley',                 sector: 'Financials',   price: 116.42, day:  0.38 },
  'AXP':  { name: 'American Express',               sector: 'Financials',   price: 282.34, day:  0.44 },
  'COF':  { name: 'Capital One Financial',          sector: 'Financials',   price: 172.84, day:  0.28 },
  'PGR':  { name: 'Progressive Corp.',              sector: 'Financials',   price: 242.18, day:  0.56 },
  'ICE':  { name: 'Intercontinental Exchange',      sector: 'Financials',   price: 148.42, day:  0.34 },
  'CME':  { name: 'CME Group',                      sector: 'Financials',   price: 218.84, day:  0.22 },
  'SPGI': { name: 'S&P Global Inc.',                sector: 'Financials',   price: 488.22, day:  0.48 },
  'CB':   { name: 'Chubb Ltd.',                     sector: 'Financials',   price: 272.84, day:  0.14 },
  'TRV':  { name: 'Travelers Companies',            sector: 'Financials',   price: 248.42, day:  0.24 },
  'PRU':  { name: 'Prudential Financial',           sector: 'Financials',   price: 112.84, day:  0.18 },
  'BAC':  { name: 'Bank of America',                sector: 'Financials',   price:  42.18, day:  0.28 },
  'SCHW': { name: 'Charles Schwab',                 sector: 'Financials',   price:  72.84, day:  0.42 },
  'V':    { name: 'Visa Inc.',                      sector: 'Financials',   price: 318.42, day:  0.54 },
  'MA':   { name: 'Mastercard Inc.',                sector: 'Financials',   price: 488.18, day:  0.62 },
  // ── Energy ──────────────────────────────────────────────────────────────────
  'XOM':  { name: 'Exxon Mobil Corp.',              sector: 'Energy',       price: 108.42, day: -0.34 },
  'CVX':  { name: 'Chevron Corp.',                  sector: 'Energy',       price: 148.84, day: -0.28 },
  'COP':  { name: 'ConocoPhillips',                 sector: 'Energy',       price: 108.42, day: -0.42 },
  'EOG':  { name: 'EOG Resources',                  sector: 'Energy',       price: 128.84, day: -0.38 },
  'HES':  { name: 'Hess Corp.',                     sector: 'Energy',       price:  84.42, day: -0.54 },
  'DVN':  { name: 'Devon Energy',                   sector: 'Energy',       price:  32.84, day: -0.64 },
  'OXY':  { name: 'Occidental Petroleum',           sector: 'Energy',       price:  48.42, day: -0.42 },
  'MPC':  { name: 'Marathon Petroleum',             sector: 'Energy',       price: 148.84, day: -0.28 },
  'VLO':  { name: 'Valero Energy',                  sector: 'Energy',       price: 138.42, day: -0.34 },
  'PSX':  { name: 'Phillips 66',                    sector: 'Energy',       price: 128.84, day: -0.28 },
  'KMI':  { name: 'Kinder Morgan',                  sector: 'Energy',       price:  22.84, day:  0.14 },
  'WMB':  { name: 'Williams Companies',             sector: 'Energy',       price:  42.42, day:  0.18 },
  'SLB':  { name: 'SLB (Schlumberger)',             sector: 'Energy',       price:  44.84, day: -0.64 },
  'HAL':  { name: 'Halliburton Co.',                sector: 'Energy',       price:  28.42, day: -0.48 },
  'ET':   { name: 'Energy Transfer LP',             sector: 'Energy',       price:  16.84, day:  0.12 },
  // ── Consumer ────────────────────────────────────────────────────────────────
  'COST': { name: 'Costco Wholesale',               sector: 'Consumer',     price: 878.42, day:  0.42 },
  'HD':   { name: 'Home Depot Inc.',                sector: 'Consumer',     price: 328.84, day:  0.28 },
  'LOW':  { name: "Lowe's Companies",               sector: 'Consumer',     price: 248.42, day:  0.22 },
  'TGT':  { name: 'Target Corp.',                   sector: 'Consumer',     price: 128.84, day: -0.42 },
  'NKE':  { name: 'Nike Inc.',                      sector: 'Consumer',     price:  72.42, day: -0.34 },
  'SBUX': { name: 'Starbucks Corp.',                sector: 'Consumer',     price:  82.84, day: -0.18 },
  'YUM':  { name: 'Yum! Brands',                    sector: 'Consumer',     price: 128.42, day:  0.14 },
  'DG':   { name: 'Dollar General',                 sector: 'Consumer',     price:  88.84, day: -0.28 },
  'DLTR': { name: 'Dollar Tree Inc.',               sector: 'Consumer',     price:  72.42, day: -0.34 },
  'MCD':  { name: "McDonald's Corp.",               sector: 'Consumer',     price: 298.84, day:  0.18 },
  'PG':   { name: 'Procter & Gamble',               sector: 'Consumer',     price: 162.42, day:  0.12 },
  'KO':   { name: 'Coca-Cola Co.',                  sector: 'Consumer',     price:  68.84, day:  0.08 },
  'PEP':  { name: 'PepsiCo Inc.',                   sector: 'Consumer',     price: 158.42, day:  0.06 },
  'CL':   { name: 'Colgate-Palmolive',              sector: 'Consumer',     price:  94.84, day:  0.14 },
  'WMT':  { name: 'Walmart Inc.',                   sector: 'Consumer',     price:  92.42, day:  0.22 },
  // ── Bonds / Fixed Income ────────────────────────────────────────────────────
  'AGG':  { name: 'Core US Aggregate Bond ETF',     sector: 'Bonds',        price:  98.40, day:  0.04 },
  'LQD':  { name: 'IG Corporate Bond ETF',          sector: 'Bonds',        price: 108.42, day:  0.08 },
  'IEF':  { name: '7-10yr Treasury Bond ETF',       sector: 'Bonds',        price:  94.84, day: -0.12 },
  'HYG':  { name: 'High Yield Corp Bond ETF',       sector: 'Bonds',        price:  78.42, day:  0.06 },
  'TIP':  { name: 'TIPS Bond ETF',                  sector: 'Bonds',        price: 108.92, day:  0.10 },
  'MUB':  { name: 'Municipal Bond ETF',             sector: 'Bonds',        price: 106.84, day:  0.04 },
  'VCIT': { name: 'Intermed Corp Bond ETF',         sector: 'Bonds',        price:  78.84, day:  0.06 },
  'VCSH': { name: 'Short-Term Corp Bond ETF',       sector: 'Bonds',        price:  76.42, day:  0.02 },
  'BSV':  { name: 'Short-Term Bond ETF',            sector: 'Bonds',        price:  74.84, day:  0.02 },
  // ── Real Estate ─────────────────────────────────────────────────────────────
  'PLD':  { name: 'Prologis Inc.',                  sector: 'Real Estate',  price: 112.84, day:  0.42 },
  'AMT':  { name: 'American Tower Corp.',           sector: 'Real Estate',  price: 188.42, day:  0.28 },
  'EQIX': { name: 'Equinix Inc.',                   sector: 'Real Estate',  price: 802.84, day:  0.64 },
  'CCI':  { name: 'Crown Castle Inc.',              sector: 'Real Estate',  price: 102.42, day: -0.34 },
  'PSA':  { name: 'Public Storage',                 sector: 'Real Estate',  price: 288.84, day:  0.18 },
  'O':    { name: 'Realty Income Corp.',            sector: 'Real Estate',  price:  52.42, day:  0.12 },
  'AVB':  { name: 'AvalonBay Communities',          sector: 'Real Estate',  price: 192.84, day:  0.22 },
  'EXR':  { name: 'Extra Space Storage',            sector: 'Real Estate',  price: 148.42, day:  0.16 },
  'SPG':  { name: 'Simon Property Group',           sector: 'Real Estate',  price: 148.84, day:  0.24 },
  // ── International ───────────────────────────────────────────────────────────
  'EFA':  { name: 'MSCI EAFE ETF',                  sector: 'Intl Equity',  price:  82.42, day:  0.16 },
  'IEFA': { name: 'Core MSCI EAFE ETF',             sector: 'Intl Equity',  price:  78.55, day:  0.12 },
  'VEA':  { name: 'Developed Markets ETF',          sector: 'Intl Equity',  price:  48.84, day:  0.14 },
  'EEM':  { name: 'iShares MSCI EM ETF',            sector: 'Emerging Mkts',price:  42.42, day: -0.28 },
  'IEMG': { name: 'Core MSCI Emerging Mkts ETF',    sector: 'Emerging Mkts',price:  52.84, day: -0.18 },
  'DGS':  { name: 'WisdomTree EM SmallCap Div',     sector: 'Emerging Mkts',price:  48.42, day: -0.34 },
  'SPDW': { name: 'SPDR Portfolio Developed',       sector: 'Intl Equity',  price:  34.84, day:  0.12 },
  'ACWX': { name: 'All Country World ex-US ETF',    sector: 'Intl Equity',  price:  54.42, day:  0.14 },
  // ── Diversified ETFs ────────────────────────────────────────────────────────
  'VOO':  { name: 'Vanguard S&P 500 ETF',           sector: 'US Equity',    price: 508.42, day:  0.44 },
  'SPY':  { name: 'SPDR S&P 500 ETF',               sector: 'US Equity',    price: 568.84, day:  0.42 },
  'IVV':  { name: 'iShares S&P 500 ETF',            sector: 'US Equity',    price: 568.42, day:  0.42 },
  'SCHB': { name: 'Schwab US Broad Market ETF',     sector: 'US Equity',    price:  60.84, day:  0.44 },
  'VIG':  { name: 'Dividend Appreciation ETF',      sector: 'US Equity',    price: 192.42, day:  0.28 },
  'DGRO': { name: 'Dividend Growth ETF',            sector: 'US Equity',    price:  58.84, day:  0.24 },
  'NOBL': { name: 'Dividend Aristocrats ETF',       sector: 'US Equity',    price:  96.42, day:  0.18 },
  'DVY':  { name: 'Select Dividend ETF',            sector: 'US Equity',    price: 128.84, day:  0.14 },
};

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

  // US Equity: VTI core + randomly selected individual leaders so no two
  // portfolios always contain the same names.
  const vtiFrac = r > 0.6 ? 0.50 : r > 0.3 ? 0.72 : 0.95;
  push('VTI', targets['US Equity'] * vtiFrac);
  if (r <= 0.3) {
    push('BRK.B', targets['US Equity'] * 0.05);
  } else {
    const leaderPool = r > 0.6
      ? ['NVDA', 'GOOGL', 'MSFT', 'AAPL', 'JNJ']
      : ['MSFT', 'AAPL', 'GOOGL', 'BRK.B', 'JNJ'];
    const nPicks = r > 0.6 ? 3 : 2;
    const shuffled = leaderPool.slice().sort(() => Math.random() - 0.5);
    const perStock = (targets['US Equity'] * (1 - vtiFrac)) / nPicks;
    shuffled.slice(0, nPicks).forEach(t => push(t, perStock));
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
  // Base sectors (profile sketch + buildPortfolio fallback)
  'US Equity':     'oklch(0.52 0.10 145)',
  'Intl Equity':   'oklch(0.55 0.10 220)',
  'Emerging Mkts': 'oklch(0.58 0.13 60)',
  'Bonds':         'oklch(0.48 0.05 280)',
  'Real Estate':   'oklch(0.55 0.10 30)',
  'Commodities':   'oklch(0.65 0.12 90)',
  'Cash Eq.':      'oklch(0.65 0.02 280)',
  // AI-portfolio sectors
  'Technology':    'oklch(0.48 0.14 268)',
  'Healthcare':    'oklch(0.52 0.12 160)',
  'Financials':    'oklch(0.58 0.10 45)',
  'Energy':        'oklch(0.62 0.12 75)',
  'Consumer':      'oklch(0.56 0.10 185)',
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
      {
        when: 'Within 30 days', action: 'Quarterly rebalance', detail: 'Drift exceeds 4% threshold in US equity.', impact: '+0.18% expected return',
        why: 'Drift above 4% is the crossover point where the expected-return drag from misallocation exceeds the transaction cost of rebalancing. Acting now captures the efficiency gain before drift widens further and compounds the gap.',
        trigger: 'US equity weight has drifted beyond the 4% threshold above target, detected during monthly drift monitoring against the model portfolio.',
      },
      {
        when: 'On milestone', action: 'Glide-path step', detail: 'Term horizon shortens — shift 5% from equities to bonds.', impact: '↓ Volatility 1.4%',
        why: 'As your time horizon compresses, equity volatility becomes a larger threat to your goal than opportunity cost. Shifting capital to bonds now locks in a more conservative allocation before the higher-drawdown window opens.',
        trigger: 'Remaining investment term has crossed below the glide-path step threshold in your risk profile, signaling the transition from growth-phase to preservation-phase allocation.',
      },
    ],
  },
  {
    id: 'tax',
    tweakKey: 'autoTax',
    label: 'Tax optimization',
    desc: 'Reduce drag from taxes through systematic harvesting.',
    actions: [
      {
        when: 'Q3 2026', action: 'Tax-loss harvest', detail: 'Realize losses in VWO to offset year-to-date gains.', impact: 'Est. $312 tax savings',
        why: 'Harvesting losses in VWO converts unrealized losses into a usable tax asset — offsetting realized gains elsewhere and reducing the tax owed this year. A replacement ETF can maintain sector continuity during the wash-sale window, preserving exposure without sacrificing the benefit.',
        trigger: "VWO shows year-to-date unrealized losses sufficient to generate the estimated savings, and the 30-day wash-sale window is clear for Q3 realization.",
      },
      {
        when: 'Year-end', action: 'Lot-level selection', detail: 'Prefer high-cost-basis lots when raising cash.', impact: 'Est. $185 deferred',
        why: 'When selling, choosing high-cost-basis lots minimizes the taxable gain per dollar raised. This defers the capital gains liability and keeps more of the portfolio compounding — a free efficiency gain that requires no change to position or strategy.',
        trigger: 'A cash-raising event (redemption, rebalance, or withdrawal) is detected. The system identifies the optimal lot sequence before execution to maximize cost-basis efficiency.',
      },
    ],
  },
  {
    id: 'income',
    tweakKey: 'autoIncome',
    label: 'Income & cash sweep',
    desc: 'Put idle cash and distributions to work.',
    actions: [
      {
        when: 'Weekly', action: 'Dividend reinvestment', detail: 'Auto-reinvest VTI, VNQ, BND distributions.', impact: '+$22 / quarter',
        why: 'Reinvesting distributions eliminates cash drag and preserves the full compounding effect of dividends — which historically account for a large share of total equity returns over long horizons. Letting distributions sit as cash breaks that compounding chain.',
        trigger: 'A dividend or distribution is received from VTI, VNQ, or BND. Reinvestment executes at market open the following trading day into the same position.',
      },
      {
        when: 'On deposit', action: 'Cash sweep to SHV', detail: 'Move balances over $500 into short Treasuries.', impact: '+4.8% APY on idle',
        why: 'Idle cash earns nothing and creates return drag. SHV (iShares Short Treasury Bond) provides near-money-market yield with minimal interest-rate risk — extracting return from balances that would otherwise sit uninvested between deployments.',
        trigger: 'Portfolio cash balance exceeds $500 following a deposit, dividend receipt, or partial sale, triggering an automatic sweep into SHV at next available execution.',
      },
    ],
  },
  {
    id: 'risk',
    tweakKey: 'autoRisk',
    label: 'Risk management',
    desc: 'Monitor exposures and intervene during stress.',
    actions: [
      {
        when: 'Monthly', action: 'Concentration check', detail: 'Trim any position exceeding 12% of portfolio weight.', impact: 'Caps idiosyncratic risk',
        why: "A single position above 12% of portfolio weight introduces idiosyncratic risk — risk tied to one company's specific events — beyond what diversification can offset. Trimming enforces the discipline of not letting winners crowd out the rest of the portfolio and erode diversification over time.",
        trigger: 'Monthly position sizing review detects any holding crossing the 12% threshold, either from price appreciation or underweight growth elsewhere in the portfolio.',
      },
      {
        when: 'On drawdown', action: 'Volatility hedge', detail: 'Buy 2% protective puts on the index if VIX exceeds 28.', impact: '↓ Max drawdown ~3%',
        why: 'When the VIX signals sustained market-wide fear, protective puts provide asymmetric downside insurance. The premium cost is bounded at 2%, while the protection activates precisely when drawdown risk is highest — making it a cost-efficient hedge rather than a standing drag.',
        trigger: 'VIX closes above 28 on two consecutive sessions, indicating sustained elevated volatility rather than a brief spike. Index puts are purchased with a 30-day expiry.',
      },
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

// ── Per-ticker synthetic metrics for analysis & peer comparison ───────────────
const TICKER_METRICS = {
  // Diversified / ETFs
  'VTI':   { pe: 22.4, divYield: 1.32, ret52w: 19.8, proj12m: 10.2, signal: 'hold',       note: 'Broad market core; low cost, maximum diversification.' },
  'VXUS':  { pe: 14.8, divYield: 2.84, ret52w: 14.2, proj12m:  8.8, signal: 'hold',       note: 'International hedge; benefits from weaker USD cycles.' },
  'VWO':   { pe: 12.4, divYield: 3.24, ret52w:  8.4, proj12m:  9.2, signal: 'hold',       note: 'Emerging market growth at valuation discount vs US.' },
  'BND':   { pe: null, divYield: 4.18, ret52w:  3.2, proj12m:  4.4, signal: 'hold',       note: 'Rate-sensitive; hold for income and volatility buffer.' },
  'TLT':   { pe: null, divYield: 4.52, ret52w: -8.1, proj12m:  6.2, signal: 'hold',       note: 'Long-duration risk; watch Fed signals before adding.' },
  'AGG':   { pe: null, divYield: 4.22, ret52w:  3.4, proj12m:  4.6, signal: 'hold',       note: 'Core investment-grade bond exposure; low duration risk.' },
  'LQD':   { pe: null, divYield: 5.14, ret52w:  4.1, proj12m:  5.2, signal: 'hold',       note: 'IG corporate spread provides yield premium over Treasuries.' },
  'IEF':   { pe: null, divYield: 3.84, ret52w:  1.2, proj12m:  4.2, signal: 'hold',       note: 'Intermediate Treasury duration; moderate rate sensitivity.' },
  'HYG':   { pe: null, divYield: 6.42, ret52w:  5.4, proj12m:  6.4, signal: 'hold',       note: 'High-yield credit spread; equity-like risk in stress scenarios.' },
  'GLD':   { pe: null, divYield: 0.00, ret52w: 18.4, proj12m:  8.2, signal: 'overweight', note: 'Inflation hedge with strong momentum and geopolitical bid.' },
  'VNQ':   { pe: 36.4, divYield: 4.12, ret52w:  2.8, proj12m:  7.4, signal: 'hold',       note: 'Rate-sensitive REIT; set to benefit from rate cuts.' },
  'SHV':   { pe: null, divYield: 5.12, ret52w:  5.1, proj12m:  4.8, signal: 'hold',       note: 'Cash equivalent; max liquidity, no duration risk.' },
  'BRK.B': { pe: 14.2, divYield: 0.00, ret52w:  8.4, proj12m:  7.8, signal: 'hold',       note: 'Defensive value; insurance float + operating earnings backstop.' },
  // Technology
  'AAPL':  { pe: 31.2, divYield: 0.48, ret52w: 12.1, proj12m:  9.4, signal: 'hold',       note: 'Mature growth; high-margin services mix supports premium.' },
  'MSFT':  { pe: 35.8, divYield: 0.72, ret52w: 16.4, proj12m: 12.1, signal: 'hold',       note: 'Cloud + AI tailwinds support valuation; Copilot monetisation.' },
  'NVDA':  { pe: 52.1, divYield: 0.03, ret52w: 89.3, proj12m: 22.4, signal: 'overweight', note: 'AI infrastructure demand accelerating; data-center cycle strong.' },
  'GOOGL': { pe: 24.6, divYield: 0.00, ret52w: 28.4, proj12m: 14.8, signal: 'overweight', note: 'Search + cloud at reasonable valuation; Gemini integration upside.' },
  'META':  { pe: 28.4, divYield: 0.40, ret52w: 41.2, proj12m: 18.4, signal: 'overweight', note: 'Ad revenue recovery + AI investment cycle; Reality Labs drag fading.' },
  'AMZN':  { pe: 40.2, divYield: 0.00, ret52w: 32.1, proj12m: 16.2, signal: 'overweight', note: 'AWS margin expansion drives earnings; advertising segment accelerating.' },
  'AVGO':  { pe: 38.4, divYield: 1.52, ret52w: 44.2, proj12m: 19.8, signal: 'overweight', note: 'Custom AI silicon and networking demand driving outsized growth.' },
  'AMD':   { pe: 45.2, divYield: 0.00, ret52w: 22.4, proj12m: 16.8, signal: 'hold',       note: 'Data-center GPU share gains vs NVDA; PC cycle recovery adds upside.' },
  'TSLA':  { pe: 68.4, divYield: 0.00, ret52w: -8.2, proj12m: 10.4, signal: 'hold',       note: 'Energy business and FSD optionality offset near-term margin pressure.' },
  'NFLX':  { pe: 42.1, divYield: 0.00, ret52w: 62.4, proj12m: 18.2, signal: 'hold',       note: 'Ad tier and password-sharing crackdown drove subscriber re-acceleration.' },
  'ORCL':  { pe: 32.4, divYield: 1.12, ret52w: 24.8, proj12m: 13.4, signal: 'hold',       note: 'Cloud infrastructure deal wins accelerating; multi-cloud positioning.' },
  'CRM':   { pe: 38.2, divYield: 0.00, ret52w: 18.4, proj12m: 11.8, signal: 'hold',       note: 'AI Agentforce integration supports ARPU expansion across enterprise base.' },
  'ADBE':  { pe: 30.4, divYield: 0.00, ret52w: 14.2, proj12m: 11.4, signal: 'hold',       note: 'Creative + document cloud defensible; Firefly AI extends competitive moat.' },
  'QCOM':  { pe: 18.4, divYield: 2.24, ret52w: 14.4, proj12m: 11.2, signal: 'hold',       note: 'Automotive and IoT diversification offsets handset concentration risk.' },
  'INTC':  { pe: 28.4, divYield: 1.84, ret52w:-32.4, proj12m:  6.4, signal: 'hold',       note: 'Foundry strategy execution risk; process node recovery is multi-year.' },
  // Healthcare
  'LLY':   { pe: 52.4, divYield: 0.72, ret52w: 42.1, proj12m: 18.2, signal: 'overweight', note: 'GLP-1 obesity franchise (Zepbound/Mounjaro) drives multi-year earnings ramp.' },
  'UNH':   { pe: 22.4, divYield: 1.52, ret52w:  8.4, proj12m: 10.4, signal: 'hold',       note: 'Managed care scale advantage; Optum vertical integration adds margin.' },
  'ABBV':  { pe: 18.4, divYield: 3.52, ret52w: 12.4, proj12m: 11.2, signal: 'hold',       note: 'Humira biosimilar headwinds partially offset by Skyrizi and Rinvoq ramp.' },
  'JNJ':   { pe: 16.8, divYield: 3.12, ret52w: -4.2, proj12m:  5.1, signal: 'hold',       note: 'Pharma spin-off drag; stable yield with litigation headwinds.' },
  'TMO':   { pe: 28.4, divYield: 0.22, ret52w: 14.2, proj12m: 12.4, signal: 'hold',       note: 'Life-sciences tools leader; bioprocessing recovery supports re-acceleration.' },
  'AMGN':  { pe: 14.2, divYield: 3.12, ret52w:  4.2, proj12m:  8.4, signal: 'hold',       note: 'Established biologics franchise; obesity drug pipeline adds optionality.' },
  'GILD':  { pe: 12.4, divYield: 3.84, ret52w:  8.4, proj12m:  9.2, signal: 'hold',       note: 'HIV franchise durable; oncology pipeline (TL-1A) emerging catalyst.' },
  'MRK':   { pe: 14.8, divYield: 2.92, ret52w: -8.4, proj12m:  7.2, signal: 'hold',       note: 'Keytruda patent cliff a long-term risk; vaccine pipeline provides buffer.' },
  'ABT':   { pe: 22.4, divYield: 1.92, ret52w: 12.4, proj12m:  9.8, signal: 'hold',       note: 'Diagnostics and MedTech diversification; FreeStyle Libre growth durable.' },
  // Financials
  'JPM':   { pe: 12.4, divYield: 2.52, ret52w: 28.4, proj12m: 12.4, signal: 'hold',       note: 'Best-in-class franchise; ROTCE leadership sustainable through the cycle.' },
  'GS':    { pe: 14.2, divYield: 2.12, ret52w: 34.2, proj12m: 14.8, signal: 'overweight', note: 'Capital markets and M&A backlog recovery; trading desk strong.' },
  'BLK':   { pe: 22.4, divYield: 2.14, ret52w: 18.4, proj12m: 11.2, signal: 'hold',       note: 'AUM scale and alternatives expansion; ETF ecosystem durable moat.' },
  'V':     { pe: 28.4, divYield: 0.82, ret52w: 22.4, proj12m: 13.4, signal: 'hold',       note: 'Network effect moat; cross-border payment volume resilient to rate cycle.' },
  'MA':    { pe: 32.4, divYield: 0.62, ret52w: 18.4, proj12m: 13.8, signal: 'hold',       note: 'Services revenue mix and B2B payments expansion drive premium multiple.' },
  'SPGI':  { pe: 36.4, divYield: 0.82, ret52w: 14.2, proj12m: 11.8, signal: 'hold',       note: 'Ratings and data moats durable; issuance cycle recovery is a tailwind.' },
  'BAC':   { pe: 12.8, divYield: 2.84, ret52w: 24.4, proj12m: 10.8, signal: 'hold',       note: 'Rate-sensitive NII; consumer credit quality stable, deposit base large.' },
  'AXP':   { pe: 18.4, divYield: 1.24, ret52w: 22.4, proj12m: 12.4, signal: 'hold',       note: 'Premium cardholder resilience; spending volume and fee income growing.' },
  // Energy
  'XOM':   { pe: 12.4, divYield: 3.52, ret52w:  4.2, proj12m:  8.4, signal: 'hold',       note: 'Pioneer acquisition improves Permian cost structure; dividend well covered.' },
  'CVX':   { pe: 14.2, divYield: 4.12, ret52w:  2.4, proj12m:  8.8, signal: 'hold',       note: 'Balance sheet strength supports buybacks; Hess deal extends growth runway.' },
  'COP':   { pe: 12.8, divYield: 3.14, ret52w:  6.4, proj12m:  9.2, signal: 'hold',       note: 'Variable + base dividend model rewarding; low-cost unconventional assets.' },
  'EOG':   { pe: 10.4, divYield: 2.84, ret52w:  2.2, proj12m:  8.2, signal: 'hold',       note: 'Premium E&P discipline; Dorado gas play provides long-duration optionality.' },
  'OXY':   { pe:  8.4, divYield: 1.52, ret52w: -4.2, proj12m:  7.8, signal: 'hold',       note: 'CrownRock integration underway; Buffett stake provides sentiment support.' },
  // Consumer
  'COST':  { pe: 48.4, divYield: 0.62, ret52w: 28.4, proj12m: 13.4, signal: 'hold',       note: 'Membership renewal rate approaching 93%; international expansion durable.' },
  'HD':    { pe: 22.4, divYield: 2.52, ret52w: 12.4, proj12m: 10.4, signal: 'hold',       note: 'Pro contractor market resilient; housing turnover recovery is the catalyst.' },
  'MCD':   { pe: 22.4, divYield: 2.42, ret52w:  4.2, proj12m:  8.8, signal: 'hold',       note: 'Value platform and digital loyalty driving traffic in a cautious consumer.' },
  'KO':    { pe: 24.4, divYield: 3.12, ret52w:  4.4, proj12m:  7.4, signal: 'hold',       note: 'Pricing power demonstrated; emerging market volumes support modest growth.' },
  'WMT':   { pe: 32.4, divYield: 1.22, ret52w: 24.4, proj12m: 12.4, signal: 'hold',       note: 'Advertising and marketplace revenue streams diversifying earnings quality.' },
  'PEP':   { pe: 20.4, divYield: 3.42, ret52w: -2.4, proj12m:  7.2, signal: 'hold',       note: 'Volume pressure from GLP-1 snacking impact; pricing moderation needed.' },
  'PG':    { pe: 26.4, divYield: 2.42, ret52w:  4.8, proj12m:  7.8, signal: 'hold',       note: 'Premium portfolio pricing; emerging market mix shift supports long term.' },
};

// Peer alternatives per sector — used for switch suggestions and comparison rows
const SECTOR_ALT_POOL = {
  // ── AI portfolio sectors ────────────────────────────────────────────────────
  'Technology': [
    { ticker: 'NVDA',  name: 'NVIDIA Corp.',          pe: 52.1, divYield: 0.03, ret52w: 89.3, proj12m: 22.4 },
    { ticker: 'AVGO',  name: 'Broadcom Inc.',          pe: 38.4, divYield: 1.52, ret52w: 44.2, proj12m: 19.8 },
    { ticker: 'META',  name: 'Meta Platforms',         pe: 28.4, divYield: 0.40, ret52w: 41.2, proj12m: 18.4 },
    { ticker: 'AMZN',  name: 'Amazon.com',             pe: 40.2, divYield: 0.00, ret52w: 32.1, proj12m: 16.2 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.',          pe: 24.6, divYield: 0.00, ret52w: 28.4, proj12m: 14.8 },
    { ticker: 'AMD',   name: 'Advanced Micro Devices', pe: 45.2, divYield: 0.00, ret52w: 22.4, proj12m: 16.8 },
    { ticker: 'MSFT',  name: 'Microsoft Corp.',        pe: 35.8, divYield: 0.72, ret52w: 16.4, proj12m: 12.1 },
    { ticker: 'AAPL',  name: 'Apple Inc.',             pe: 31.2, divYield: 0.48, ret52w: 12.1, proj12m:  9.4 },
  ],
  'Healthcare': [
    { ticker: 'LLY',  name: 'Eli Lilly & Co.',         pe: 52.4, divYield: 0.72, ret52w: 42.1, proj12m: 18.2 },
    { ticker: 'TMO',  name: 'Thermo Fisher Scientific', pe: 28.4, divYield: 0.22, ret52w: 14.2, proj12m: 12.4 },
    { ticker: 'UNH',  name: 'UnitedHealth Group',       pe: 22.4, divYield: 1.52, ret52w:  8.4, proj12m: 10.4 },
    { ticker: 'ABBV', name: 'AbbVie Inc.',              pe: 18.4, divYield: 3.52, ret52w: 12.4, proj12m: 11.2 },
    { ticker: 'ABT',  name: 'Abbott Laboratories',      pe: 22.4, divYield: 1.92, ret52w: 12.4, proj12m:  9.8 },
    { ticker: 'AMGN', name: 'Amgen Inc.',               pe: 14.2, divYield: 3.12, ret52w:  4.2, proj12m:  8.4 },
    { ticker: 'GILD', name: 'Gilead Sciences',          pe: 12.4, divYield: 3.84, ret52w:  8.4, proj12m:  9.2 },
  ],
  'Financials': [
    { ticker: 'GS',   name: 'Goldman Sachs',    pe: 14.2, divYield: 2.12, ret52w: 34.2, proj12m: 14.8 },
    { ticker: 'V',    name: 'Visa Inc.',         pe: 28.4, divYield: 0.82, ret52w: 22.4, proj12m: 13.4 },
    { ticker: 'MA',   name: 'Mastercard Inc.',   pe: 32.4, divYield: 0.62, ret52w: 18.4, proj12m: 13.8 },
    { ticker: 'AXP',  name: 'American Express',  pe: 18.4, divYield: 1.24, ret52w: 22.4, proj12m: 12.4 },
    { ticker: 'JPM',  name: 'JPMorgan Chase',    pe: 12.4, divYield: 2.52, ret52w: 28.4, proj12m: 12.4 },
    { ticker: 'BLK',  name: 'BlackRock Inc.',    pe: 22.4, divYield: 2.14, ret52w: 18.4, proj12m: 11.2 },
    { ticker: 'SPGI', name: 'S&P Global',        pe: 36.4, divYield: 0.82, ret52w: 14.2, proj12m: 11.8 },
  ],
  'Energy': [
    { ticker: 'COP', name: 'ConocoPhillips',       pe: 12.8, divYield: 3.14, ret52w:  6.4, proj12m:  9.2 },
    { ticker: 'CVX', name: 'Chevron Corp.',         pe: 14.2, divYield: 4.12, ret52w:  2.4, proj12m:  8.8 },
    { ticker: 'XOM', name: 'Exxon Mobil Corp.',     pe: 12.4, divYield: 3.52, ret52w:  4.2, proj12m:  8.4 },
    { ticker: 'EOG', name: 'EOG Resources',         pe: 10.4, divYield: 2.84, ret52w:  2.2, proj12m:  8.2 },
    { ticker: 'OXY', name: 'Occidental Petroleum',  pe:  8.4, divYield: 1.52, ret52w: -4.2, proj12m:  7.8 },
  ],
  'Consumer': [
    { ticker: 'COST', name: 'Costco Wholesale', pe: 48.4, divYield: 0.62, ret52w: 28.4, proj12m: 13.4 },
    { ticker: 'WMT',  name: 'Walmart Inc.',      pe: 32.4, divYield: 1.22, ret52w: 24.4, proj12m: 12.4 },
    { ticker: 'HD',   name: 'Home Depot Inc.',   pe: 22.4, divYield: 2.52, ret52w: 12.4, proj12m: 10.4 },
    { ticker: 'MCD',  name: "McDonald's Corp.",  pe: 22.4, divYield: 2.42, ret52w:  4.2, proj12m:  8.8 },
    { ticker: 'PG',   name: 'Procter & Gamble',  pe: 26.4, divYield: 2.42, ret52w:  4.8, proj12m:  7.8 },
    { ticker: 'KO',   name: 'Coca-Cola Co.',     pe: 24.4, divYield: 3.12, ret52w:  4.4, proj12m:  7.4 },
    { ticker: 'PEP',  name: 'PepsiCo Inc.',      pe: 20.4, divYield: 3.42, ret52w: -2.4, proj12m:  7.2 },
  ],
  // ── Legacy / fallback sectors ───────────────────────────────────────────────
  'US Equity': [
    { ticker: 'NVDA',  name: 'NVIDIA Corp.',       pe: 52.1, divYield: 0.03, ret52w: 89.3, proj12m: 22.4 },
    { ticker: 'META',  name: 'Meta Platforms',      pe: 28.4, divYield: 0.40, ret52w: 41.2, proj12m: 18.4 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.',        pe: 24.6, divYield: 0.00, ret52w: 28.4, proj12m: 14.8 },
    { ticker: 'AMZN',  name: 'Amazon.com',           pe: 40.2, divYield: 0.00, ret52w: 32.1, proj12m: 16.2 },
    { ticker: 'MSFT',  name: 'Microsoft Corp.',      pe: 35.8, divYield: 0.72, ret52w: 16.4, proj12m: 12.1 },
    { ticker: 'AAPL',  name: 'Apple Inc.',            pe: 31.2, divYield: 0.48, ret52w: 12.1, proj12m:  9.4 },
    { ticker: 'BRK.B', name: 'Berkshire Hathaway',   pe: 14.2, divYield: 0.00, ret52w:  8.4, proj12m:  7.8 },
  ],
  'Intl Equity': [
    { ticker: 'VXUS', name: 'Total Intl Stock',      pe: 14.8, divYield: 2.84, ret52w: 14.2, proj12m:  8.8 },
    { ticker: 'VEA',  name: 'Developed Markets ETF', pe: 14.2, divYield: 3.10, ret52w: 16.4, proj12m:  9.4 },
    { ticker: 'IEFA', name: 'Core MSCI EAFE',        pe: 14.1, divYield: 3.04, ret52w: 15.8, proj12m:  9.1 },
  ],
  'Emerging Mkts': [
    { ticker: 'VWO',  name: 'Vanguard Emerging',     pe: 12.4, divYield: 3.24, ret52w:  8.4, proj12m:  9.2 },
    { ticker: 'EEM',  name: 'iShares MSCI EM',       pe: 12.1, divYield: 2.80, ret52w:  7.8, proj12m:  8.6 },
  ],
  'Bonds': [
    { ticker: 'BND',  name: 'Total Bond Market',     pe: null, divYield: 4.18, ret52w:  3.2, proj12m:  4.4 },
    { ticker: 'AGG',  name: 'US Aggregate Bond',     pe: null, divYield: 4.22, ret52w:  3.4, proj12m:  4.6 },
    { ticker: 'LQD',  name: 'IG Corporate Bond',     pe: null, divYield: 5.14, ret52w:  4.1, proj12m:  5.2 },
    { ticker: 'TIP',  name: 'TIPS Bond ETF',         pe: null, divYield: 5.48, ret52w:  5.1, proj12m:  5.6 },
  ],
  'Real Estate': [
    { ticker: 'VNQ',  name: 'Vanguard REIT ETF',     pe: 36.4, divYield: 4.12, ret52w:  2.8, proj12m:  7.4 },
    { ticker: 'O',    name: 'Realty Income Corp.',   pe: 44.2, divYield: 5.84, ret52w:  1.2, proj12m:  8.8 },
    { ticker: 'PLD',  name: 'Prologis Inc.',         pe: 38.1, divYield: 2.92, ret52w:  6.4, proj12m:  9.2 },
  ],
  'Commodities': [
    { ticker: 'GLD',  name: 'SPDR Gold Shares',      pe: null, divYield: 0.00, ret52w: 18.4, proj12m:  8.2 },
    { ticker: 'SLV',  name: 'iShares Silver Trust',  pe: null, divYield: 0.00, ret52w: 22.4, proj12m: 11.2 },
  ],
};

function getTickerMetrics(ticker) {
  return TICKER_METRICS[ticker] || { pe: 20, divYield: 1.5, ret52w: 10, proj12m: 8, signal: 'hold', note: 'Broad market exposure.' };
}

// Returns up to 3 switch suggestions based on portfolio positions
function generateSwitchSuggestions(positions) {
  if (!positions || positions.length === 0) return [];
  const suggestions = [];
  for (const pos of positions) {
    const myM = getTickerMetrics(pos.ticker);
    const alts = (SECTOR_ALT_POOL[pos.sector] || []).filter(a => a.ticker !== pos.ticker);
    const best = alts.filter(a => a.proj12m - myM.proj12m >= 3).sort((a, b) => b.proj12m - a.proj12m)[0];
    if (best) {
      const uplift = +(best.proj12m - myM.proj12m).toFixed(1);
      suggestions.push({
        from: pos.ticker, to: best.ticker, toName: best.name, sector: pos.sector,
        uplift, fromProj: myM.proj12m, toProj: best.proj12m,
        reason: `${best.ticker} shows stronger 12-month momentum (+${best.ret52w}% 52W, ${best.proj12m}% proj.) vs ${pos.ticker} (${myM.proj12m}% proj.) — same ${pos.sector} exposure, higher return potential.`,
      });
    }
  }
  return suggestions.sort((a, b) => b.uplift - a.uplift).slice(0, 3);
}

// Period buttons for the projected trajectory chart.
// Always includes the full-term button so users can see the entire horizon.
function getPeriodsForTerm(term) {
  if (term <= 0.5) return ['2M', '4M', '6M'];
  if (term <= 1)   return ['3M', '6M', '9M', '1Y'];
  const MILESTONES = [1, 3, 5, 10, 15, 20];
  const buttons = [];
  for (const y of MILESTONES) {
    if (y < term)      { buttons.push(`${y}Y`); }
    else if (y === term) { buttons.push(`${y}Y`); return buttons; }
    else               { buttons.push(`${term}Y`); return buttons; }
  }
  if (!buttons.includes(`${term}Y`)) buttons.push(`${term}Y`);
  return buttons;
}

// Derive period buttons from actual series data span so buttons never exceed
// what's available. Custom max label (e.g. "8M") falls through to fitContent.
function getPeriodsForSeries(series) {
  if (!series || series.length < 2) return ['1M'];

  const firstDate = new Date(series[0].time + 'T00:00:00');
  const lastDate  = new Date(series[series.length - 1].time + 'T00:00:00');
  const totalMonths = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30.44));

  if (totalMonths <= 1) return ['1M'];

  const STANDARD = [
    { months: 3,  label: '3M' },
    { months: 6,  label: '6M' },
    { months: 12, label: '1Y' },
    { months: 36, label: '3Y' },
    { months: 60, label: '5Y' },
  ];

  const buttons = ['1M'];
  for (const bp of STANDARD) {
    if (bp.months < totalMonths) {
      buttons.push(bp.label);
    } else if (bp.months === totalMonths) {
      buttons.push(bp.label);
      return buttons;
    } else {
      // Data doesn't reach the next standard breakpoint — add a custom max label
      const customLabel = totalMonths % 12 === 0 ? `${totalMonths / 12}Y` : `${totalMonths}M`;
      if (customLabel !== buttons[buttons.length - 1]) buttons.push(customLabel);
      return buttons;
    }
  }
  return buttons;
}

Object.assign(window, { HOLDINGS_UNIVERSE, EXTENDED_TICKER_LOOKUP, TRADABLE_UNIVERSE, buildPortfolio, buildPortfolioWithRealData, applyOrdersToPortfolio, SECTOR_COLORS, RISK_LABELS, riskLabelFor, GOALS, MARKET_HEADLINES, AGENT_STEPS, FUTURE_ACTIONS, ACTION_CATEGORIES, WEEKLY_ACTIVITY, getPeriodsForTerm, getPeriodsForSeries, TICKER_METRICS, SECTOR_ALT_POOL, getTickerMetrics, generateSwitchSuggestions });
