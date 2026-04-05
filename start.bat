@echo off
echo Starting application...
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port %PORT%
