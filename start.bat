@echo off
title Interio - Design Projects
color 0A

cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║       Interio - Design Projects              ║
echo  ║       Smart quiz for interior design         ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo  [Step 1/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Python is not found!
    echo.
    echo  Please install Python from:
    echo  https://www.python.org/downloads/
    echo.
    echo  IMPORTANT: Check "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYVER=%%i
echo  OK: %PYVER% found
echo.

echo  [Step 2/3] Installing dependencies...
echo  This may take a few minutes on first run...
echo.
pip install --quiet --upgrade pip 2>nul
pip install --quiet -r requirements.txt 2>nul
if errorlevel 1 (
    echo  Retrying...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo  ERROR: Could not install dependencies!
        echo  Please run: pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    )
)
echo  OK
echo.

echo  [Step 3/3] Starting server...
echo.

if not exist "uploads" mkdir uploads
if exist "data.db" del /F /Q "data.db" >nul 2>&1

echo  Server is starting...
echo  When you see "Uvicorn running on http://0.0.0.0:5000"
echo  the server is ready.
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  Open in your browser:                       ║
echo  ║                                              ║
echo  ║  Main page:   http://localhost:5000          ║
echo  ║  Quiz:        http://localhost:5000/quiz     ║
echo  ║  Admin panel: http://localhost:5000/admin    ║
echo  ║  API Docs:    http://localhost:5000/docs     ║
echo  ║                                              ║
echo  ║  GigaChat AI: click the robot button         ║
echo  ║                 in bottom-right corner       ║
echo  ║                                              ║
echo  ║  Press Ctrl+C to stop the server             ║
echo  ╚══════════════════════════════════════════════╝
echo.

python -m uvicorn server:app --host 0.0.0.0 --port 5000

echo.
echo  Server stopped.
pause
