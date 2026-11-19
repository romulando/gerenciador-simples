@echo off
setlocal EnableExtensions
title Gerenciador Simples - Publicar versao

rem ===========================================================================
rem  Publica uma versao nova para os clientes atualizarem.
rem  Roda no SEU computador (precisa de git + gh autenticado no GitHub).
rem
rem  O que ele faz:
rem    1. grava a nova versao no VERSAO.txt
rem    2. commit + push no main
rem    3. cria a tag vX.Y.Z e envia a tag
rem    4. monta o zip SO com arquivos versionados (sem .env.local,
rem       overlay.db, node_modules e .next)
rem    5. injeta o token de leitura (token.txt) como token.dat no zip
rem    6. cria a release no GitHub com esse zip
rem    7. copia o zip para dist\ (para entregar a um cliente novo)
rem
rem  O token.txt NAO vai para o repositorio: ele so existe dentro do zip
rem  publicado e no seu computador.
rem ===========================================================================

cd /d "%~dp0"

echo ==========================================
echo   Gerenciador Simples - Publicar versao
echo ==========================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :sem_git
where gh >nul 2>nul
if errorlevel 1 goto :sem_gh
where curl >nul 2>nul
if errorlevel 1 goto :sem_curl
gh auth status >nul 2>nul
if errorlevel 1 goto :sem_gh

if not exist "token.txt" goto :sem_token
set "TOKEN="
for /f "usebackq delims=" %%t in ("token.txt") do if not defined TOKEN set "TOKEN=%%t"
if not defined TOKEN goto :sem_token

echo Conferindo o token...
curl -fsSL --max-time 30 -o nul -H "Authorization: Bearer %TOKEN%" -H "Accept: application/vnd.github+json" -H "User-Agent: gerenciador-simples" "https://api.github.com/repos/romulando/gerenciador-simples" 2>nul
if errorlevel 1 goto :token_invalido

set "VERSAO_ATUAL="
if exist "VERSAO.txt" for /f "usebackq delims=" %%v in ("VERSAO.txt") do if not defined VERSAO_ATUAL set "VERSAO_ATUAL=%%v"
if not defined VERSAO_ATUAL set "VERSAO_ATUAL=0.0.0"
echo Token OK. Versao publicada hoje: %VERSAO_ATUAL%
echo.

set "NOVA="
set /p "NOVA=Nova versao (ex: 1.0.1): "
if not defined NOVA goto :cancelado
echo %NOVA%|findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 goto :versao_invalida
if /i "%NOVA%"=="%VERSAO_ATUAL%" goto :versao_invalida

set "SUJO="
for /f "usebackq delims=" %%s in (`git status --porcelain`) do set "SUJO=1"
if defined SUJO goto :sujo

echo.
echo Publicando a versao %NOVA%...
echo.

> "VERSAO.txt" echo %NOVA%
git add -A
git commit -m "v%NOVA%" >nul
if errorlevel 1 goto :erro_commit

git push
if errorlevel 1 goto :erro_push

git tag "v%NOVA%"
if errorlevel 1 goto :erro_tag
git push origin "v%NOVA%"
if errorlevel 1 goto :erro_push

set "PASTA_ZIP=%TEMP%\gs-publicar"
if exist "%PASTA_ZIP%" rd /s /q "%PASTA_ZIP%" >nul 2>nul
mkdir "%PASTA_ZIP%" >nul 2>nul
rem O nome do arquivo vira o nome do asset na release, entao ele ja sai
rem como "gerenciador.zip" (o updater procura exatamente esse nome).
set "ZIP=%PASTA_ZIP%\gerenciador.zip"
echo Montando o pacote...
git archive --format=zip --output="%ZIP%" HEAD
if errorlevel 1 goto :erro_zip

echo Injetando o token de acesso...
set "TOKEN_ARQ=%CD%\token.txt"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Add-Type -AssemblyName System.IO.Compression.FileSystem; $z = [System.IO.Compression.ZipFile]::Open('%ZIP%', 'Update'); try { $e = $z.GetEntry('token.dat'); if ($e) { $e.Delete() }; [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, '%TOKEN_ARQ%', 'token.dat') } finally { $z.Dispose() } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 goto :erro_token_zip

