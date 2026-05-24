@echo off
TITLE WazeCommuteApp - Expo Server
COLOR 0A

echo ===================================================
echo Starting WazeCommuteApp (Public Transit Tracker)
echo ===================================================
echo.
echo Please make sure you have the "Expo Go" app installed on your phone.
echo Make sure your phone and your computer are on the same Wi-Fi network.
echo.

:: Navigate to the directory where the batch file is located
cd /d "%~dp0"

:: Check if node_modules exists, if not run npm install
IF NOT EXIST "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
)

echo [INFO] Starting Expo development server... Scan the QR code below!
call npx expo start
pause
