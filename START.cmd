@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:18944/
python preview.py
pause
