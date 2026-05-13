import sys
from pathlib import Path
from fastapi import FastAPI
import traceback

print("=== API INDEX.PY STARTING ===")

# Add parent directory to path
parent_dir = str(Path(__file__).parent.parent)
print(f"Parent dir: {parent_dir}")
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Create the app first
app = FastAPI()

# Try to import the stock advisor app
print("Attempting to import backend.main...")
try:
    from backend.main import app as stock_app
    print("Successfully imported stock_app")
    app = stock_app
    print(f"App routes: {len(app.routes)}")
except Exception as e:
    print(f"IMPORT ERROR: {e}")
    traceback.print_exc()

    # Use the minimal app and add error route
    @app.get("/import-error")
    async def import_error():
        return {
            "status": "import_failed",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

print("=== API INDEX.PY COMPLETE ===")
