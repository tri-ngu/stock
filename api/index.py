import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
import traceback

# Add parent directory to path
parent_dir = str(Path(__file__).parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Create app with fallback
app = FastAPI()

# Try to import the main app
try:
    from backend.main import app as main_app
    app = main_app
except Exception as e:
    error_msg = f"{type(e).__name__}: {str(e)}"
    tb = traceback.format_exc()

    # Create a fallback app with error info
    @app.get("/")
    async def root():
        return {"error": "App initialization failed", "message": error_msg}

    @app.get("/health")
    async def health():
        return {"status": "error", "message": error_msg}

    @app.post("/api/chat")
    async def chat_error():
        raise HTTPException(status_code=500, detail=f"App failed to initialize: {error_msg}")
