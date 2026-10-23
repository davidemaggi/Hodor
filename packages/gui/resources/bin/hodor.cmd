@echo off
rem Hodor CLI launcher: runs the bundled CLI on the app's own Electron, so no Node.js is needed.
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\Hodor.exe" "%~dp0..\cli\hodor.mjs" %*
