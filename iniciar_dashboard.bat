@echo off
title JF MERCADO MACRO - Dashboard
echo.
echo ===============================================================
echo   Iniciando Servidor Local para o Dashboard JF Mercado Macro...
echo ===============================================================
echo.
echo Abrindo o navegador em http://localhost:8000/...
start "" "http://localhost:8000/"
echo.
echo Para encerrar o servidor, basta fechar esta janela.
echo.
python server.py
