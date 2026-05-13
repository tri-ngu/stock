import yfinance as yf
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

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
    Screen stocks based on AI-provided criteria.

    criteria: {
      'sector': 'tech' | 'healthcare' | 'finance' | 'energy' | 'consumer' | 'diversified',
      'market_cap': 'large' | 'mid' | 'small',
      'dividend_yield': 'high' | 'moderate' | 'growth',
      'user_goals': ['retire', 'wealth', 'income', 'house', 'edu'] (list)
    }
    """

    # Dynamic universe by sector - AI chooses sector based on user goals
    stock_universe = {
        'tech': ['AAPL', 'MSFT', 'NVDA', 'META', 'CRM', 'ADBE', 'NFLX', 'TSLA'],
        'healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV', 'TMO', 'MRK', 'LLY', 'BMY'],
        'finance': ['JPM', 'BAC', 'GS', 'MS', 'BLK', 'SCHW', 'CB', 'ICE'],
        'energy': ['XOM', 'CVX', 'COP', 'SLB', 'MPC', 'HES', 'EOG', 'PSX'],
        'consumer': ['PG', 'KO', 'WMT', 'HD', 'MCD', 'COST', 'NKE', 'SBUX'],
        'diversified': ['VTI', 'VOO', 'VTSAX', 'SPY', 'IVV', 'SCHB', 'FSKAX', 'SWTSX']
    }

    sector = criteria.get('sector', 'diversified').lower()
    market_cap_pref = criteria.get('market_cap', 'large').lower()
    dividend_pref = criteria.get('dividend_yield', 'moderate').lower()
    user_goals = criteria.get('user_goals', [])

    # Get candidates from selected sector
    candidates = stock_universe.get(sector, stock_universe['diversified'])

    screened = []

    for ticker in candidates:
        try:
            info = get_stock_info(ticker)
            if "error" in info:
                continue

            # If user goal is 'income' or 'retire', prefer high dividend
            if 'income' in user_goals or 'retire' in user_goals:
                div_yield = info.get('dividendYield', 0) or 0
                if dividend_pref == 'high' and div_yield < 0.02:
                    continue
                if dividend_pref == 'moderate' and div_yield < 0.01:
                    continue

            # If user goal is 'wealth' or 'house', prefer growth
            if 'wealth' in user_goals and dividend_pref == 'growth':
                pass  # No dividend filter

            screened.append(ticker)

        except Exception as e:
            logger.error(f"Error screening {ticker}: {e}")
            continue

    reasoning = f"Selected {sector.title()} sector stocks aligned with goals: {', '.join(user_goals) if user_goals else 'balanced'}"

    return {
        'stocks': screened[:6],
        'sector': sector,
        'reasoning': reasoning,
        'count': len(screened[:6])
    }

def get_historical_data(ticker: str, period: str = "5y") -> Dict[str, Any]:
    """Fetch historical price data for a ticker."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)

        if len(hist) == 0:
            return {"error": f"No data found for {ticker}"}

        returns = hist["Close"].pct_change().dropna()

        return {
            "ticker": ticker,
            "data_points": len(hist),
            "start_date": hist.index[0].strftime("%Y-%m-%d"),
            "end_date": hist.index[-1].strftime("%Y-%m-%d"),
            "avg_return": float(returns.mean() * 252),
            "volatility": float(returns.std() * np.sqrt(252)),
        }
    except Exception as e:
        logger.error(f"Error fetching historical data for {ticker}: {e}")
        return {"error": str(e)}

