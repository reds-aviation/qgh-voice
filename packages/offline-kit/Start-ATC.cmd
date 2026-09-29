@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys; assert sys.version_info >= (3,12)" >nul 2>&1
if not errorlevel 1 (
  py -3 "%~dp0serve.py"
  goto finished
)
python -c "import sys; assert sys.version_info >= (3,12)" >nul 2>&1
if not errorlevel 1 (
  python "%~dp0serve.py"
  goto finished
)
echo Python 3.12 or newer is required. Install the full offline 64-bit installer
echo from your preparation USB. Include the launcher and Add Python to PATH.
echo See START-HERE.txt. This launcher will not download or install anything.
:finished
pause
