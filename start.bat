@echo off
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend
set FLASK=%ROOT%AI_Models

echo ============================================================
echo  Pharma MVP - Dependency check + AI_Models
echo ============================================================

:: ── BACKEND node_modules ─────────────────────────────────────
echo.
echo [1/3] Backend dependencies...
if not exist "%BACKEND%\node_modules\express" (
    echo      Running npm install...
    pushd "%BACKEND%" && call npm install && popd
    if errorlevel 1 ( echo ERROR: npm install failed. && pause && exit /b 1 )
) else if not exist "%BACKEND%\node_modules\mongoose" (
    echo      mongoose missing - running npm install...
    pushd "%BACKEND%" && call npm install && popd
    if errorlevel 1 ( echo ERROR: npm install failed. && pause && exit /b 1 )
) else if not exist "%BACKEND%\node_modules\bcryptjs" (
    echo      bcryptjs missing - running npm install...
    pushd "%BACKEND%" && call npm install && popd
    if errorlevel 1 ( echo ERROR: npm install failed. && pause && exit /b 1 )
) else (
    echo      OK
)

:: ── BACKEND .env ─────────────────────────────────────────────
if not exist "%BACKEND%\.env" (
    echo      .env missing - copying from .env.example
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo      IMPORTANT: Edit backend\.env and set a strong JWT_SECRET before production use.
)

:: ── FRONTEND node_modules ────────────────────────────────────
echo.
echo [2/3] Frontend dependencies...
if not exist "%FRONTEND%\node_modules\vite" (
    echo      Running npm install...
    pushd "%FRONTEND%" && call npm install && popd
    if errorlevel 1 ( echo ERROR: npm install failed. && pause && exit /b 1 )
) else (
    echo      OK
)

:: ── FLASK packages ───────────────────────────────────────────
echo.
echo [3/3] Flask (ML) dependencies...
python -c "import flask" 2>nul || (
    echo      Installing Flask ML requirements...
    python -m pip install -r "%FLASK%\requirements.txt" -q
    if errorlevel 1 ( echo ERROR: pip install failed. && pause && exit /b 1 )
)
echo      OK

:: ── AI_Models ───────────────────────────────────────────────────
echo.
echo ============================================================
echo  AI_Modelsing all three stacks...
echo ============================================================

:: Backend — Express API on :3000
start "Backend (Express :3000)" cmd /k "cd /d "%BACKEND%" && node server.js"

:: Frontend — Vite dev server on :5173
start "Frontend (Vite :5173)" cmd /k "cd /d "%FRONTEND%" && npm run dev"

:: Flask ML — run from AI_Models/ so gnn_models.py is importable
start "Flask ML (:5000)" cmd /k "cd /d "%FLASK%" && python app.py"

echo.
echo   Backend  ^> http://localhost:3000/health
echo   Frontend ^> http://localhost:5173
echo   Flask ML ^> http://localhost:5000/health
echo.
echo   MongoDB must be running: mongod --dbpath ^<path^>
echo.
pause
