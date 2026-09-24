@echo off
REM Exsodus – remove the wallet sidebar and restore the original Exodus (Windows).
REM Double-click this file, or run it from a terminal.
cd /d "%~dp0"
node install.js uninstall
echo.
pause
