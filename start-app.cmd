@echo off
setlocal
cd /d "%~dp0"

echo Starting Risk Adjustment CDI Prototype...
echo.

if not exist node_modules (
  echo Installing dependencies first. This can take a minute.
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Dependency install failed.
    pause
    exit /b 1
  )
)

echo Opening http://127.0.0.1:5173/
echo Keep this window open while using the app.
echo Press Ctrl+C in this window to stop the app.
echo.

call npm.cmd run open
pause
