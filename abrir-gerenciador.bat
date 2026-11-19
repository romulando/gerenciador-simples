@echo off
setlocal EnableExtensions
title Gerenciador Simples - Theone

cd /d "%~dp0"

set "PORTA=4000"
set "URL=http://localhost:%PORTA%"

echo ==========================================
echo   Gerenciador Simples - Theone
echo   Porta fixa: %PORTA%
echo ==========================================
echo.

rem ---- 1) Node.js instalado? ----
where node >nul 2>nul
if errorlevel 1 goto :sem_node

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODEVER=%%v"
set "NODEVER=%NODEVER:v=%"
echo Node.js encontrado: v%NODEVER%

rem ---- 1.1) O Node precisa ter o SQLite embutido (node:sqlite, Node 22.13+) ----
node -e "require('node:sqlite')" >nul 2>nul
if errorlevel 1 goto :node_antigo

rem ---- 2) O gerenciador ja esta rodando na porta? ----
call :verificar_app
if "%errorlevel%"=="0" (
  echo.
  echo O gerenciador ja esta rodando na porta %PORTA%.
  echo Abrindo o navegador...
  start "" "%URL%"
  goto :fim
)
if "%errorlevel%"=="2" goto :outro_processo

rem ---- 3) Dependencias instaladas? ----
if not exist "node_modules\next\package.json" goto :instalar
if not exist "node_modules\@supabase\supabase-js" goto :instalar
if not exist "node_modules\lucide-react" goto :instalar

echo Dependencias OK.
goto :rodar

:instalar
echo.
echo Dependencias nao encontradas. Rodando "npm install"...
echo (na primeira vez pode levar alguns minutos)
echo.
call npm install
if not "%errorlevel%"=="0" goto :erro_instalacao
echo.
echo Dependencias instaladas com sucesso.

:rodar
if not exist ".env.local" (
  if exist ".env.local.example" (
    echo.
    echo AVISO: .env.local nao existe.
    echo Copie .env.local.example para .env.local e preencha as variaveis.
  )
)

echo.
echo Iniciando o servidor de desenvolvimento na porta %PORTA%...
start "Gerenciador Simples - Dev (porta %PORTA%)" cmd /k "npm run dev"

echo Aguardando o servidor responder em %URL% ...
set /a tentativas=0

:esperar
call :verificar_app
if "%errorlevel%"=="0" goto :abrir
set /a tentativas+=1
if %tentativas% GEQ 90 goto :timeout
ping -n 2 127.0.0.1 >nul
goto :esperar

:abrir
echo.
echo Servidor no ar! Abrindo %URL%
start "" "%URL%"
goto :fim

:outro_processo
echo.
echo ERRO: a porta %PORTA% esta ocupada por outro programa, que nao e o gerenciador.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = (Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue)[0].OwningProcess; if ($p) { $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName; Write-Output ('PID ' + $p + ' - ' + $n) }"`) do echo   Encontrado: %%P
echo.
echo Feche esse programa, ou rode "fechar-gerenciador.bat" e tente de novo.
pause
goto :fim

:timeout
echo.
echo O servidor demorou para responder.
echo Abra manualmente no navegador: %URL%
goto :fim

:sem_node
echo.
echo ERRO: Node.js nao foi encontrado neste computador.
echo.
echo Instale o Node.js LTS ^(versao 22.13 ou superior^) em:
echo   https://nodejs.org/pt-br/download
echo.
echo Depois de instalar, feche e abra este arquivo novamente.
pause
goto :fim

:node_antigo
echo.
echo ERRO: a versao do Node.js instalada e antiga demais ^(v%NODEVER%^).
echo.
echo Este gerenciador precisa do Node.js 22.13 ou superior.
echo Instale a versao LTS atual em:
echo   https://nodejs.org/pt-br/download
echo.
echo Depois de instalar, feche e abra este arquivo novamente.
pause
goto :fim

:erro_instalacao
echo.
echo ERRO: o "npm install" falhou. Veja as mensagens acima.
pause
goto :fim

:fim
endlocal
exit /b 0

rem ---------------------------------------------------------------------------
rem verificar_app: responde sobre o estado da porta
rem   0 = o gerenciador esta rodando e respondendo na porta
rem   1 = porta livre (nada escutando)
rem   2 = porta ocupada por outro programa (nao e o gerenciador)
rem ---------------------------------------------------------------------------
:verificar_app
call :porta_ocupada
if errorlevel 1 exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$r = $null; try { $r = Invoke-WebRequest -Uri '%URL%/login' -UseBasicParsing -TimeoutSec 15 } catch {}; if ($r -and $r.StatusCode -eq 200 -and $r.Content -like '*Entrar no painel*') { exit 0 } else { exit 2 }" >nul 2>nul
exit /b %errorlevel%

rem Retorna errorlevel 0 se alguem estiver escutando na porta, 1 se estiver livre.
:porta_ocupada
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
exit /b %errorlevel%



