@echo off
echo ========================================
echo B2B Sales System - Production Setup
echo ========================================
echo.
echo This script will deploy the B2B Sales System to your Render PostgreSQL database.
echo.
echo IMPORTANT: You need to set your database password first!
echo.
echo Option 1: Set environment variable
echo set POSTGRES_PASSWORD=your_actual_password
echo.
echo Option 2: Set full DATABASE_URL
echo set DATABASE_URL=postgresql://freia_postgres_user:your_password@dpg-d2u0qtmr433s73dresng-a.render.com:5432/freia_postgres
echo.
echo ========================================
echo.

REM Check if password is set
if "%POSTGRES_PASSWORD%"=="" (
    if "%DATABASE_URL%"=="" (
        echo ERROR: Database credentials not found!
        echo.
        echo Please set one of these environment variables:
        echo   POSTGRES_PASSWORD=your_actual_password
        echo   DATABASE_URL=postgresql://freia_postgres_user:your_password@dpg-d2u0qtmr433s73dresng-a.render.com:5432/freia_postgres
        echo.
        echo You can get your password from the Render dashboard:
        echo https://dashboard.render.com/d/dpg-d2u0qtmr433s73dresng-a
        echo.
        pause
        exit /b 1
    )
)

echo Starting production deployment...
echo.

REM Install required dependencies
echo Installing dependencies...
npm install pg
if errorlevel 1 (
    echo Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo Running production setup script...
node deploy-production.js

if errorlevel 1 (
    echo.
    echo ========================================
    echo DEPLOYMENT FAILED!
    echo ========================================
    echo.
    echo Common solutions:
    echo 1. Check your database password
    echo 2. Verify network connectivity
    echo 3. Ensure database is running
    echo.
    echo For detailed instructions, see:
    echo production-setup-guide.md
    echo.
) else (
    echo.
    echo ========================================
    echo DEPLOYMENT SUCCESSFUL!
    echo ========================================
    echo.
    echo Your B2B Sales System is now deployed to production.
    echo.
    echo Next steps:
    echo 1. Import Flowise templates
    echo 2. Configure webhooks
    echo 3. Test the system
    echo.
    echo See production-setup-guide.md for details.
    echo.
)

pause