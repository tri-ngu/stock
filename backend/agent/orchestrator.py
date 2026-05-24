import json
import logging
from typing import Dict, Any, Generator
from groq import Groq

from .tools import (
    get_stock_info,
    screen_stocks,
    get_historical_data,
    optimize_portfolio,
    build_portfolio_recommendation,
    analyze_company,
    get_sector_comparison,
)

logger = logging.getLogger(__name__)

# Tool definitions for Groq API (OpenAI format)
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_info",
            "description": "Get current stock information including price, P/E ratio, market cap, and 52-week highs/lows",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol (e.g., 'AAPL')"
                    }
                },
                "required": ["ticker"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "screen_stocks",
            "description": "Screen stocks based on sector, market cap, dividend yield, and user investment goals. Returns stocks aligned with AI's reasoning about the user's needs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "criteria": {
                        "type": "object",
                        "description": "Screening criteria",
                        "properties": {
                            "sector": {
                                "type": "string",
                                "enum": ["tech", "healthcare", "finance", "energy", "consumer", "bonds", "real_estate", "international", "diversified"],
                                "description": "Sector to screen. Use 'bonds' for fixed income, 'real_estate' for REITs, 'international' for non-US exposure."
                            },
                            "market_cap": {
                                "type": "string",
                                "enum": ["large", "mid", "small"],
                                "description": "Preferred market cap range"
                            },
                            "dividend_yield": {
                                "type": "string",
                                "enum": ["high", "moderate", "growth"],
                                "description": "Income vs growth preference"
                            },
                            "user_goals": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "User goals like 'retire', 'wealth', 'income', 'house', 'edu'"
                            }
                        }
                    }
                },
                "required": ["criteria"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_historical_data",
            "description": "Fetch historical price data and calculate returns and volatility",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol"
                    },
                    "period": {
                        "type": "string",
                        "description": "Time period (e.g., '5y', '1y', '6mo')",
                        "default": "5y"
                    }
                },
                "required": ["ticker"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "optimize_portfolio",
            "description": "Optimize portfolio allocation using Mean-Variance optimization to maximize Sharpe ratio",
            "parameters": {
                "type": "object",
                "properties": {
                    "tickers": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of stock tickers to include in portfolio"
                    }
                },
                "required": ["tickers"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "build_portfolio_recommendation",
            "description": "Build a portfolio recommendation using AI-selected stocks, optimized for user budget, risk level, goals, and time horizon. Should be called AFTER screen_stocks to use AI-selected securities.",
            "parameters": {
                "type": "object",
                "properties": {
                    "budget": {
                        "type": "number",
                        "description": "Investment budget in dollars"
                    },
                    "risk_level": {
                        "type": "string",
                        "enum": ["conservative", "moderate", "aggressive"],
                        "description": "Risk tolerance level"
                    },
                    "stocks": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of tickers from screen_stocks to build portfolio with. If omitted, defaults to diversified ETFs."
                    },
                    "user_goals": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "User's investment goals to tailor allocation"
                    },
                    "time_horizon": {
                        "type": "integer",
                        "description": "Years until money is needed (default 10)"
                    }
                },
                "required": ["budget", "risk_level"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_company",
            "description": "Analyze a company's financial metrics and fundamentals",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol"
                    }
                },
                "required": ["ticker"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sector_comparison",
            "description": "Compare stocks within a specific sector",
            "parameters": {
                "type": "object",
                "properties": {
                    "sector": {
                        "type": "string",
                        "description": "Sector name (e.g., 'Technology', 'Finance', 'Healthcare')"
                    }
                },
                "required": ["sector"]
            }
        }
    }
]

class StockAdvisorOrchestrator:
    def __init__(self):
        self.client = Groq()
        self.system_prompt = """You are a diversified portfolio advisor. Build portfolios that vary meaningfully based on each user's risk level and goals.

MANDATORY WORKFLOW — follow this exact sequence every time:

STEP 1 — Screen primary equity sector (choose based on goals + risk):
  - Wealth building / aggressive → sector: "tech" or "finance"
  - Retirement / income → sector: "consumer" or "healthcare", dividend_yield: "high"
  - Conservative / capital preservation → sector: "consumer" or "healthcare"
  - Balanced / moderate → sector: "finance" or "healthcare"

STEP 2 — Screen bonds (ALWAYS required for diversification):
  screen_stocks with sector: "bonds"
  (Skip only if user explicitly asks for 100% equities)

STEP 3 — Screen a SECOND equity sector different from Step 1:
  Pick a sector NOT already used. Examples:
  - If Step 1 was "tech" → use "healthcare" or "consumer"
  - If Step 1 was "finance" → use "energy" or "tech"
  - If Step 1 was "consumer" → use "finance" or "real_estate"

STEP 4 — Build the portfolio:
  Call build_portfolio_recommendation with stocks from ALL three screen calls combined.
  Include user_goals and time_horizon.

DIVERSIFICATION RULES:
- Never use the same sector twice
- Always include at least one bond/fixed-income position
- Conservative (risk < 35): 50%+ bonds, equity from consumer/healthcare
- Moderate (risk 35–65): 25–35% bonds, equity from 2 different sectors
- Aggressive (risk > 65): 10–15% bonds, equity growth from tech + one other sector

Keep explanations brief and beginner-friendly. Never guarantee returns."""

    def process_message(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
        """Process a user message and yield response chunks."""
        # Build messages locally in OpenAI/Groq format (not Anthropic format)
        messages = [{"role": "user", "content": user_message}]

        for _ in range(10):  # safety cap on iterations
            api_messages = [{"role": "system", "content": self.system_prompt}] + messages
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1024,
                tools=TOOLS,
                messages=api_messages
            )

            message = response.choices[0].message

            # Yield any text content
            if message.content:
                yield {"type": "text", "content": message.content}

            # No tool calls or model signalled stop — we're done
            if not message.tool_calls or response.choices[0].finish_reason == "stop":
                break

            # Append assistant turn in OpenAI format (tool_calls as structured list)
            messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                    }
                    for tc in message.tool_calls
                ]
            })

            # Execute each tool and append result with role "tool" (OpenAI format)
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_input = json.loads(tool_call.function.arguments)
                result = self._execute_tool(tool_name, tool_input)

                yield {"type": "tool_call", "tool": tool_name, "input": tool_input, "result": result}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result)
                })

    def _execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool and return the result."""
        try:
            if tool_name == "get_stock_info":
                return get_stock_info(tool_input["ticker"])
            elif tool_name == "screen_stocks":
                result = screen_stocks(tool_input.get("criteria", {}))
                return result
            elif tool_name == "get_historical_data":
                return get_historical_data(
                    tool_input["ticker"],
                    tool_input.get("period", "5y")
                )
            elif tool_name == "optimize_portfolio":
                return optimize_portfolio(tool_input["tickers"])
            elif tool_name == "build_portfolio_recommendation":
                # Support both old signature (for backward compat) and new signature
                return build_portfolio_recommendation(
                    budget=tool_input["budget"],
                    risk_level=tool_input["risk_level"],
                    stocks=tool_input.get("stocks", None),
                    user_goals=tool_input.get("user_goals", None),
                    time_horizon=tool_input.get("time_horizon", 10)
                )
            elif tool_name == "analyze_company":
                return analyze_company(tool_input["ticker"])
            elif tool_name == "get_sector_comparison":
                return get_sector_comparison(tool_input["sector"])
            else:
                return {"error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return {"error": str(e)}
