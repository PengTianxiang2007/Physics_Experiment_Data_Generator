@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install Node.js, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 (
  echo Node.js 20 or newer is required. Please update Node.js.
  pause
  exit /b 1
)
echo LabForm: http://127.0.0.1:8080/
echo Keep this window open. Press Ctrl+C to stop the local server.
start "" "http://127.0.0.1:8080/"
node scripts/serve.mjs
pause
