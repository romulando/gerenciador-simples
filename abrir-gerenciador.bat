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

rem ---- 3) Ha versao nova publicada? ----
call :checar_atualizacao
if errorlevel 1 goto :atualizando

rem ---- 4) Dependencias instaladas? ----
if not exist "node_modules\next\package.json" goto :instalar
if not exist "node_modules\better-sqlite3" goto :instalar
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

:atualizando
echo.
echo O atualizador foi aberto em outra janela.
echo Quando ele terminar, o gerenciador abre sozinho.
goto :fim

:sem_node
echo.
echo ERRO: Node.js nao foi encontrado neste computador.
echo.
echo Instale o Node.js LTS ^(versao 20 ou superior^) em:
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

rem ---------------------------------------------------------------------------
rem checar_atualizacao: compara a versao local com a ultima release publicada
rem   0 = segue com a versao local (atualizada, sem token ou sem conexao)
rem   1 = atualizador aberto em outra janela; nao abra o app agora
rem ---------------------------------------------------------------------------
:checar_atualizacao
if not exist "%~dp0atualizar-gerenciador.bat" exit /b 0
rem Copia de desenvolvimento (tem .git): quem atualiza e o dono, nao o .bat.
if exist "%~dp0.git" exit /b 0
rem O pacote distribuido leva o token de leitura em token.dat.
if not exist "%~dp0token.dat" exit /b 0

set "VERSAO_LOCAL="
if exist "VERSAO.txt" for /f "usebackq delims=" %%v in ("VERSAO.txt") do if not defined VERSAO_LOCAL set "VERSAO_LOCAL=%%v"
if not defined VERSAO_LOCAL set "VERSAO_LOCAL=0.0.0"

echo Procurando atualizacoes...
set "ARQ_JSON=%TEMP%\gs-release.json"
set "ARQ_TXT=%TEMP%\gs-release.txt"
del /q "%ARQ_JSON%" "%ARQ_TXT%" >nul 2>nul
call :baixar_release "%ARQ_JSON%" "%ARQ_TXT%"
if errorlevel 1 exit /b 0

set "VERSAO_NOVA="
for /f "usebackq delims=" %%v in ("%ARQ_TXT%") do if not defined VERSAO_NOVA set "VERSAO_NOVA=%%v"
del /q "%ARQ_JSON%" "%ARQ_TXT%" >nul 2>nul
if not defined VERSAO_NOVA exit /b 0
if /i "%VERSAO_LOCAL%"=="%VERSAO_NOVA%" exit /b 0

echo.
echo ------------------------------------------
echo   Atualizacao disponivel
echo   Instalada: %VERSAO_LOCAL%
echo   Nova:      %VERSAO_NOVA%
echo ------------------------------------------
choice /c SN /n /m "Atualizar agora? [S/N] "
if errorlevel 2 (
  echo.
  echo Seguindo com a versao %VERSAO_LOCAL%.
  exit /b 0
)
echo.
echo Abrindo o atualizador...
start "" "%~dp0atualizar-gerenciador.bat" /auto
exit /b 1

rem ---------------------------------------------------------------------------
rem baixar_release <json> <versao.txt>
rem Le a ultima release do repo privado e grava a versao (sem o "v").
rem ---------------------------------------------------------------------------
:baixar_release
call :requisicao "https://api.github.com/repos/romulando/gerenciador-simples/releases/latest" "%~1"
if errorlevel 1 exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Get-Content -Raw -LiteralPath '%~1' | ConvertFrom-Json; if (-not $r.tag_name) { exit 1 }; ($r.tag_name -replace '^v','') | Set-Content -LiteralPath '%~2' -Encoding ascii } catch { exit 1 }" >nul 2>nul
if errorlevel 1 exit /b 1
if not exist "%~2" exit /b 1
exit /b 0

rem ---------------------------------------------------------------------------
rem requisicao <url> <destino> [accept]
rem Baixa usando o token de token.dat (o repo e privado). 0 = ok
rem ---------------------------------------------------------------------------
:requisicao
set "TOKEN=%GS_TOKEN%"
if not defined TOKEN for /f "usebackq delims=" %%t in ("%~dp0token.dat") do if not defined TOKEN set "TOKEN=%%t"
if not defined TOKEN exit /b 1
set "ACCEPT=%~3"
if not defined ACCEPT set "ACCEPT=application/vnd.github+json"
where curl >nul 2>nul
if errorlevel 1 goto :requisicao_ps
curl -fsSL --retry 2 --max-time 300 -H "Authorization: Bearer %TOKEN%" -H "Accept: %ACCEPT%" -H "User-Agent: gerenciador-simples" -o "%~2" "%~1" 2>nul
if not errorlevel 1 if exist "%~2" exit /b 0
:requisicao_ps
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference = 'SilentlyContinue'; $h = @{ 'Authorization' = 'Bearer %TOKEN%'; 'Accept' = '%ACCEPT%'; 'User-Agent' = 'gerenciador-simples' }; Invoke-WebRequest -Uri '%~1' -Headers $h -OutFile '%~2' -UseBasicParsing -TimeoutSec 300 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 exit /b 1
if not exist "%~2" exit /b 1
exit /b 0

