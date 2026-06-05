import random
import yfinance as yf
import numpy as np
from typing import Dict, List, Any
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Risk tier sets — used by compute_portfolio_weights
_GROWTH_TICKERS = frozenset([
    'NVDA', 'AMD', 'META', 'TSLA', 'NFLX', 'AMZN', 'GOOGL', 'AAPL', 'MSFT',
    'AVGO', 'CRM', 'ADBE', 'ORCL', 'QCOM', 'INTC', 'QQQ',
])
_BOND_ETFS = frozenset([
    'BND', 'AGG', 'LQD', 'TLT', 'IEF', 'SHV', 'HYG', 'TIP',
    'MUB', 'VCIT', 'VCSH', 'BSV',
])
_DIVERSIFIED_ETFS = frozenset([
    'VTI', 'VOO', 'SPY', 'IVV', 'SCHB', 'VIG', 'DGRO', 'NOBL', 'DVY',
])

# Sector map — used for round-robin diversity selection in build_portfolio_recommendation
_TICKER_SECTOR = {
    **{t: 'tech'         for t in ['NVDA','META','GOOGL','AMZN','AMD','AVGO','ORCL','CRM','ADBE','NFLX','QCOM','TSLA','INTC','MSFT','AAPL']},
    **{t: 'healthcare'   for t in ['LLY','UNH','ABBV','TMO','ABT','MDT','AMGN','GILD','REGN','VRTX','BMY','CI','HUM','JNJ','MRK']},
    **{t: 'finance'      for t in ['BLK','GS','JPM','MS','AXP','COF','PGR','ICE','CME','SPGI','CB','TRV','PRU','BAC','SCHW','V','MA']},
    **{t: 'energy'       for t in ['EOG','COP','HES','DVN','OXY','MPC','VLO','PSX','KMI','WMB','SLB','HAL','XOM','CVX','ET']},
    **{t: 'consumer'     for t in ['COST','HD','LOW','TGT','NKE','SBUX','YUM','DG','DLTR','MCD','PG','KO','PEP','CL','WMT']},
    **{t: 'bonds'        for t in ['BND','AGG','LQD','TLT','IEF','SHV','HYG','TIP','MUB','VCIT','VCSH','BSV']},
    **{t: 'real_estate'  for t in ['PLD','AMT','EQIX','CCI','PSA','VNQ','O','AVB','EXR','SPG']},
    **{t: 'international'for t in ['VXUS','EFA','VWO','IEFA','VEA','EEM','IEMG','DGS','SPDW','ACWX']},
    **{t: 'diversified'  for t in ['VTI','VOO','SPY','IVV','SCHB','VIG','DGRO','NOBL','DVY','QQQ']},
}


