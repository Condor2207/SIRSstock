@echo off
chcp 65001 >nul
title SIRS - Sistema Integral de Gestión

:: Ir a la carpeta del proyecto (donde está este .bat)
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║       SIRS - Sistema de Gestión de Edulcorantes      ║
echo  ║                   Iniciando...                        ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ─────────────────────────────────────────
:: 1. Verificar Node.js
:: ─────────────────────────────────────────
echo  [1/3] Verificando Node.js...
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ✗ Node.js no está instalado.
    echo.
    echo  Descargalo desde: https://nodejs.org  (versión LTS)
    echo  Después de instalarlo, volvé a ejecutar este archivo.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)
FOR /F "tokens=*" %%v IN ('node --version') DO SET NODE_VER=%%v
echo  ✓ Node.js %NODE_VER% detectado.

:: ─────────────────────────────────────────
:: 2. Instalar dependencias si hace falta
:: ─────────────────────────────────────────
echo.
echo  [2/3] Verificando dependencias...
IF NOT EXIST "node_modules\" (
    echo  Instalando dependencias por primera vez, esto puede tardar 1-2 minutos...
    echo.
    call npm install
    IF %ERRORLEVEL% NEQ 0 (
        echo.
        echo  ✗ Error al instalar dependencias. Revisa tu conexión a internet.
        pause
        exit /b 1
    )
    echo.
    echo  ✓ Dependencias instaladas correctamente.
) ELSE (
    echo  ✓ Dependencias ya instaladas.
)

:: ─────────────────────────────────────────
:: 3. Iniciar servidor y abrir navegador
:: ─────────────────────────────────────────
echo.
echo  [3/3] Iniciando servidor en http://localhost:3000 ...
echo.
echo  ─────────────────────────────────────────────────────
echo   El sistema se abrirá en tu navegador en segundos.
echo   Para detener el servidor, cerrá esta ventana.
echo  ─────────────────────────────────────────────────────
echo.

:: Abrir el navegador después de 5 segundos
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

:: Iniciar el servidor (bloquea esta ventana)
call npm run dev
