@echo off
cd /d "%~dp0"
echo Konstruktor shkafov (s oblakom): http://localhost:8102
echo Redaktor:                        http://localhost:8102/editor.html
echo.
start http://localhost:8102
.venv\Scripts\python.exe -m uvicorn app:app --app-dir server --port 8102
pause
