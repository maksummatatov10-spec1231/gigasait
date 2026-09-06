@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (py -3 import_wb.py %*) || (python import_wb.py %*)
pause
