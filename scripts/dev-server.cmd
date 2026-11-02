@echo off
rem Double-click or run: scripts\dev-server.cmd [-Stop ^| -Restart ^| -Status]
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-server.ps1" %*
