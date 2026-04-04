@echo off
color 0B
title Interio Server

cls
echo.
echo  ================================================
echo     Interio — Smart Quiz for Interior Design
echo  ================================================
echo.

cd /d "%~dp0"

echo  [Step 1/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Python not found!
    echo  Download from: https://www.python.org/downloads/
    echo  IMPORTANT: Check "Add Python to PATH" during install!
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYVER=%%i
echo  Found: %PYVER%
echo.

echo  [Step 2/3] Installing dependencies...
echo  (may take 1-3 minutes first time)
echo.
pip install --quiet --upgrade pip 2>nul
pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo  Retrying with full output...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo  [ERROR] Install failed. Try: pip install -r requirements.txt
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
if not exist "static\images" mkdir static\images >nul 2>&1
if exist "data.db" del /F /Q "data.db" >nul 2>&1

echo  Waiting for server to start...
echo.

:: Try to find a free port
set PORT=5000
netstat -ano | findstr ":%PORT% " >nul 2>&1
if not errorlevel 1 (
    echo  Port 5000 is busy, trying 5001...
    set PORT=5001
    netstat -ano | findstr ":%PORT% " >nul 2>&1
    if not errorlevel 1 (
        echo  Port 5001 is busy, trying 5002...
        set PORT=5002
    )
)

echo  Using port: %PORT%
echo.
echo  ================================================
echo   Server is starting...
echo.
echo   When ready, open in your browser:
echo.
echo   Main:     http://localhost:%PORT%
echo   Quiz:     http://localhost:%PORT%/quiz
echo   Admin:    http://localhost:%PORT%/admin
echo   Portfolio: http://localhost:%PORT%/portfolio
echo   API Docs: http://localhost:%PORT%/docs
echo.
echo   AI Chat: click the robot button (bottom-right)
echo.
echo   Ctrl+C to stop
echo  ================================================
echo.

python -m uvicorn server:app --host 0.0.0.0 --port %PORT%

echo.
echo  ================================================
echo     Server stopped
echo  ================================================
pause
