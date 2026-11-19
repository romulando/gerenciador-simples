@echo off
setlocal EnableExtensions
title Gerenciador Simples - Atualizar

rem ===========================================================================
rem  Baixa e instala a ultima versao publicada do Gerenciador Simples.
rem  Nao precisa de conta no GitHub nem do git instalado no computador.
rem
rem    atualizar-gerenciador.bat          pergunta antes de atualizar
rem    atualizar-gerenciador.bat /auto    atualiza direto (usado pelo
rem                                       abrir-gerenciador.bat)
rem
rem  Nunca apaga nem sobrescreve: .env.local, overlay.db (e -shm/-wal),
rem  node_modules, .next e public\uploads.
rem ===========================================================================

set "GS_AUTO="
if /i "%~1"=="/auto" set "GS_AUTO=1"

rem ---- Roda a partir de uma copia em TEMP ----
rem A atualizacao substitui os .bat da pasta do app. O cmd.exe le um .bat por
rem posicao de byte, entao ler este arquivo enquanto ele e sobrescrito quebra
rem o script. Rodando de uma copia em TEMP, a pasta do app fica livre.
if /i "%~1"=="/dentro" goto :corpo
copy /y "%~f0" "%TEMP%\gs-atualizar.bat" >nul 2>nul
if errorlevel 1 (
  set "GS_PASTA=%~dp0."
  goto :inicio
)
cmd /c ""%TEMP%\gs-atualizar.bat" /dentro "%~dp0.""
exit /b %errorlevel%

:corpo
set "GS_PASTA=%~2"
if "%GS_PASTA%"=="" set "GS_PASTA=%~dp0."

:inicio
cd /d "%GS_PASTA%" 2>nul
if errorlevel 1 goto :erro_pasta
if not exist "package.json" goto :erro_pasta

set "PASTA=%CD%"
set "PORTA=%GS_PORTA%"
if not defined PORTA set "PORTA=4000"
set "BASE=https://github.com/romulando/gerenciador-simples/releases/latest/download"
set "ARQ_VERSAO=%TEMP%\gs-versao-remota.txt"
set "ARQ_ZIP=%TEMP%\gs-pacote.zip"
set "PASTA_NOVA=%TEMP%\gs-pacote"
set "BACKUP=%PASTA%\.backup-antigo"

echo ==========================================
echo   Gerenciador Simples - Atualizar
echo ==========================================
echo.

set "VERSAO_LOCAL="
if exist "VERSAO.txt" for /f "usebackq delims=" %%v in ("VERSAO.txt") do if not defined VERSAO_LOCAL set "VERSAO_LOCAL=%%v"
if not defined VERSAO_LOCAL set "VERSAO_LOCAL=0.0.0"
echo Versao instalada: %VERSAO_LOCAL%

echo Verificando a ultima versao publicada...
if exist "%ARQ_VERSAO%" del /q "%ARQ_VERSAO%" >nul 2>nul
call :baixar "%BASE%/VERSAO.txt" "%ARQ_VERSAO%"
if errorlevel 1 goto :erro_rede

set "VERSAO_REMOTA="
for /f "usebackq delims=" %%v in ("%ARQ_VERSAO%") do if not defined VERSAO_REMOTA set "VERSAO_REMOTA=%%v"
if not defined VERSAO_REMOTA goto :erro_rede
echo Versao publicada: %VERSAO_REMOTA%

if /i "%VERSAO_LOCAL%"=="%VERSAO_REMOTA%" goto :ja_atualizado

if defined GS_AUTO goto :baixar_pacote
echo.
choice /c SN /n /m "Baixar e instalar a versao %VERSAO_REMOTA%? [S/N] "
if errorlevel 2 goto :cancelado

:baixar_pacote
echo.
echo Baixando o pacote...
if exist "%ARQ_ZIP%" del /q "%ARQ_ZIP%" >nul 2>nul
call :baixar "%BASE%/gerenciador.zip" "%ARQ_ZIP%"
if errorlevel 1 goto :erro_rede

set "TAMANHO=0"
for %%A in ("%ARQ_ZIP%") do set "TAMANHO=%%~zA"
if %TAMANHO% LSS 50000 goto :erro_download
echo Baixado: %TAMANHO% bytes.

rem ---- Extrai em pasta temporaria e confere se o pacote e valido ----
echo Extraindo...
if exist "%PASTA_NOVA%" rd /s /q "%PASTA_NOVA%" >nul 2>nul
mkdir "%PASTA_NOVA%" >nul 2>nul
where tar >nul 2>nul
if errorlevel 1 goto :extrair_ps
tar -xf "%ARQ_ZIP%" -C "%PASTA_NOVA%" >nul 2>nul
if not errorlevel 1 goto :validar
:extrair_ps
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference = 'SilentlyContinue'; Expand-Archive -LiteralPath '%ARQ_ZIP%' -DestinationPath '%PASTA_NOVA%' -Force } catch { exit 1 }" >nul 2>nul
if errorlevel 1 goto :erro_extrair

