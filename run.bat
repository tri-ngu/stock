@echo off
REM Stock Advisor AI Run Script

echo.
echo ============================================
echo   Stock Advisor AI - Starting Server
echo ============================================
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found
    echo Please copy .env.example to .env and add your NVIDIA API key
    pause
    exit /b 1
)

REM Start the server
echo Starting FastAPI server on http://localhost:8000
echo.
echo Frontend: http://localhost:8000
echo Press Ctrl+C to stop
echo.

python backend\main.py
