@echo off
setlocal
cd /d "%~dp0"
title MOTRIX - installation
where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable. Installez Node.js 20 LTS ou plus recent : https://nodejs.org/
  pause
  exit /b 1
)
echo Installation des dependances (connexion Internet necessaire une seule fois)...
call npm ci
if errorlevel 1 (
  echo npm ci a echoue, tentative avec npm install...
  call npm install
  if errorlevel 1 (
    echo [ERREUR] Installation impossible.
    pause
    exit /b 1
  )
)
echo.
echo Installation terminee. Etape suivante : construire.bat
pause
