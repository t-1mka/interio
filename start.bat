@echo off
color 0A
title Interio - Design Projects

cls
echo.
echo  ====================================================
echo     Interio - Smart Quiz for Interior Design
echo     Launching server...
echo  ====================================================
echo.

cd /d "%~dp0"

echo  [1/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Python is NOT installed!
    echo.
    echo  Please download and install Python from:
    echo  https://www.python.org/downloads/
    echo.
    echo  IMPORTANT: Check the box "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYVER=%%i
echo  Found: %PYVER%
echo.

echo  [2/3] Installing dependencies...
echo  This may take 1-3 minutes on first run...
echo.
pip install --quiet --upgrade pip 2>nul
pip install -r requirements.txt 2>nul
if errorlevel 1 (
    echo  Retrying with full output...
    echo.
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo  ERROR: Could not install dependencies.
        echo  Please try: pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    )
)
echo  OK
echo.

echo  [3/3] Starting server...
echo.

:: Create folders if needed
if not exist "uploads" mkdir uploads
if not exist "static\images" mkdir static\images

:: Remove old database for fresh start
if exist "data.db" del /F /Q "data.db" >nul 2>&1

echo  Server is starting now...
echo  When you see the message below, the server is ready:
echo.
echo  "Uvicorn running on http://0.0.0.0:5000"
echo.
echo  ====================================================
echo   Open these links in your browser (Ctrl+click):
echo.
echo   Main page:    http://localhost:5000
echo   Quiz:         http://localhost:5000/quiz
echo   Admin panel:  http://localhost:5000/admin
echo   Portfolio:    http://localhost:5000/portfolio
echo   API Docs:     http://localhost:5000/docs
echo   Track order:  http://localhost:5000/track
echo.
echo   GigaChat AI: click the robot button (bottom-right)
echo.
echo   Press Ctrl+C to stop the server
echo  ====================================================
echo.

:: Start the server
python -m uvicorn server:app --host 0.0.0.0 --port 5000 --no-access-log

echo.
echo  ====================================================
echo     Server stopped
echo  ====================================================
pause
