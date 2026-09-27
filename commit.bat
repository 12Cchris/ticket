@echo off
cd /d "%~dp0"

for /f "delims=" %%v in ('node get-version.js') do set CURVER=%%v

echo Current version: %CURVER%
set /p NEWVER=Enter new version (press Enter to keep %CURVER%): 
if "%NEWVER%"=="" set NEWVER=%CURVER%

node set-version.js %NEWVER%
if errorlevel 1 goto END

echo.
echo [1/4] Building dist\index.html...
node build.js
if not exist "dist\index.html" (
    echo [ERROR] Failed to build dist\index.html.
    goto END
)
echo [1/4] Build complete! (v%NEWVER%)

echo.
echo [2/4] Committing changes to git...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "v%NEWVER%"
) else (
    echo [INFO] No changes to commit. Keeping current state.
)

echo.
echo [3/4] Pushing to GitHub (12Cchris/ticket)...
git push origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Push to GitHub failed. Check your network or permissions.
    goto END
)

echo.
echo [4/4] Done! v%NEWVER% has been uploaded to GitHub: https://github.com/12Cchris/ticket

:END
echo.
pause
