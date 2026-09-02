@echo off
cd /d "%~dp0web"
echo Konstruktor shkafov: http://localhost:8102
echo Redaktor:            http://localhost:8102/editor.html
echo.
start http://localhost:8102
py -3 -m http.server 8102
pause
