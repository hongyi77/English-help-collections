@echo off
cd /d "%~dp0"
title CET4 Vocab - Local Server
echo Starting CET-4 vocabulary server...
echo.
echo PC:      http://localhost:8080
echo Phone:   http://<the-IP-shown-below>:8080  (same WiFi)
echo.
node server.js
if errorlevel 1 (
  echo.
  echo Failed to start. Please install Node.js from https://nodejs.org
  pause
)