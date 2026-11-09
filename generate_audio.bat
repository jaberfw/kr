@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EPS Korean - audio generator

rem ---- find Python ---------------------------------------------------------
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (
    where python >nul 2>nul && set "PY=python"
)
if not defined PY (
    echo Python was not found. Install it from https://www.python.org/downloads/
    echo and tick "Add python.exe to PATH" during setup, then run this file again.
    pause
    exit /b 1
)

rem ---- make sure edge-tts is installed -------------------------------------
%PY% -c "import edge_tts" >nul 2>nul
if errorlevel 1 (
    echo Installing edge-tts ...
    %PY% -m pip install --upgrade edge-tts
    if errorlevel 1 (
        echo Could not install edge-tts. Check your internet connection and try again.
        pause
        exit /b 1
    )
)

if not exist "database.json" (
    echo database.json was not found next to this file.
    echo Put generate_audio.py, generate_audio.bat and database.json in the same folder.
    pause
    exit /b 1
)

rem ---- menu ----------------------------------------------------------------
echo.
echo  Only MISSING audio is generated - files already in the audio folder are skipped.
echo.
echo  What do you want to generate?
echo.
echo    1  All three  (Korean + Bangla + English)   - audio\kor, audio\bng, audio\eng
echo    2  Korean only   (audio\kor)
echo    3  Bangla only   (audio\bng)
echo    4  English only  (audio\eng)
echo    5  Test run - first 20 words, all three languages
echo    6  Only CHECK which audio files are missing (creates nothing)
echo.
set /p CHOICE=" Enter 1-6 [1]: "
if "%CHOICE%"=="" set CHOICE=1

set "ARGS=--langs kor,bng,eng"
if "%CHOICE%"=="2" set "ARGS=--langs kor"
if "%CHOICE%"=="3" set "ARGS=--langs bng"
if "%CHOICE%"=="4" set "ARGS=--langs eng"
if "%CHOICE%"=="5" set "ARGS=--langs kor,bng,eng --start-id 1 --end-id 20"
if "%CHOICE%"=="6" set "ARGS=--langs kor,bng,eng --check"

echo.
%PY% generate_audio.py %ARGS%

echo.
echo Done. Existing files are skipped and only missing ones are created, so you can run this again any time.
pause
