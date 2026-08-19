@echo off
title Servicio Puente de Envio de Correos CNR - NTBK-Msilva.cnr.gob.cl
color 0A

echo ====================================================================
echo   INICIANDO SERVICIO PUENTE DE CORREOS INSTITUCIONALES CNR
echo   Servidor/Equipo: NTBK-Msilva.cnr.gob.cl
echo ====================================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Instalando dependencias necesarias para el servicio puente...
    npm install
    echo.
)

echo Ejecutando el servicio puente de notificaciones...
node worker.js

pause
