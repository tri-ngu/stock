import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from agent.orchestrator import StockAdvisorOrchestrator

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Stock Advisor AI")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (CSS, JS)
frontend_dir = Path(__file__).parent.parent / "frontend"
logger.info(f"Frontend directory: {frontend_dir}")
logger.info(f"Frontend directory exists: {frontend_dir.exists()}")
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

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

@app.post("/api/chat")
async def chat(request: MessageRequest):
    """Chat endpoint with streaming responses."""
    try:
        session_id = request.session_id or "default"

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
                    if chunk["tool"] == "build_portfolio_recommendation":
                        result = chunk["result"]
                        if "positions" in result:
                            yield f"data: {json.dumps({'type': 'portfolio', 'data': result})}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/portfolio")
async def get_portfolio(request: MessageRequest):
    """Get portfolio recommendation."""
    try:
        # This is handled via the chat endpoint with portfolio events
        return {"status": "Use /api/chat endpoint with portfolio request"}
    except Exception as e:
        logger.error(f"Error in portfolio endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

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
