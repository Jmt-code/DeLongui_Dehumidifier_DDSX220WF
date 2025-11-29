@echo off
title De'Longhi Control
echo ========================================
echo    De'Longhi Dehumidifier Control
echo ========================================
echo.

:: Go to project directory
cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Starting server...

:: Kill previous processes on ports 3001 and 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul

:: Start backend in background
start /B cmd /c "cd backend && node server_v3.js"

:: Wait a moment
timeout /t 2 /nobreak >nul

:: Start frontend
echo Starting application...
start /B cmd /c "cd frontend && npm run dev"

:: Wait for frontend to be ready
timeout /t 3 /nobreak >nul

:: Open browser
echo.
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo The application is running.
echo Close this window to stop everything.
echo ========================================
echo.

:: Keep window open
pause >nul

:: On close, kill processes
taskkill /F /IM node.exe >nul 2>nul
