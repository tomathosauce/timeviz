@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node-v22.22.0-win-x64\node.exe" set "PATH=%~dp0.tools\node-v22.22.0-win-x64;%PATH%"
if exist "%~dp0.tools\windows-ca.pem" set "NODE_EXTRA_CA_CERTS=%~dp0.tools\windows-ca.pem"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this launcher again.
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
call npm.cmd run dev
