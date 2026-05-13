import os
import json
import logging
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# Configure logging FIRST (before any logger usage)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Import orchestrator with proper error handling
ORCHESTRATOR_ERROR = None
try:
    # Try different import paths for flexibility (local vs Vercel)
    try:
        from agent.orchestrator import StockAdvisorOrchestrator
    except ModuleNotFoundError:
        from backend.agent.orchestrator import StockAdvisorOrchestrator

    ORCHESTRATOR_AVAILABLE = True
except Exception as e:
    logger.error(f"Failed to import StockAdvisorOrchestrator: {e}")
    import traceback
    ORCHESTRATOR_ERROR = traceback.format_exc()
    ORCHESTRATOR_AVAILABLE = False
    StockAdvisorOrchestrator = None

# Initialize FastAPI app
app = FastAPI(title="Stock Advisor AI")

# Simple test route to verify the app is working
@app.get("/simple-test")
async def simple_test():
    return {"message": "Simple test works!"}

@app.get("/debug/status")
async def debug_status():
    """Debug endpoint to check app status."""
    return {
        "orchestrator_available": ORCHESTRATOR_AVAILABLE,
        "orchestrator_error": ORCHESTRATOR_ERROR,
        "groq_api_key_set": bool(os.getenv("GROQ_API_KEY"))
    }

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (CSS, JS) - but only if the frontend directory exists
# This handles both local development and Vercel deployment
try:
    frontend_dir = Path(__file__).parent.parent / "frontend"
    if frontend_dir.exists():
        logger.info(f"Mounting frontend directory: {frontend_dir}")
        app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")
    else:
        logger.info("Frontend directory not found, skipping static file mounting")
except Exception as e:
    logger.warning(f"Failed to mount static files: {e}")

# Session storage (in-memory for MVP, upgrade to database in Phase 2)
sessions = {}

class MessageRequest(BaseModel):
    message: str
    session_id: str = None

def _remove_portfolio_json(text: str) -> str:
    """Remove JSON blocks from response text while preserving narrative."""
    import re
    # Remove code blocks with json language hint
    text = re.sub(r'```json\n.*?\n```', '', text, flags=re.DOTALL)
    # Remove standalone JSON objects (between { and })
    text = re.sub(r'\{[\s\n]*"[^}]*"\s*:\s*[^}]*\}', '', text, flags=re.DOTALL)
    return text.strip()

@app.post("/chat")
@app.post("/api/chat")
async def chat(request: MessageRequest):
    """Chat endpoint with streaming responses."""
    try:
        session_id = request.session_id or "default"

        # Check if orchestrator is available
        if not ORCHESTRATOR_AVAILABLE:
            raise HTTPException(status_code=500, detail="AI orchestrator not available. Check dependencies and environment variables.")

        # Get or create session
        if session_id not in sessions:
            sessions[session_id] = StockAdvisorOrchestrator()

        orchestrator = sessions[session_id]

        def event_stream():
            for chunk in orchestrator.process_message(request.message):
                if chunk["type"] == "text":
                    text = chunk["content"]
                    text = _remove_portfolio_json(text)
                    if text:
                        yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
                elif chunk["type"] == "tool_call":
                    tool_name = chunk["tool"]
                    result = chunk["result"]
                    tool_input = chunk.get("input", {})

                    # Emit tool_call event for reasoning visibility
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'input': tool_input})}\n\n"

                    if tool_name == "build_portfolio_recommendation":
                        if "positions" in result:
                            # Format portfolio data for frontend
                            portfolio_data = {
                                'budget': result.get('budget', 0),
                                'risk_level': result.get('risk_level', 'moderate'),
                                'positions': result.get('positions', {}),
                                'stocks': result.get('stocks', []),
                                'expected_return': result.get('expected_return', 0),
                                'volatility': result.get('volatility', 0),
                                'sharpe_ratio': result.get('sharpe_ratio', 0),
                                'goals': result.get('goals', []),
                                'reasoning': result.get('reasoning', '')
                            }
                            yield f"data: {json.dumps({'type': 'portfolio', 'portfolio': portfolio_data})}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portfolio")
