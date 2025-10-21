@echo off
echo Starting Caniscan Desktop Server...
echo.
echo Make sure you have Python installed and requirements.txt dependencies installed.
echo If not, run: pip install -r requirements.txt
echo.
echo Server will start on http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
python desktop_server.py
pause