:validar
if not exist "%PASTA_NOVA%\package.json" goto :erro_extrair
if not exist "%PASTA_NOVA%\app\layout.tsx" goto :erro_extrair
if not exist "%PASTA_NOVA%\VERSAO.txt" goto :erro_extrair

rem ---- Encerra o gerenciador antes de trocar os arquivos ----
echo.
echo Encerrando o gerenciador (porta %PORTA%)...
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue; foreach ($x in $c) { $x.OwningProcess }"`) do taskkill /PID %%P /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Gerenciador Simples - Dev*" /T /F >nul 2>nul
ping -n 3 127.0.0.1 >nul

rem ---- Backup da versao atual (para poder voltar atras) ----
echo Fazendo backup da versao %VERSAO_LOCAL%...
if exist "%BACKUP%" rd /s /q "%BACKUP%" >nul 2>nul
robocopy "%PASTA%" "%BACKUP%" /E /XD node_modules .next .git ".backup-antigo" "public\uploads" /XF overlay.db overlay.db-shm overlay.db-wal .env.local /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :erro_backup

rem ---- Precisou mexer nas dependencias? ----
set "INSTALAR="
if not exist "node_modules\next\package.json" set "INSTALAR=1"
if not exist "node_modules\better-sqlite3" set "INSTALAR=1"
if exist "package.json" (
  fc /b "package.json" "%PASTA_NOVA%\package.json" >nul 2>nul
  if errorlevel 1 set "INSTALAR=1"
)

rem ---- Aplica os arquivos novos ----
echo Copiando os arquivos novos...
for %%D in (app components lib) do if exist "%%D" rd /s /q "%%D"
robocopy "%PASTA_NOVA%" "%PASTA%" /E /IS /IT /XF .env.local overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :erro_aplicar
if not exist "VERSAO.txt" goto :erro_aplicar

if defined INSTALAR (
  echo.
  echo As dependencias mudaram. Rodando "npm install"...
  echo (pode levar alguns minutos)
  echo.
  call npm install
  if errorlevel 1 goto :erro_install
)

if exist "%ARQ_ZIP%" del /q "%ARQ_ZIP%" >nul 2>nul
if exist "%PASTA_NOVA%" rd /s /q "%PASTA_NOVA%" >nul 2>nul
if exist "%ARQ_VERSAO%" del /q "%ARQ_VERSAO%" >nul 2>nul

echo.
echo ==========================================
echo   Atualizado para a versao %VERSAO_REMOTA%
echo ==========================================
echo Um backup da versao anterior ficou em:
echo   %BACKUP%
echo (pode apagar essa pasta quando quiser)
echo.
choice /c SN /n /m "Abrir o gerenciador agora? [S/N] "
if errorlevel 2 goto :fim
start "" "%PASTA%\abrir-gerenciador.bat"
goto :fim

:ja_atualizado
echo.
echo Voce ja esta na ultima versao (%VERSAO_LOCAL%). Nada a fazer.
goto :fim

:cancelado
echo.
echo Nada foi alterado.
goto :fim

:erro_rede
echo.
echo ERRO: nao consegui falar com o GitHub.
echo Verifique a conexao com a internet e tente de novo.
echo Nada foi alterado.
goto :erro_fim

:erro_download
echo.
echo ERRO: o download do pacote falhou ou veio incompleto.
echo Nada foi alterado.
goto :erro_fim

:erro_extrair
echo.
echo ERRO: o pacote baixado nao parece ser valido.
echo Nada foi alterado.
goto :erro_fim

:erro_backup
echo.
echo ERRO: nao consegui fazer o backup da versao atual.
echo Nada foi alterado.
goto :erro_fim

:erro_aplicar
echo.
echo ERRO ao copiar os arquivos novos. Restaurando a versao anterior...
robocopy "%BACKUP%" "%PASTA%" /E /IS /IT /XF .env.local overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo.
  echo ATENCAO: a restauracao tambem falhou.
  echo Copie a pasta de volta manualmente:
  echo   %BACKUP%
) else (
  echo Versao %VERSAO_LOCAL% restaurada.
)
goto :erro_fim

:erro_install
echo.
echo As dependencias nao puderam ser instaladas.
echo A versao %VERSAO_REMOTA% ja foi copiada, mas o app pode nao abrir.
echo Para resolver, abra a pasta e rode:  npm install
goto :erro_fim

:erro_pasta
echo.
echo ERRO: nao encontrei a pasta do gerenciador.
echo Coloque este arquivo junto do "abrir-gerenciador.bat" e tente de novo.
goto :erro_fim

:erro_fim
echo.
pause
endlocal
exit /b 1

:fim
endlocal
exit /b 0

rem ---------------------------------------------------------------------------
rem baixar <url> <destino>   -> errorlevel 0 = ok
rem ---------------------------------------------------------------------------
:baixar
where curl >nul 2>nul
if errorlevel 1 goto :baixar_ps
curl -fsSL --retry 2 --max-time 180 -o "%~2" "%~1" 2>nul
if not errorlevel 1 (
  if exist "%~2" exit /b 0
)
:baixar_ps
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%~1' -OutFile '%~2' -UseBasicParsing -TimeoutSec 180 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 exit /b 1
if not exist "%~2" exit /b 1
exit /b 0
