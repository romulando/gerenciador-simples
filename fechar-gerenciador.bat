@echo off
setlocal EnableExtensions
title Gerenciador Simples - Fechar

set "PORTA=4000"
set "URL=http://localhost:%PORTA%"

echo ==========================================
echo   Gerenciador Simples - Fechar
echo   Porta: %PORTA%
echo ==========================================
echo.

call :porta_ocupada
if errorlevel 1 goto :nada_rodando

call :eh_gerenciador
if errorlevel 1 goto :confirmar

echo Encerrando o gerenciador (porta %PORTA%)...
goto :encerrar

:confirmar
echo A porta %PORTA% esta em uso, mas o programa nao parece ser o gerenciador:
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = (Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue)[0].OwningProcess; if ($p) { $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName; Write-Output ('  PID ' + $p + ' - ' + $n) }"`) do echo %%P
echo.
choice /c SN /n /m "Encerrar esse processo mesmo assim? [S/N] "
if errorlevel 2 goto :cancelado
echo.

:encerrar
set "ACHOU="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue; foreach ($x in $c) { $x.OwningProcess }"`) do (
  echo Encerrando processo %%P ...
  taskkill /PID %%P /T /F >nul 2>nul
  set "ACHOU=1"
)

rem Fecha tambem a janela do servidor de desenvolvimento, se ela ainda existir.
taskkill /FI "WINDOWTITLE eq Gerenciador Simples - Dev*" /T /F >nul 2>nul

if not defined ACHOU goto :nao_consegui

ping -n 3 127.0.0.1 >nul
call :porta_ocupada
if errorlevel 1 (
  echo.
  echo Gerenciador encerrado. A porta %PORTA% esta livre.
) else (
  echo.
  echo Ainda ha algo usando a porta %PORTA%. Feche pelo Gerenciador de Tarefas.
)
goto :fim

:nao_consegui
echo.
echo Nao consegui encerrar. Feche manualmente pelo Gerenciador de Tarefas.
goto :fim

:nada_rodando
echo Nada esta rodando na porta %PORTA%.
goto :fim

:cancelado
echo.
echo Nada foi encerrado.
goto :fim

:fim
echo.
ping -n 3 127.0.0.1 >nul
endlocal
exit /b 0

rem 0 = o gerenciador esta respondendo na porta; 1 = outra coisa (ou nada)
:eh_gerenciador
powershell -NoProfile -ExecutionPolicy Bypass -Command "$r = $null; try { $r = Invoke-WebRequest -Uri '%URL%/login' -UseBasicParsing -TimeoutSec 15 } catch {}; if ($r -and $r.StatusCode -eq 200 -and $r.Content -like '*Entrar no painel*') { exit 0 } else { exit 1 }" >nul 2>nul
exit /b %errorlevel%

rem Retorna errorlevel 0 se alguem estiver escutando na porta, 1 se estiver livre.
:porta_ocupada
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
exit /b %errorlevel%
