@echo off
setlocal
cd /d "%~dp0"
title Truespace Server

echo ===================================================
echo   Truespace Server Launcher
echo ===================================================
echo.

REM 1. Free ports 3001 and 5173 if busy (kills previous/duplicate instances)
echo [1/3] Checking and freeing ports 3001 and 5173...
powershell -NoProfile -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001,5173 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue" >nul 2>&1

REM 2. Check dependencies
if not exist "node_modules\" (
    echo [2/3] Installing dependencies...
    call npm.cmd install
) else (
    echo [2/3] Dependencies OK.
)

REM 3. Open browser automatically
echo [3/3] Starting server and opening browser...
start "" cmd /c "ping 127.0.0.1 -n 3 >nul && start http://localhost:5173"

echo.
echo ===================================================
echo  Server is running at http://localhost:5173
echo  Close this window to stop the server.
echo ===================================================
echo.

call npm.cmd run dev

REM Clean up ports on exit
powershell -NoProfile -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001,5173 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue" >nul 2>&1
