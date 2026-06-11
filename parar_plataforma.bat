@echo off
:: Configura o terminal para UTF-8 para exibir acentos corretamente
chcp 65001 > nul
echo.
echo ==============================================
echo   ENCERRANDO A PLATAFORMA GEASS (NODE/VITE)
echo ==============================================
echo.
echo Parando processos do Node.js rodando em segundo plano...
taskkill /F /IM node.exe >nul 2>&1
echo.
echo [OK] O site foi parado com sucesso!
echo.
timeout /t 3
