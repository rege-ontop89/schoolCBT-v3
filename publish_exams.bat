@echo off
echo ===================================
echo   SchoolCBT Exam Publisher
echo ===================================
echo.
echo This script will upload your new exams to the internet.
echo.

:: Navigate to project directory
cd /d "%~dp0"

:: Check status
echo Checking for changes...
git status

:: Add all changes
git add .

:: Commit
set /p commitMsg="Enter a short note (e.g., Added Math Exam): "
if "%commitMsg%"=="" set commitMsg="Updated exams"
git commit -m "%commitMsg%"

:: Push
echo.
echo Uploading to GitHub...
git push origin main

echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Exams are now live on the Student Portal!
) else (
    echo [ERROR] Something went wrong. Check your internet connection.
)
echo.
pause
