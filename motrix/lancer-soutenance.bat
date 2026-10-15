@echo off
setlocal
cd /d "%~dp0"
title MOTRIX - soutenance
set PORT=4173
set URL=http://127.0.0.1:%PORT%/
where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable. Installez Node.js 20 LTS ou plus recent.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Le dossier dist\ est absent : construction en cours...
  call npm run build
  if errorlevel 1 (
    echo [ERREUR] Construction impossible. Lancez installer.bat puis construire.bat
    pause
    exit /b 1
  )
)
echo Demarrage du serveur local sur %URL%
start "MOTRIX - serveur local (laisser ouvert)" /min node scripts\serve.mjs %PORT%
timeout /t 2 /nobreak >nul
set CHROME=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined CHROME (
  start "" "%CHROME%" --new-window --start-fullscreen "%URL%"
) else (
  echo Chrome introuvable : ouverture avec le navigateur par defaut.
  start "" "%URL%"
)
echo.
echo Presentation ouverte. Touches : fleches / Espace, F plein ecran, N notes, V vue presentateur, H aide.
echo Pour arreter : fermez la fenetre "MOTRIX - serveur local".
timeout /t 6 >nul
