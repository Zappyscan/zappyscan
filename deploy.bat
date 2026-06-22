@echo off
echo ============================================
echo  ZAPPY — Production Deployment to Vercel
echo ============================================
echo.

cd /d D:\Zappy-main

echo [1/3] Building production bundle...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed. Fix errors above before deploying.
    pause
    exit /b 1
)
echo Build SUCCESS.
echo.

echo [2/3] Checking Vercel CLI...
where vercel >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing Vercel CLI...
    call npm install -g vercel
)
echo.

echo [3/3] Deploying to Vercel (production)...
echo NOTE: If first time, Vercel will ask you to log in and configure the project.
echo       - Scope: your Vercel account
echo       - Link to existing project: No (first time) / Yes (if already created)
echo       - Project name: zappy
echo       - Directory: ./ (current)
echo.
call vercel --prod
echo.
echo ============================================
echo  Deployment complete! Check URL above.
echo  Also set these environment variables in
echo  Vercel Dashboard → Settings → Env Vars:
echo    VITE_SUPABASE_URL
echo    VITE_SUPABASE_PUBLISHABLE_KEY
echo ============================================
pause