@app.post("/api/portfolio")
async def get_portfolio(request: MessageRequest):
    """Get portfolio recommendation."""
    try:
        # This is handled via the chat endpoint with portfolio events
        return {"status": "Use /api/chat endpoint with portfolio request"}
    except Exception as e:
        logger.error(f"Error in portfolio endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "orchestrator_available": ORCHESTRATOR_AVAILABLE
    }

@app.get("/test")
@app.get("/api/test")
async def test_endpoint(request: Request):
    """Test endpoint to debug routing."""
    return {
        "message": "test endpoint working",
        "url": str(request.url),
        "path": request.url.path
    }

@app.get("/market-data")
@app.get("/api/market-data")
async def get_market_data(tickers: str = "VTI,VXUS,BND,AAPL,MSFT,NVDA"):
    """Fetch real historical market data for given tickers."""
    try:
        import yfinance as yf
        import pandas as pd
        from datetime import datetime, timedelta

        ticker_list = [t.strip() for t in tickers.split(',')]
        end_date = datetime.now()
        start_date = end_date - timedelta(days=5*365)

        data_dict = {}

        for ticker in ticker_list:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(start=start_date, end=end_date)

                if len(hist) == 0:
                    continue

                # Extract closing prices
                closes = hist['Close'].values.tolist()
                dates = [d.strftime('%Y-%m-%d') for d in hist.index]

                # Calculate returns
                returns = hist['Close'].pct_change().dropna()

                # Calculate metrics (annualized)
                avg_return = returns.mean() * 252 * 100  # annualized %
                volatility = returns.std() * np.sqrt(252) * 100  # annualized %
                current_price = hist['Close'].iloc[-1]

                data_dict[ticker] = {
                    'prices': [float(p) for p in closes],
                    'dates': dates,
                    'current_price': float(current_price),
                    'avg_return': float(avg_return),
                    'volatility': float(volatility),
                    'data_points': len(hist)
                }
            except Exception as e:
                logger.error(f"Error fetching data for {ticker}: {e}")
                continue

        return {
            "status": "success",
            "data": data_dict,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in market-data endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/style.css")
async def serve_css():
    """Serve the CSS file."""
    try:
        frontend_dir = Path(__file__).parent.parent / "frontend"
        css_file = frontend_dir / "style.css"
        if css_file.exists():
            return FileResponse(str(css_file), media_type="text/css")
    except Exception as e:
        logger.error(f"Error serving CSS: {e}")
    return ""

@app.get("/app.js")
async def serve_js():
    """Serve the JavaScript file."""
    try:
        frontend_dir = Path(__file__).parent.parent / "frontend"
        js_file = frontend_dir / "app.js"
        if js_file.exists():
            return FileResponse(str(js_file), media_type="text/javascript")
    except Exception as e:
        logger.error(f"Error serving JS: {e}")
    return ""

@app.get("/{filename}")
async def serve_jsx(filename: str):
    """Serve JSX and other frontend files."""
    # Skip empty filenames - they're handled by the root route
    if not filename:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        frontend_dir = Path(__file__).parent.parent / "frontend"
        file_path = frontend_dir / filename

        # Security check: ensure path is within frontend directory
        if not str(file_path.resolve()).startswith(str(frontend_dir.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")

        if file_path.exists():
            if filename.endswith('.jsx'):
                return FileResponse(str(file_path), media_type="text/javascript")
            elif filename.endswith('.css'):
                return FileResponse(str(file_path), media_type="text/css")
            elif filename.endswith('.js'):
                return FileResponse(str(file_path), media_type="text/javascript")
            else:
                return FileResponse(str(file_path))
    except Exception as e:
        logger.error(f"Error serving {filename}: {e}")

    raise HTTPException(status_code=404, detail="File not found")

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the frontend HTML."""
    try:
        frontend_dir = Path(__file__).parent.parent / "frontend"
        index_file = frontend_dir / "index.html"
        if index_file.exists():
            with open(index_file, 'r', encoding='utf-8') as f:
                return f.read()
    except Exception as e:
        logger.error(f"Error serving index: {e}")
    return '<html><body>Stock Advisor AI Backend</body></html>'

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("SERVER_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
