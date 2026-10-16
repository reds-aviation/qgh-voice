@echo off
REM The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
REM Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
REM The Original Code is ATS SIM BOX.
REM The Original Developer is the Initial Developer.
REM The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
REM Contributor(s): None designated in this initial notice.
REM No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.

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
