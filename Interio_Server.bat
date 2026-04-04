@echo off
echo ================================
echo   Interio Server
echo ================================
echo.
cd /d "%~dp0"
python -m uvicorn server:app --host 0.0.0.0 --port 5000
pause