for %%A in ("%ZIP%") do echo Pacote: %%~zA bytes

echo Criando a release no GitHub...
gh release create "v%NOVA%" "%ZIP%" "VERSAO.txt" --title "v%NOVA%" --notes "Gerenciador Simples v%NOVA%."
if errorlevel 1 goto :erro_release

if not exist "dist" mkdir "dist" >nul 2>nul
copy /y "%ZIP%" "dist\gerenciador-%NOVA%.zip" >nul 2>nul

echo.
echo ==========================================
echo   Versao %NOVA% publicada!
echo ==========================================
echo Clientes com o app fechado recebem a atualizacao
echo na proxima vez que abrirem o abrir-gerenciador.bat.
echo.
echo Pacote para entregar a um cliente novo:
echo   %CD%\dist\gerenciador-%NOVA%.zip
echo.
echo Link da release:
echo   https://github.com/romulando/gerenciador-simples/releases/tag/v%NOVA%
echo.
pause
endlocal
exit /b 0

:cancelado
echo.
echo Nada foi publicado.
goto :fim_erro

:versao_invalida
echo.
echo Versao invalida. Use MAJOR.MINOR.PATCH e diferente de %VERSAO_ATUAL%.
echo Exemplo: 1.0.1
goto :fim_erro

:sujo
echo.
echo Ha alteracoes nao commitadas. Resolva antes de publicar:
echo   git status
echo.
echo (A release precisa sair de um commit fechado, senao o zip nao bate
echo com o que esta no seu computador.)
goto :fim_erro

:sem_git
echo.
echo ERRO: o git nao foi encontrado neste computador.
echo Instale em https://git-scm.com/download/win
goto :fim_erro

:sem_gh
echo.
echo ERRO: o GitHub CLI (gh) nao esta instalado ou nao esta logado.
echo Instale com:  winget install GitHub.cli
echo Depois rode:  gh auth login
goto :fim_erro

:sem_curl
echo.
echo ERRO: o curl nao foi encontrado neste computador.
echo Ele vem junto com o Windows 10/11. Atualize o Windows ou instale o curl.
goto :fim_erro

:sem_token
echo.
echo ERRO: falta o arquivo token.txt nesta pasta.
echo.
echo Crie um token de leitura no GitHub:
echo   1. Settings ^> Developer settings ^> Personal access tokens
echo      ^> Fine-grained tokens ^> Generate new token
echo   2. Repository access: Only select repositories ^> gerenciador-simples
echo   3. Permissions ^> Repository permissions ^> Contents: Read-only
echo   4. Copie o token e cole dentro de token.txt (ele nao vai para o git)
goto :fim_erro

:token_invalido
echo.
echo ERRO: o token do token.txt nao funcionou.
echo Confira se ele nao expirou e se tem acesso ao repo gerenciador-simples
echo com a permissao Contents: Read-only.
goto :fim_erro

:erro_commit
echo.
echo ERRO: o commit falhou. Veja a mensagem acima.
goto :fim_erro

:erro_push
echo.
echo ERRO: o push falhou. Veja a mensagem acima.
goto :fim_erro

:erro_tag
echo.
echo ERRO: nao consegui criar a tag v%NOVA%.
echo Se ela ja existe, apague com:  git tag -d v%NOVA%
goto :fim_erro

:erro_zip
echo.
echo ERRO: nao consegui montar o pacote.
goto :fim_erro

:erro_token_zip
echo.
echo ERRO: nao consegui colocar o token.dat dentro do pacote.
echo Nada foi enviado ao GitHub. Rode de novo.
goto :fim_erro

:erro_release
echo.
echo ERRO: nao consegui criar a release no GitHub.
echo O commit e a tag v%NOVA% ja foram enviados; tente de novo:
echo   gh release create v%NOVA% "%ZIP%" "VERSAO.txt"
goto :fim_erro

:fim_erro
echo.
pause
endlocal
exit /b 1