def optimize_portfolio(tickers: List[str], weights: List[float] = None) -> Dict[str, Any]:
    """Optimize portfolio using Mean-Variance optimization."""
    try:
        from scipy.optimize import minimize

        if not tickers or len(tickers) == 0:
            return {"error": "No tickers provided"}

        # Fetch 5-year historical data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=5*365)

        data = yf.download(" ".join(tickers), start=start_date, end=end_date, progress=False)

        if len(data) == 0:
            return {"error": "Failed to fetch price data"}

        # Handle single vs multiple tickers
        if len(tickers) == 1:
            closes = data["Adj Close"]
        else:
            closes = data["Close"]

        # Calculate returns
        returns = closes.pct_change().dropna()

        if len(returns) == 0:
            return {"error": "Insufficient data for optimization"}

        mean_returns = returns.mean() * 252
        cov_matrix = returns.cov() * 252

        # Optimization function
        def portfolio_stats(weights):
            port_return = np.sum(weights * mean_returns)
            port_std = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            sharpe = port_return / port_std if port_std > 0 else 0
            return -sharpe

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0.02, 0.04) for _ in tickers]

        result = minimize(
            portfolio_stats,
            x0=np.array([1/len(tickers)] * len(tickers)),
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
        )

        if not result.success:
            # Fallback to equal weight
            opt_weights = np.array([1/len(tickers)] * len(tickers))
        else:
            opt_weights = result.x

        port_return = np.sum(opt_weights * mean_returns)
        port_std = np.sqrt(np.dot(opt_weights, np.dot(cov_matrix, opt_weights)))
        sharpe = port_return / port_std if port_std > 0 else 0

        return {
            "tickers": tickers,
            "weights": {tickers[i]: float(opt_weights[i]) for i in range(len(tickers))},
            "expected_return": float(port_return),
            "volatility": float(port_std),
            "sharpe_ratio": float(sharpe),
        }
    except Exception as e:
        logger.error(f"Error optimizing portfolio: {e}")
        # Fallback to equal weight
        weights = {ticker: 1/len(tickers) for ticker in tickers}
        return {"tickers": tickers, "weights": weights, "error": str(e)}

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
        stocks: AI-selected tickers from stock_screener
        user_goals: User's investment goals ['retire', 'wealth', 'income', 'house', 'edu']
        time_horizon: Years to invest
    """
    try:
        budget = float(budget)

        # If no stocks provided by AI, use default diversified basket
        if not stocks or len(stocks) == 0:
            stocks = ['VTI', 'VOO', 'VTSAX']

        # Asset allocation by risk level
        allocations = {
            "conservative": {
                "bonds": 0.50,
                "dividend_stocks": 0.30,
                "growth_stocks": 0.20,
            },
            "moderate": {
                "bonds": 0.30,
                "dividend_stocks": 0.35,
                "growth_stocks": 0.35,
            },
            "aggressive": {
                "bonds": 0.10,
                "dividend_stocks": 0.30,
                "growth_stocks": 0.60,
            },
        }

        allocation = allocations.get(risk_level.lower(), allocations["moderate"])

        # Incorporate user goals into allocation
        # If income goal, increase dividend weight
        if user_goals and 'income' in user_goals:
            allocation['dividend_stocks'] += 0.15
            allocation['growth_stocks'] -= 0.15

        # If retirement, emphasize bonds for longer horizons
        if user_goals and 'retire' in user_goals and time_horizon > 20:
            allocation['bonds'] += 0.10
            allocation['growth_stocks'] -= 0.10

        # Normalize to sum to 1
        total = sum(allocation.values())
        allocation = {k: v / total for k, v in allocation.items()}

        # Use AI-selected stocks for optimization
        portfolio_tickers = stocks[:5] if len(stocks) >= 5 else stocks

        # Optimize portfolio on AI-selected stocks
        optimized = optimize_portfolio(portfolio_tickers)

        if "error" in optimized and len(portfolio_tickers) > 1:
            weights = {ticker: 1/len(portfolio_tickers) for ticker in portfolio_tickers}
        else:
            weights = optimized.get("weights", {})

        # Calculate dollar amounts
        positions = {ticker: budget * weights[ticker] for ticker in portfolio_tickers}

        reasoning = f"Built portfolio from {len(portfolio_tickers)} AI-selected stocks for {risk_level} risk, goals: {', '.join(user_goals or ['balanced'])}"

        return {
            "budget": budget,
            "risk_level": risk_level,
            "positions": positions,
            "stocks": portfolio_tickers,
            "expected_return": optimized.get("expected_return", 0),
            "volatility": optimized.get("volatility", 0),
            "sharpe_ratio": optimized.get("sharpe_ratio", 0),
            "reasoning": reasoning,
            "goals": user_goals or []
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
        "Finance": ["JPM", "BAC", "WFC", "GS"],
        "Healthcare": ["JNJ", "UNH", "PFE", "MRK"],
        "Energy": ["XOM", "CVX", "COP", "EOG"],
        "Consumer": ["AMZN", "WMT", "HD", "MCD"],
    }

    tickers = sector_stocks.get(sector, [])
    stocks = []

    for ticker in tickers:
        info = get_stock_info(ticker)
        stocks.append(info)

    return {"sector": sector, "stocks": stocks}
