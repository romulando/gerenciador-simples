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
rem    5. cria a release no GitHub com esse zip
rem
rem  O cliente nao precisa de conta: ele baixa o zip da release mais nova.
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
gh auth status >nul 2>nul
if errorlevel 1 goto :sem_gh

set "VERSAO_ATUAL="
if exist "VERSAO.txt" for /f "usebackq delims=" %%v in ("VERSAO.txt") do if not defined VERSAO_ATUAL set "VERSAO_ATUAL=%%v"
if not defined VERSAO_ATUAL set "VERSAO_ATUAL=0.0.0"
echo Versao publicada hoje: %VERSAO_ATUAL%
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

set "ZIP=%TEMP%\gerenciador-%NOVA%.zip"
if exist "%ZIP%" del /q "%ZIP%" >nul 2>nul
echo Montando o pacote...
git archive --format=zip --output="%ZIP%" HEAD
if errorlevel 1 goto :erro_zip
for %%A in ("%ZIP%") do echo Pacote: %%~zA bytes

echo Criando a release no GitHub...
gh release create "v%NOVA%" "%ZIP%#gerenciador.zip" "VERSAO.txt#VERSAO.txt" --title "v%NOVA%" --notes "Gerenciador Simples v%NOVA%."
if errorlevel 1 goto :erro_release

del /q "%ZIP%" >nul 2>nul

echo.
echo ==========================================
echo   Versao %NOVA% publicada!
echo ==========================================
echo Clientes com o app fechado recebem a atualizacao
echo na proxima vez que abrirem o abrir-gerenciador.bat.
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
echo Versao invalida. Use o formato MAJOR.MINOR.PATCH, diferente de %VERSAO_ATUAL%.
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

:erro_release
echo.
echo ERRO: nao consegui criar a release no GitHub.
echo O commit e a tag v%NOVA% ja foram enviados; tente de novo:
echo   gh release create v%NOVA% "%ZIP%#gerenciador.zip" "VERSAO.txt#VERSAO.txt"
goto :fim_erro

:fim_erro
echo.
pause
endlocal
exit /b 1