def get_stock_info(ticker: str) -> Dict[str, Any]:
    """Fetch current stock information for a given ticker."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="1y")

        current_price = info.get("currentPrice", 0)
        pe_ratio = info.get("trailingPE", None)
        market_cap = info.get("marketCap", 0)
        fifty_two_week_high = info.get("fiftyTwoWeekHigh", 0)
        fifty_two_week_low = info.get("fiftyTwoWeekLow", 0)

        year_return = None
        if len(hist) > 0:
            year_return = ((current_price - hist.iloc[0]["Close"]) / hist.iloc[0]["Close"]) * 100

        return {
            "ticker": ticker,
            "price": current_price,
            "pe_ratio": pe_ratio,
            "market_cap": market_cap,
            "52week_high": fifty_two_week_high,
            "52week_low": fifty_two_week_low,
            "year_return": year_return,
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
        }
    except Exception as e:
        logger.error(f"Error fetching stock info for {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}


def screen_stocks(criteria: Dict[str, Any]) -> Dict[str, Any]:
    """
    Screen stocks based on AI-provided criteria. No external API calls.

    criteria: {
      'sector': 'tech' | 'healthcare' | 'finance' | 'energy' | 'consumer' | 'bonds'
               | 'real_estate' | 'international' | 'diversified',
      'market_cap': 'large' | 'mid' | 'small',
      'dividend_yield': 'high' | 'moderate' | 'growth',
      'user_goals': ['retire', 'wealth', 'income', 'house', 'edu']
    }
    """
    stock_universe = {
        'tech':          ['NVDA', 'META', 'GOOGL', 'AMZN', 'AMD', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'QCOM', 'TSLA', 'INTC', 'MSFT', 'AAPL'],
        'healthcare':    ['LLY', 'UNH', 'ABBV', 'TMO', 'ABT', 'MDT', 'AMGN', 'GILD', 'REGN', 'VRTX', 'BMY', 'CI', 'HUM', 'JNJ', 'MRK'],
        'finance':       ['BLK', 'GS', 'JPM', 'MS', 'AXP', 'COF', 'PGR', 'ICE', 'CME', 'SPGI', 'CB', 'TRV', 'PRU', 'BAC', 'SCHW'],
        'energy':        ['EOG', 'COP', 'HES', 'DVN', 'OXY', 'MPC', 'VLO', 'PSX', 'KMI', 'WMB', 'SLB', 'HAL', 'XOM', 'CVX', 'ET'],
        'consumer':      ['COST', 'HD', 'LOW', 'TGT', 'NKE', 'SBUX', 'YUM', 'DG', 'DLTR', 'MCD', 'PG', 'KO', 'PEP', 'CL', 'WMT'],
        'bonds':         ['BND', 'AGG', 'LQD', 'TLT', 'IEF', 'SHV', 'HYG', 'TIP', 'MUB', 'VCIT', 'VCSH', 'BSV'],
        'real_estate':   ['PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'VNQ', 'O', 'AVB', 'EXR', 'SPG'],
        'international': ['VXUS', 'EFA', 'VWO', 'IEFA', 'VEA', 'EEM', 'IEMG', 'DGS', 'SPDW', 'ACWX'],
        'diversified':   ['VTI', 'VOO', 'SPY', 'IVV', 'SCHB', 'VIG', 'DGRO', 'NOBL', 'DVY', 'QQQ'],
    }

    # Curated high-dividend sublists — no yfinance call needed for income/retire filtering
    high_dividend_universe = {
        'tech':          ['AAPL', 'MSFT', 'INTC', 'QCOM', 'AVGO'],
        'healthcare':    ['JNJ', 'ABT', 'MDT', 'ABBV', 'BMY', 'AMGN', 'GILD'],
        'finance':       ['JPM', 'BAC', 'PRU', 'TRV', 'CB', 'MS', 'AXP'],
        'energy':        ['XOM', 'CVX', 'COP', 'KMI', 'WMB', 'ET', 'OXY'],
        'consumer':      ['KO', 'PEP', 'PG', 'WMT', 'MCD', 'CL', 'YUM'],
        'bonds':         ['BND', 'AGG', 'LQD', 'TLT', 'IEF', 'HYG', 'TIP'],
        'real_estate':   ['O', 'VNQ', 'AVB', 'PSA', 'SPG', 'EXR', 'AMT'],
        'international': ['DGS', 'SPDW', 'IEFA', 'EFA', 'ACWX'],
        'diversified':   ['VIG', 'DGRO', 'NOBL', 'DVY', 'SCHB'],
    }

    sector = criteria.get('sector', 'diversified').lower()
    dividend_pref = criteria.get('dividend_yield', 'moderate').lower()
    user_goals = criteria.get('user_goals', [])

    need_dividend_filter = ('income' in user_goals or 'retire' in user_goals) and dividend_pref == 'high'

    if need_dividend_filter:
        candidates = list(high_dividend_universe.get(sector, high_dividend_universe['diversified']))
    else:
        candidates = list(stock_universe.get(sector, stock_universe['diversified']))

    random.shuffle(candidates)
    result_stocks = candidates[:10]

    reasoning = f"Screened {sector.title()} sector — selected {len(result_stocks)} securities for goals: {', '.join(user_goals) if user_goals else 'balanced growth'}"

    return {
        'stocks': result_stocks,
        'sector': sector,
        'reasoning': reasoning,
        'count': len(result_stocks),
    }


def compute_portfolio_weights(tickers: List[str], risk_level: str) -> Dict[str, float]:
    """
    Assign portfolio weights using risk-tier multipliers. No external API calls.

    Tickers are classified into growth / stable / income / diversified tiers.
    Multipliers amplify or dampen each tier based on the user's risk level,
    producing differentiated weights before the bond/equity split is applied.
    """
    MULTIPLIERS = {
        'conservative': {'growth': 0.6, 'stable': 1.1, 'income': 1.5, 'diversified': 1.2},
        'moderate':     {'growth': 1.0, 'stable': 1.0, 'income': 1.0, 'diversified': 1.0},
        'aggressive':   {'growth': 1.6, 'stable': 0.8, 'income': 0.4, 'diversified': 0.9},
    }
    mults = MULTIPLIERS.get(risk_level.lower(), MULTIPLIERS['moderate'])

    raw = {}
    for ticker in tickers:
        if ticker in _BOND_ETFS:
            raw[ticker] = mults['income']
        elif ticker in _GROWTH_TICKERS:
            raw[ticker] = mults['growth']
        elif ticker in _DIVERSIFIED_ETFS:
            raw[ticker] = mults['diversified']
        else:
            raw[ticker] = mults['stable']

    total = sum(raw.values()) or 1
    return {t: w / total for t, w in raw.items()}


def build_portfolio_recommendation(
    budget: float,
    risk_level: str,
    stocks: List[str] = None,
    user_goals: List[str] = None,
    time_horizon: int = 10
) -> Dict[str, Any]:
    """
    Build a portfolio recommendation using AI-selected stocks.

    Args:
        budget: Investment amount
        risk_level: 'conservative', 'moderate', 'aggressive'
        stocks: AI-selected tickers from screen_stocks
        user_goals: User's investment goals ['retire', 'wealth', 'income', 'house', 'edu']
        time_horizon: Years to invest
    """
    try:
        budget = float(budget)

        FALLBACK_BASKET = [
            'VTI', 'QQQ', 'BND', 'AAPL', 'MSFT', 'JNJ', 'JPM', 'XOM',
            'PG', 'UNH', 'NVDA', 'GOOGL', 'META', 'AMZN', 'LLY',
            'V', 'MA', 'COST', 'HD', 'AVGO',
        ]

        if not stocks or len(stocks) == 0:
            stocks = list(FALLBACK_BASKET)

        # Deduplicate while preserving order
        seen = set()
        unique_stocks = []
        for t in stocks:
            if t not in seen:
                seen.add(t)
                unique_stocks.append(t)
        stocks = unique_stocks

        # Pad to at least 10 stocks
        if len(stocks) < 10:
            for ticker in FALLBACK_BASKET:
                if ticker not in seen:
                    stocks.append(ticker)
                    seen.add(ticker)
                if len(stocks) >= 10:
                    break

        # Asset allocation targets by risk level
        allocations = {
            "conservative": {"bonds": 0.50, "dividend_stocks": 0.30, "growth_stocks": 0.20},
            "moderate":     {"bonds": 0.30, "dividend_stocks": 0.35, "growth_stocks": 0.35},
            "aggressive":   {"bonds": 0.10, "dividend_stocks": 0.30, "growth_stocks": 0.60},
        }
        allocation = allocations.get(risk_level.lower(), allocations["moderate"])

        if user_goals and 'income' in user_goals:
            allocation['dividend_stocks'] += 0.15
            allocation['growth_stocks'] -= 0.15

        if user_goals and 'retire' in user_goals and time_horizon > 20:
            allocation['bonds'] += 0.10
            allocation['growth_stocks'] -= 0.10

        total = sum(allocation.values())
        allocation = {k: v / total for k, v in allocation.items()}

        # Round-robin sector selection so no single sector dominates the first 15.
        # Group tickers by sector, then alternate 1-from-each until we have 15.
        sector_buckets = defaultdict(list)
        for t in stocks:
            sector_buckets[_TICKER_SECTOR.get(t, 'other')].append(t)

        active = [list(v) for v in sector_buckets.values()]
        selected = []
        while len(selected) < 15 and active:
            next_active = []
            for bucket in active:
                if len(selected) >= 15:
                    break
                if bucket:
                    selected.append(bucket.pop(0))
                if bucket:
                    next_active.append(bucket)
            active = next_active

        portfolio_tickers = selected

        # Rule-based weights — no external API calls
        weights = compute_portfolio_weights(portfolio_tickers, risk_level)

        # Enforce risk-level bond/equity split
        bond_tix   = [t for t in portfolio_tickers if t in _BOND_ETFS]
        equity_tix = [t for t in portfolio_tickers if t not in _BOND_ETFS]
        bond_target   = allocation['bonds']
        equity_target = 1.0 - bond_target

        if bond_tix and equity_tix:
            bond_raw   = sum(weights.get(t, 0) for t in bond_tix)   or 1
            equity_raw = sum(weights.get(t, 0) for t in equity_tix) or 1
            for t in bond_tix:
                weights[t] = (weights.get(t, 0) / bond_raw)   * bond_target
            for t in equity_tix:
                weights[t] = (weights.get(t, 0) / equity_raw) * equity_target
        elif not bond_tix:
            raw = sum(weights.get(t, 0) for t in equity_tix) or 1
            for t in equity_tix:
                weights[t] = weights.get(t, 0) / raw

        # Guarantee weights sum exactly to 1.0
        w_total = sum(weights.get(t, 0) for t in portfolio_tickers) or 1
        for t in portfolio_tickers:
            weights[t] = weights.get(t, 0) / w_total

        positions = {ticker: budget * weights[ticker] for ticker in portfolio_tickers}

        reasoning = f"Built portfolio from {len(portfolio_tickers)} AI-selected stocks for {risk_level} risk, goals: {', '.join(user_goals or ['balanced'])}"

        return {
            "budget": budget,
            "risk_level": risk_level,
            "positions": positions,
            "stocks": portfolio_tickers,
            "expected_return": 0,
            "volatility": 0,
            "sharpe_ratio": 0,
            "reasoning": reasoning,
            "goals": user_goals or [],
        }
    except Exception as e:
        logger.error(f"Error building portfolio recommendation: {e}")
        return {"error": str(e), "budget": budget}


def analyze_company(ticker: str) -> Dict[str, Any]:
    """Analyze a company's financial metrics and outlook."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        return {
            "ticker": ticker,
            "company_name": info.get("longName", "Unknown"),
            "price": info.get("currentPrice", 0),
            "pe_ratio": info.get("trailingPE", None),
            "debt_to_equity": info.get("debtToEquity", None),
            "roe": info.get("returnOnEquity", None),
            "roic": info.get("returnOnCapital", None),
            "dividend_yield": info.get("dividendYield", None),
            "revenue_growth": info.get("revenueGrowth", None),
            "earnings_growth": info.get("earningsGrowth", None),
            "sector": info.get("sector", "Unknown"),
        }
    except Exception as e:
        logger.error(f"Error analyzing company {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}


def get_sector_comparison(sector: str) -> Dict[str, Any]:
    """Compare stocks within a sector."""
    sector_stocks = {
        "Technology": ["AAPL", "MSFT", "NVDA", "GOOGL"],
        "Finance":    ["JPM", "BAC", "WFC", "GS"],
        "Healthcare": ["JNJ", "UNH", "PFE", "MRK"],
        "Energy":     ["XOM", "CVX", "COP", "EOG"],
        "Consumer":   ["AMZN", "WMT", "HD", "MCD"],
    }

    tickers = sector_stocks.get(sector, [])
    stocks = [get_stock_info(t) for t in tickers]
    return {"sector": sector, "stocks": stocks}
