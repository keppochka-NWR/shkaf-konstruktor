@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8103/studio/ in your browser.
node studio\scripts\serve.cjs
pause
