@echo off
setlocal
cd /d "%~dp0"
title MOTRIX - construction
if not exist node_modules (
  echo [ERREUR] Dependances absentes. Lancez d'abord installer.bat
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo [ERREUR] La construction a echoue.
  pause
  exit /b 1
)
echo.
echo Construction terminee : dossier dist\ pret pour une utilisation hors ligne.
echo Lancez la presentation avec lancer-soutenance.bat
pause
