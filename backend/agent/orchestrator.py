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

# Tool definitions for Claude
TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get current stock information including price, P/E ratio, market cap, and 52-week highs/lows",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g., 'AAPL')"
                }
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "screen_stocks",
        "description": "Screen stocks based on criteria like market cap and P/E ratio",
        "input_schema": {
            "type": "object",
            "properties": {
                "criteria": {
                    "type": "object",
                    "description": "Screening criteria (min_market_cap, pe_range, etc.)"
                }
            },
            "required": ["criteria"]
        }
    },
    {
        "name": "get_historical_data",
        "description": "Fetch historical price data and calculate returns and volatility",
        "input_schema": {
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
    },
    {
        "name": "optimize_portfolio",
        "description": "Optimize portfolio allocation using Mean-Variance optimization to maximize Sharpe ratio",
        "input_schema": {
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
    },
    {
        "name": "build_portfolio_recommendation",
        "description": "Build a diversified portfolio recommendation based on budget and risk level",
        "input_schema": {
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
                }
            },
            "required": ["budget", "risk_level"]
        }
    },
    {
        "name": "analyze_company",
        "description": "Analyze a company's financial metrics and fundamentals",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol"
                }
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_sector_comparison",
        "description": "Compare stocks within a specific sector",
        "input_schema": {
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
]

class StockAdvisorOrchestrator:
    def __init__(self):
        self.client = Groq()
        self.conversation_history = []
        self.system_prompt = """You are a knowledgeable stock investment advisor for beginners. Your role is to:

1. Help users understand stock investing concepts
2. Analyze stocks and companies thoroughly
3. Screen stocks based on fundamental criteria
4. Build diversified, low-risk portfolios matched to their risk tolerance and budget
5. Explain your recommendations in simple, beginner-friendly language

Guidelines:
- Always prioritize safety and diversification
- Recommend at least 40-50% in ETFs or bonds for beginners
- Focus on blue-chip stocks with strong fundamentals
- Avoid penny stocks and highly speculative investments
- Be conservative with initial recommendations
- Always disclose risks and limitations
- Never guarantee returns or provide specific financial advice without disclaimers"""

    def process_message(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
        """Process a user message and yield response chunks."""
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })

        messages = self.conversation_history.copy()

        while True:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1024,
                system=self.system_prompt,
                tools=TOOLS,
                messages=messages
            )

            # Process response content
            assistant_content = []
            tool_calls = []
            text_response = ""

            message = response.choices[0].message

            # Get text content
            if message.content:
                text_response = message.content
                assistant_content.append({
                    "type": "text",
                    "text": message.content
                })
                yield {
                    "type": "text",
                    "content": message.content
                }

            # Get tool calls
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tool_calls.append(tool_call)
                    assistant_content.append({
                        "type": "tool_use",
                        "id": tool_call.id,
                        "name": tool_call.function.name,
                        "input": json.loads(tool_call.function.arguments)
                    })

            # If no tool calls, we're done
            if response.choices[0].finish_reason == "stop" or not tool_calls:
                if text_response:
                    self.conversation_history.append({
                        "role": "assistant",
                        "content": assistant_content
                    })
                break

            # Add assistant response to history
            if assistant_content:
                self.conversation_history.append({
                    "role": "assistant",
                    "content": assistant_content
                })

            # Process tool calls
            tool_results = []
            for tool_call in tool_calls:
                tool_name = tool_call.function.name
                tool_input = json.loads(tool_call.function.arguments)
                result = self._execute_tool(tool_name, tool_input)

                yield {
                    "type": "tool_call",
                    "tool": tool_name,
                    "result": result
                }

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_call.id,
                    "content": json.dumps(result)
                })

            # Add tool results to messages for next iteration
            messages.append({
                "role": "assistant",
                "content": assistant_content
            })
            messages.append({
                "role": "user",
                "content": tool_results
            })

            self.conversation_history.append({
                "role": "user",
                "content": tool_results
            })

    def _execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool and return the result."""
        try:
            if tool_name == "get_stock_info":
                return get_stock_info(tool_input["ticker"])
            elif tool_name == "screen_stocks":
                return {"screened_tickers": screen_stocks(tool_input.get("criteria", {}))}
            elif tool_name == "get_historical_data":
                return get_historical_data(
                    tool_input["ticker"],
                    tool_input.get("period", "5y")
                )
            elif tool_name == "optimize_portfolio":
                return optimize_portfolio(tool_input["tickers"])
            elif tool_name == "build_portfolio_recommendation":
                return build_portfolio_recommendation(
                    tool_input["budget"],
                    tool_input["risk_level"]
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
