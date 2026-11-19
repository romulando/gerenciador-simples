@echo off
setlocal EnableExtensions
title Gerenciador Simples - Theone

rem ===========================================================================
rem  Abre o Gerenciador Simples.
rem
rem  Antes de abrir, atualiza o codigo pelo Git:
rem    - se a pasta ja e um clone (tem .git), roda "git pull --ff-only";
rem    - se ainda nao e clone, baixa o repositorio e transforma a pasta em
rem      clone, preservando overlay.db, node_modules e uploads;
rem    - se a pasta estiver vazia (so com este .bat e os dados locais), baixa
rem      o projeto do zero, incluindo o .env.local versionado.
rem
rem  O repositorio e privado. O acesso usa um token fine-grained
rem  (Contents: Read-only) embutido neste .bat; nao precisa de conta no GitHub.
rem  Crie o token com validade de 1 ano e anote a data para renovar.
rem  Se o Git nao estiver instalado, o script oferece instalar pelo winget.
rem
rem  Este .bat e o .env.local sao versionados no repositorio. O .bat roda a
rem  partir de uma copia em TEMP para poder se atualizar sem interromper a
rem  execucao. A janela do servidor mostra o resultado da atualizacao.
rem ===========================================================================

if /i "%~1"=="/dentro" goto :corpo

set "PASTA=%~dp0"
if "%PASTA:~-1%"=="\" set "PASTA=%PASTA:~0,-1%"
set "SEM_ATUALIZACAO="
del /q "%TEMP%\gs-abrir.bat" >nul 2>nul
copy /y "%~f0" "%TEMP%\gs-abrir.bat" >nul 2>nul
if errorlevel 1 goto :sem_copia
start "Gerenciador Simples - Theone" cmd /c ""%TEMP%\gs-abrir.bat" /dentro "%PASTA%""
if errorlevel 1 goto :sem_copia
exit /b 0

:sem_copia
set "SEM_ATUALIZACAO=1"
goto :inicio

:corpo
set "PASTA=%~2"
if not defined PASTA goto :erro_pasta

:inicio
cd /d "%PASTA%" 2>nul
if errorlevel 1 goto :erro_pasta

set "PORTA=4000"
set "URL=http://localhost:%PORTA%"

rem Token fine-grained do GitHub (Contents: Read-only neste repositorio).
rem Validade sugerida: 1 ano. Anote a data para renovar.
rem Este token fica no repositorio privado para os clientes baixarem o codigo.
set "GIT_TOKEN=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"
if not defined GIT_TOKEN set "GIT_TOKEN=SEU_TOKEN_AQUI"

set "REPO_PATH=github.com/romulando/gerenciador-simples.git"
set "REPO_PUBLICO=https://%REPO_PATH%"
if /i "%GIT_TOKEN%"=="SEU_TOKEN_AQUI" (
  set "REPO=%REPO_PUBLICO%"
) else (
  set "REPO=https://x-access-token:%GIT_TOKEN%@%REPO_PATH%"
)

set "LOG_GIT=%TEMP%\gs-git-erro.txt"
set "GIT_TERMINAL_PROMPT=0"
set "GCM_INTERACTIVE=Never"
set "GIT="
set "ATUALIZOU="
set "INSTALAR="
set "MIGROU="
set "VERSAO_LOCAL="
set "TEM_ATUALIZACAO="
set "FALHA_CHECAGEM="
set "MOTIVO_GIT="
set "STATUS_VERSAO=Versao NAO VERIFICADA"
set "STATUS_DETALHE="
set "STATUS_AVISO="
set "STATUS_EXTRA="

echo ==========================================
echo   Gerenciador Simples - Theone
echo   Porta fixa: %PORTA%
echo ==========================================
echo.

if /i "%GIT_TOKEN%"=="SEU_TOKEN_AQUI" (
  echo AVISO: o token do GitHub nao foi configurado neste .bat.
  echo O repositorio e privado, entao o download nao vai funcionar.
  echo Substitua SEU_TOKEN_AQUI pelo token fine-grained.
  echo.
  set "STATUS_AVISO=AVISO: token do GitHub nao configurado."
)

rem ---- 1) Node.js instalado? ----
where node >nul 2>nul
if errorlevel 1 goto :sem_node

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODEVER=%%v"
set "NODEVER=%NODEVER:v=%"
echo Node.js encontrado: v%NODEVER%

rem ---- 1.1) O Node precisa ter o SQLite embutido (node:sqlite, Node 22.13+) ----
node -e "require('node:sqlite')" >nul 2>nul
if errorlevel 1 goto :node_antigo

rem ---- 1.2) Git (necessario para atualizar) ----
call :detectar_git
if defined GIT goto :git_ok

echo.
echo AVISO: o Git nao foi encontrado neste computador.
echo Ele e necessario para baixar as atualizacoes automaticamente.
echo.
choice /c SN /n /m "Tentar instalar o Git agora? [S/N] "
if errorlevel 2 goto :sem_git

where winget >nul 2>nul
if errorlevel 1 (
  echo.
  echo Abrindo a pagina de download do Git...
  start "" "https://git-scm.com/download/win"
  goto :sem_git
)

echo.
echo Instalando o Git pelo winget...
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
call :detectar_git
if defined GIT goto :git_ok

:sem_git
echo.
echo Sem o Git, o gerenciador so abre se o projeto ja estiver nesta pasta.
echo Para baixar e atualizar, instale em https://git-scm.com/download/win
echo e abra este atalho de novo.
set "STATUS_VERSAO=Versao NAO VERIFICADA: Git nao encontrado"
set "STATUS_DETALHE=Instale o Git para atualizar automaticamente."
goto :apos_git

:git_ok
echo Git encontrado.

:apos_git

rem ---- 2) O gerenciador ja esta rodando na porta? ----
call :verificar_app
if "%errorlevel%"=="0" goto :ja_rodando
if "%errorlevel%"=="2" goto :outro_processo

rem ---- 3) Atualizar o codigo ----
call :atualizar
if errorlevel 1 goto :fim

if not exist "package.json" goto :sem_projeto
if not exist "app\layout.tsx" goto :sem_projeto
if not exist "lib\overlay.ts" goto :sem_projeto
if not exist ".env.local" goto :sem_env

if not defined ATUALIZOU goto :sem_limpeza
echo.
echo Limpando o cache do Next.js...
if exist ".next" rd /s /q ".next" >nul 2>nul
if exist "tsconfig.tsbuildinfo" del /q "tsconfig.tsbuildinfo" >nul 2>nul

:sem_limpeza

rem ---- 4) Dependencias instaladas? ----
if defined INSTALAR goto :instalar
if not exist "node_modules\next\package.json" goto :instalar
if not exist "node_modules\@supabase\supabase-js" goto :instalar
if not exist "node_modules\lucide-react" goto :instalar

echo Dependencias OK.
goto :rodar

:instalar
echo.
echo Dependencias nao encontradas ou alteradas. Rodando "npm install"...
echo (na primeira vez pode levar alguns minutos)
echo.
call npm install
if not "%errorlevel%"=="0" goto :erro_instalacao
echo.
echo Dependencias instaladas com sucesso.
set "STATUS_EXTRA=Dependencias reinstaladas."

:rodar
echo.
call :preparar_status
echo Iniciando o servidor de desenvolvimento na porta %PORTA%...
start "Gerenciador Simples - Dev (porta %PORTA%)" cmd /k ""%TEMP%\gs-dev.bat""

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

:ja_rodando
echo.
echo JA EXISTE UM SERVIDOR RODANDO NA PORTA %PORTA%.
echo.
echo Abrindo o navegador...
start "" "%URL%"
if defined GIT call :checar_atualizacao_rodando
if defined TEM_ATUALIZACAO goto :ja_rodando_espera
if defined FALHA_CHECAGEM goto :ja_rodando_espera
echo.
echo Esta janela fecha em alguns segundos.
ping -n 5 127.0.0.1 >nul
goto :fim

:ja_rodando_espera
echo.
echo Pressione uma tecla para fechar esta janela.
pause >nul
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
echo.
echo Pressione uma tecla para fechar esta janela.
pause >nul
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

:erro_pasta
echo.
echo ERRO: nao consegui acessar a pasta onde o atalho esta.
echo Verifique as permissoes e tente de novo.
pause
goto :fim

:sem_projeto
echo.
echo ERRO: nao encontrei o gerenciador nesta pasta.
echo A pasta precisa ter "package.json", "app\layout.tsx" e "lib\overlay.ts".
echo Se ela estava vazia, o projeto nao foi baixado.
echo Confira se o Git esta instalado e veja as mensagens acima.
pause
goto :fim

:sem_env
echo.
echo ERRO: o arquivo .env.local nao foi encontrado.
echo Ele e versionado e deveria ter vindo junto com o projeto.
echo.
echo Feche esta janela, apague a pasta ".git" e abra o atalho de novo
echo para baixar o projeto completo.
pause
goto :fim

:fim
endlocal
exit /b 0

rem ---------------------------------------------------------------------------
rem preparar_status: monta o texto e a janela do servidor. A janela fica
rem aberta com os logs do Next e mostra o resultado da atualizacao no topo.
rem ---------------------------------------------------------------------------
:preparar_status
set "GS_STATUS=%TEMP%\gs-status.txt"
> "%GS_STATUS%" echo ==========================================
>>"%GS_STATUS%" echo   Gerenciador Simples - Theone
>>"%GS_STATUS%" echo   Porta %PORTA% - http://localhost:%PORTA%
>>"%GS_STATUS%" echo ==========================================
>>"%GS_STATUS%" echo.
>>"%GS_STATUS%" echo %STATUS_VERSAO%
if defined STATUS_DETALHE >>"%GS_STATUS%" echo %STATUS_DETALHE%
if defined STATUS_AVISO >>"%GS_STATUS%" echo %STATUS_AVISO%
if defined STATUS_EXTRA >>"%GS_STATUS%" echo %STATUS_EXTRA%
>>"%GS_STATUS%" echo.
>>"%GS_STATUS%" echo Iniciando o servidor...
>>"%GS_STATUS%" echo.

> "%TEMP%\gs-dev.bat" echo @echo off
>>"%TEMP%\gs-dev.bat" echo title Gerenciador Simples - Dev (porta %PORTA%)
>>"%TEMP%\gs-dev.bat" echo type "%%TEMP%%\gs-status.txt"
>>"%TEMP%\gs-dev.bat" echo npm run dev
exit /b 0

rem ---------------------------------------------------------------------------
rem detectar_git: define GIT com o caminho do executavel.
rem O winget instala em Program Files, mas a janela atual pode nao ter o PATH
rem atualizado; por isso confere tambem os caminhos padrao.
rem ---------------------------------------------------------------------------
:detectar_git
set "GIT="
where git >nul 2>nul
if not errorlevel 1 set "GIT=git"
if defined GIT exit /b 0
if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if defined GIT exit /b 0
if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "GIT=%ProgramFiles(x86)%\Git\cmd\git.exe"
if defined GIT exit /b 0
if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if defined GIT exit /b 0
exit /b 1

rem ---------------------------------------------------------------------------
rem diagnosticar_git: mostra o erro do Git com o token mascarado e explica
rem os motivos mais comuns (token rejeitado, sem acesso, sem internet,
rem alteracoes locais). Apaga o log no final.
rem ---------------------------------------------------------------------------
:diagnosticar_git
set "MOTIVO_GIT="
if not exist "%LOG_GIT%" exit /b 0

echo.
echo ---- Detalhes do Git ----
set "GS_LOG=%LOG_GIT%"
set "GS_TOKEN=%GIT_TOKEN%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=$env:GS_LOG; $t=$env:GS_TOKEN; if (Test-Path -LiteralPath $p) { $l = @(Get-Content -LiteralPath $p -ErrorAction SilentlyContinue); if ($t) { $l = $l | ForEach-Object { $_.Replace($t,'***') } }; if ($l.Count -gt 0) { $l | Select-Object -Last 20 } else { '(sem detalhes)' } } else { '(sem detalhes)' }"
set "GS_TOKEN="
set "GS_LOG="
echo -------------------------

findstr /i /c:"Authentication failed" /c:"Invalid username or token" /c:"Invalid username or password" /c:"Password authentication is not supported" /c:"could not read Username" /c:"terminal prompts disabled" /c:"error: 401" "%LOG_GIT%" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo MOTIVO PROVAVEL: o GitHub rejeitou o token.
  echo Ele pode estar invalido, expirado ou revogado.
  echo Gere um novo token fine-grained ^(Contents: Read-only^) e substitua no .bat.
  set "MOTIVO_GIT=Motivo: token do GitHub rejeitado ou expirado."
  goto :diag_fim
)

findstr /i /c:"Repository not found" /c:"error: 404" "%LOG_GIT%" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo MOTIVO PROVAVEL: repositorio nao encontrado ^(404^).
  echo O token pode nao ter acesso a este repositorio, ou a URL esta errada.
  echo Confira no GitHub se o token tem o repo "gerenciador-simples"
  echo e a permissao Contents: Read-only.
  set "MOTIVO_GIT=Motivo: repositorio nao encontrado ou sem acesso."
  goto :diag_fim
)

findstr /i /c:"Could not resolve host" /c:"Failed to connect" /c:"unable to access" /c:"timed out" /c:"Connection refused" /c:"Connection reset" "%LOG_GIT%" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo MOTIVO PROVAVEL: sem conexao com o GitHub.
  echo Verifique a internet, o proxy ou o firewall e tente de novo.
  set "MOTIVO_GIT=Motivo: sem conexao com o GitHub."
  goto :diag_fim
)

findstr /i /c:"local changes" /c:"Not possible to fast-forward" /c:"diverged" /c:"CONFLICT" /c:"would be overwritten" "%LOG_GIT%" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo MOTIVO PROVAVEL: ha alteracoes locais ou o historico divergiu.
  echo Feche com "fechar-gerenciador.bat" e tente de novo. Se persistir,
  echo faca backup da pasta e apague a pasta .git para baixar de novo.
  set "MOTIVO_GIT=Motivo: alteracoes locais ou historico divergido."
  goto :diag_fim
)

echo.
echo MOTIVO: veja a mensagem do Git acima.
set "MOTIVO_GIT=Motivo: falha ao acessar o repositorio."

:diag_fim
del /q "%LOG_GIT%" >nul 2>nul
exit /b 0

rem ---------------------------------------------------------------------------
rem nome_permitido: arquivos que podem existir na pasta antes do bootstrap.
rem Qualquer outro arquivo faz o script pedir confirmacao antes de copiar.
rem ---------------------------------------------------------------------------
:nome_permitido
if /i "%NOME%"=="abrir-gerenciador.bat" exit /b 0
if /i "%NOME%"=="fechar-gerenciador.bat" exit /b 0
if /i "%NOME%"==".env.local" exit /b 0
if /i "%NOME%"==".env.local.example" exit /b 0
if /i "%NOME%"=="token.dat" exit /b 0
if /i "%NOME%"=="overlay.db" exit /b 0
if /i "%NOME%"=="overlay.db-shm" exit /b 0
if /i "%NOME%"=="overlay.db-wal" exit /b 0
if /i "%NOME%"==".backup-antigo" exit /b 0
if /i "%NOME%"=="node_modules" exit /b 0
if /i "%NOME%"==".next" exit /b 0
if /i "%NOME%"=="public" exit /b 0
if /i "%NOME%"=="tsconfig.tsbuildinfo" exit /b 0
exit /b 1

rem ---------------------------------------------------------------------------
rem atualizar: pula quando o Git nao esta disponivel. Com .git usa pull;
rem sem .git prepara a pasta como clone (uma unica vez).
rem ---------------------------------------------------------------------------
:atualizar
if defined SEM_ATUALIZACAO goto :atualizar_sem_copia
if not defined GIT goto :atualizar_sem_git
if exist ".git" if exist "package.json" goto :atualizar_pull
if exist "package.json" goto :adotar_repo
goto :bootstrap_repo

:atualizar_sem_copia
set "STATUS_VERSAO=Versao NAO VERIFICADA: atualizacao automatica indisponivel"
set "STATUS_DETALHE=Nao consegui preparar a copia temporaria do atalho."
exit /b 0

:atualizar_sem_git
set "STATUS_VERSAO=Versao NAO VERIFICADA: Git nao encontrado"
set "STATUS_DETALHE=Instale o Git para atualizar automaticamente."
exit /b 0

:atualizar_pull
echo.
echo Verificando atualizacoes...
taskkill /FI "WINDOWTITLE eq Gerenciador Simples - Dev*" /T /F >nul 2>nul
ping -n 2 127.0.0.1 >nul

set "ARQ_GIT=%TEMP%\gs-git.txt"
set "VELHO="
"%GIT%" -C "%CD%" rev-parse HEAD > "%ARQ_GIT%" 2>nul
set /p VELHO=<"%ARQ_GIT%"
set "VELHO_CURTO="
"%GIT%" -C "%CD%" rev-parse --short HEAD > "%ARQ_GIT%" 2>nul
set /p VELHO_CURTO=<"%ARQ_GIT%"
if not defined VELHO_CURTO set "VELHO_CURTO=local"

set "GIT_TERMINAL_PROMPT=0"
call :fazer_pull
if not errorlevel 1 goto :atualizar_pull_ok

findstr /i /c:"untracked working tree files" /c:"would be overwritten" "%LOG_GIT%" >nul 2>nul
if errorlevel 1 goto :atualizar_pull_falhou
call :migrar_nao_rastreados
if not defined MIGROU goto :atualizar_pull_falhou
call :fazer_pull
if not errorlevel 1 goto :atualizar_pull_ok
call :restaurar_migracao
goto :atualizar_pull_falhou

:atualizar_pull_ok
call :limpar_migracao
del /q "%LOG_GIT%" >nul 2>nul

set "NOVO="
"%GIT%" -C "%CD%" rev-parse HEAD > "%ARQ_GIT%" 2>nul
set /p NOVO=<"%ARQ_GIT%"
set "NOVO_CURTO="
"%GIT%" -C "%CD%" rev-parse --short HEAD > "%ARQ_GIT%" 2>nul
set /p NOVO_CURTO=<"%ARQ_GIT%"
if not defined NOVO_CURTO set "NOVO_CURTO=local"

if /i "%VELHO%"=="%NOVO%" goto :atualizar_pull_atual

echo Atualizado: %VELHO_CURTO% -^> %NOVO_CURTO%
set "STATUS_VERSAO=Versao ATUALIZADA: %VELHO_CURTO% para %NOVO_CURTO%"
set "ATUALIZOU=1"

"%GIT%" -C "%CD%" diff --name-only "%VELHO%" "%NOVO%" > "%TEMP%\gs-diff.txt" 2>nul
findstr /i /c:"package.json" /c:"package-lock.json" "%TEMP%\gs-diff.txt" >nul 2>nul
if not errorlevel 1 set "INSTALAR=1"
del /q "%TEMP%\gs-diff.txt" >nul 2>nul
exit /b 0

:atualizar_pull_atual
echo Ja esta na ultima versao ^(%NOVO_CURTO%^).
set "STATUS_VERSAO=Versao ATUAL: %NOVO_CURTO% - igual ao GitHub"
exit /b 0

:atualizar_pull_falhou
echo.
echo AVISO: nao foi possivel atualizar agora.
call :diagnosticar_git
set "STATUS_VERSAO=Versao DESATUALIZADA: nao foi possivel atualizar"
set "STATUS_DETALHE=Usando a versao local %VELHO_CURTO%."
if defined MOTIVO_GIT set "STATUS_DETALHE=%STATUS_DETALHE% %MOTIVO_GIT%"
echo Abrindo a versao atual.
exit /b 0

rem ---------------------------------------------------------------------------
rem fazer_pull: tenta o pull com o token. O log fica em %LOG_GIT% para o
rem diagnosticar_git; o retorno e o errorlevel do Git.
rem ---------------------------------------------------------------------------
:fazer_pull
del /q "%LOG_GIT%" >nul 2>nul
"%GIT%" -C "%CD%" -c credential.helper= -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 pull --ff-only --quiet "%REPO%" main > "%LOG_GIT%" 2>&1
exit /b %errorlevel%

rem ---------------------------------------------------------------------------
rem migrar_nao_rastreados: .env.local e este .bat passaram a ser versionados.
rem Se uma pasta antiga tiver copias nao rastreadas, guarda em TEMP e remove
rem para o pull conseguir criar a versao do GitHub.
rem ---------------------------------------------------------------------------
:migrar_nao_rastreados
set "MIGROU="
for %%F in (".env.local" "abrir-gerenciador.bat") do (
  if exist "%%~F" (
    "%GIT%" -C "%CD%" ls-files --error-unmatch "%%~F" >nul 2>nul
    if errorlevel 1 (
      move /y "%%~F" "%TEMP%\gs-%%~nxF.antes" >nul 2>nul
      if not errorlevel 1 set "MIGROU=1"
    )
  )
)
exit /b 0

rem ---------------------------------------------------------------------------
rem restaurar_migracao: se o pull falhar depois da migracao, devolve os
rem arquivos que foram movidos para TEMP.
rem ---------------------------------------------------------------------------
:restaurar_migracao
if exist "%TEMP%\gs-.env.local.antes" if not exist ".env.local" copy /y "%TEMP%\gs-.env.local.antes" ".env.local" >nul 2>nul
if exist "%TEMP%\gs-abrir-gerenciador.bat.antes" if not exist "abrir-gerenciador.bat" copy /y "%TEMP%\gs-abrir-gerenciador.bat.antes" "abrir-gerenciador.bat" >nul 2>nul
exit /b 0

rem ---------------------------------------------------------------------------
rem limpar_migracao: remove as copias temporarias depois de um pull bem-sucedido.
rem ---------------------------------------------------------------------------
:limpar_migracao
del /q "%TEMP%\gs-.env.local.antes" >nul 2>nul
del /q "%TEMP%\gs-abrir-gerenciador.bat.antes" >nul 2>nul
exit /b 0

rem ---------------------------------------------------------------------------
rem bootstrap_repo: pasta vazia ou so com dados locais. Baixa o projeto do
rem zero, incluindo o .env.local versionado, e segue para o npm install.
rem ---------------------------------------------------------------------------
:bootstrap_repo
echo.
echo Baixando o projeto pela primeira vez...

rem Nao permite baixar na raiz do disco.
if "%CD:~1,2%"==":\" if "%CD:~3%"=="" goto :bootstrap_raiz

set "EXTRAS="
for /f "delims=" %%F in ('dir /b /a 2^>nul') do (
  set "NOME=%%F"
  call :nome_permitido
  if errorlevel 1 set "EXTRAS=1"
)

if not defined EXTRAS goto :bootstrap_baixar
echo.
echo AVISO: esta pasta ja tem outros arquivos.
echo O projeto sera copiado por cima, sem apagar esses arquivos.
choice /c SN /n /m "Baixar o projeto nesta pasta mesmo assim? [S/N] "
if errorlevel 2 goto :bootstrap_cancelado

:bootstrap_baixar
if exist ".git" rd /s /q ".git" >nul 2>nul

set "CLONE=%TEMP%\gs-clone"
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
set "GIT_TERMINAL_PROMPT=0"
del /q "%LOG_GIT%" >nul 2>nul
"%GIT%" -c credential.helper= -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 clone --depth=1 --branch main "%REPO%" "%CLONE%" > "%LOG_GIT%" 2>&1
if errorlevel 1 goto :bootstrap_falhou
if not exist "%CLONE%\package.json" goto :bootstrap_invalido
if not exist "%CLONE%\app\layout.tsx" goto :bootstrap_invalido
if not exist "%CLONE%\lib\overlay.ts" goto :bootstrap_invalido
"%GIT%" -C "%CLONE%" remote set-url origin "%REPO_PUBLICO%" >nul 2>nul
del /q "%LOG_GIT%" >nul 2>nul

echo Copiando os arquivos...
robocopy "%CLONE%" "%CD%" /E /IS /IT /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :bootstrap_falhou
if not exist "package.json" goto :bootstrap_falhou
if not exist "app\layout.tsx" goto :bootstrap_falhou
if not exist "lib\overlay.ts" goto :bootstrap_falhou
if not exist ".git\HEAD" goto :bootstrap_falhou

set "ARQ_GIT=%TEMP%\gs-git.txt"
set "NOVO_CURTO="
"%GIT%" -C "%CD%" rev-parse --short HEAD > "%ARQ_GIT%" 2>nul
set /p NOVO_CURTO=<"%ARQ_GIT%"
if not defined NOVO_CURTO set "NOVO_CURTO=local"
set "STATUS_VERSAO=Versao INSTALADA: %NOVO_CURTO% - baixada do GitHub"
set "ATUALIZOU=1"
set "INSTALAR=1"
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo.
echo Projeto baixado com sucesso.
exit /b 0

:bootstrap_cancelado
echo.
echo Nada foi alterado.
exit /b 1

:bootstrap_raiz
echo.
echo ERRO: nao baixe o projeto na raiz do disco.
echo Crie uma pasta (por exemplo, "Gerenciador") e coloque o atalho dentro dela.
pause
exit /b 1

:bootstrap_invalido
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
del /q "%LOG_GIT%" >nul 2>nul
echo.
echo ERRO: o repositorio foi baixado, mas nao parece ser o gerenciador.
echo Confira se a branch "main" tem package.json, app\layout.tsx e lib\overlay.ts.
pause
exit /b 1

:bootstrap_falhou
echo.
echo ERRO: nao consegui baixar o projeto do GitHub.
if exist "%LOG_GIT%" (
  call :diagnosticar_git
) else (
  echo Verifique a internet, o espaco em disco e as permissoes da pasta.
)
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo.
echo Corrija o motivo acima e tente de novo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem adotar_repo: pasta entregue sem .git. Faz backup, baixa o repositorio e
rem copia codigo + .git para a pasta, sem tocar nos dados locais.
rem ---------------------------------------------------------------------------
:adotar_repo
echo.
echo Preparando a atualizacao automatica nesta pasta...
if not exist "app\layout.tsx" goto :adotar_nao_e
if not exist "lib\overlay.ts" goto :adotar_nao_e

echo Fazendo backup da versao atual em .backup-antigo...
if exist ".backup-antigo" rd /s /q ".backup-antigo" >nul 2>nul
robocopy "%CD%" "%CD%\.backup-antigo" /E /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.git" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo AVISO: nao consegui fazer o backup. Nada foi alterado.
  set "STATUS_VERSAO=Versao NAO VERIFICADA: nao foi possivel preparar a atualizacao"
  set "STATUS_DETALHE=Nao consegui fazer o backup da pasta."
  exit /b 0
)

set "CLONE=%TEMP%\gs-clone"
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo Baixando a versao mais recente...
set "GIT_TERMINAL_PROMPT=0"
del /q "%LOG_GIT%" >nul 2>nul
"%GIT%" -c credential.helper= -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 clone --depth=1 --branch main "%REPO%" "%CLONE%" > "%LOG_GIT%" 2>&1
if errorlevel 1 (
  echo.
  echo AVISO: nao consegui baixar a versao nova. Abrindo a versao atual.
  call :diagnosticar_git
  set "STATUS_VERSAO=Versao DESATUALIZADA: nao foi possivel baixar a atualizacao"
  goto :adotar_falhou
)
del /q "%LOG_GIT%" >nul 2>nul
if not exist "%CLONE%\package.json" goto :adotar_invalido
if not exist "%CLONE%\app\layout.tsx" goto :adotar_invalido
"%GIT%" -C "%CLONE%" remote set-url origin "%REPO_PUBLICO%" >nul 2>nul

echo Aplicando os arquivos novos...
taskkill /FI "WINDOWTITLE eq Gerenciador Simples - Dev*" /T /F >nul 2>nul
ping -n 3 127.0.0.1 >nul

for %%D in (app components lib) do if exist "%%D" rd /s /q "%%D" >nul 2>nul
robocopy "%CLONE%" "%CD%" /E /IS /IT /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :adotar_restaurar
if not exist "package.json" goto :adotar_restaurar
if not exist "app\layout.tsx" goto :adotar_restaurar
if not exist ".git\HEAD" goto :adotar_restaurar

set "ARQ_GIT=%TEMP%\gs-git.txt"
set "NOVO_CURTO="
"%GIT%" -C "%CD%" rev-parse --short HEAD > "%ARQ_GIT%" 2>nul
set /p NOVO_CURTO=<"%ARQ_GIT%"
if not defined NOVO_CURTO set "NOVO_CURTO=local"
set "STATUS_VERSAO=Versao ATUALIZADA: %NOVO_CURTO% - pasta preparada"
set "ATUALIZOU=1"
if not exist ".backup-antigo\package.json" set "INSTALAR=1"
if exist ".backup-antigo\package.json" (
  fc /b ".backup-antigo\package.json" "package.json" >nul 2>nul
  if errorlevel 1 set "INSTALAR=1"
)
if exist ".backup-antigo\package-lock.json" (
  fc /b ".backup-antigo\package-lock.json" "package-lock.json" >nul 2>nul
  if errorlevel 1 set "INSTALAR=1"
)

:adotar_fim
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo.
echo Pasta preparada: as proximas aberturas atualizam sozinhas.
exit /b 0

:adotar_invalido
echo AVISO: o repositorio baixado nao parece valido. Abrindo a versao atual.
set "MOTIVO_GIT=Motivo: repositorio baixado nao parece valido."
set "STATUS_VERSAO=Versao DESATUALIZADA: repositorio baixado invalido"
goto :adotar_falhou

:adotar_restaurar
echo.
echo ERRO ao aplicar a atualizacao. Restaurando o backup...
if exist ".git" rd /s /q ".git" >nul 2>nul
robocopy "%CD%\.backup-antigo" "%CD%" /E /IS /IT /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo.
  echo ATENCAO: a restauracao tambem falhou.
  echo Copie os arquivos de volta manualmente de:
  echo   %CD%\.backup-antigo
  set "STATUS_VERSAO=Versao NAO VERIFICADA: falha ao atualizar e ao restaurar"
) else (
  echo Versao anterior restaurada.
  set "STATUS_VERSAO=Versao ANTERIOR restaurada apos falha na atualizacao"
)
if defined MOTIVO_GIT set "STATUS_DETALHE=%MOTIVO_GIT%"

:adotar_falhou
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
if defined MOTIVO_GIT set "STATUS_DETALHE=%MOTIVO_GIT%"
exit /b 0

:adotar_nao_e
echo AVISO: esta pasta nao parece ser o gerenciador. Nada foi alterado.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem checar_atualizacao_rodando: nao altera nada; so avisa se ha versao nova.
rem ---------------------------------------------------------------------------
:checar_atualizacao_rodando
set "VERSAO_LOCAL="
if not exist ".git" (
  echo.
  echo Esta pasta ainda nao esta preparada para atualizacao automatica.
  echo Feche com "fechar-gerenciador.bat" e abra de novo para configurar.
  set "FALHA_CHECAGEM=1"
  exit /b 0
)

set "GIT_TERMINAL_PROMPT=0"
del /q "%LOG_GIT%" >nul 2>nul
"%GIT%" -C "%CD%" -c credential.helper= -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 fetch --quiet "%REPO%" main > "%LOG_GIT%" 2>&1
if errorlevel 1 goto :checar_sem_conexao
del /q "%LOG_GIT%" >nul 2>nul

set "ARQ_GIT=%TEMP%\gs-git.txt"
set "VERSAO_LOCAL="
"%GIT%" -C "%CD%" rev-parse --short HEAD > "%ARQ_GIT%" 2>nul
set /p VERSAO_LOCAL=<"%ARQ_GIT%"
if not defined VERSAO_LOCAL set "VERSAO_LOCAL=local"

set "ATRAS="
"%GIT%" -C "%CD%" rev-list --count HEAD..FETCH_HEAD > "%ARQ_GIT%" 2>nul
set /p ATRAS=<"%ARQ_GIT%"
if not defined ATRAS (
  echo.
  echo Versao NAO VERIFICADA: nao foi possivel comparar com o GitHub.
  set "FALHA_CHECAGEM=1"
  exit /b 0
)
if "%ATRAS%"=="0" (
  echo.
  echo Versao ATUAL: %VERSAO_LOCAL% - igual ao GitHub.
  exit /b 0
)

set "REMOTO="
"%GIT%" -C "%CD%" rev-parse --short FETCH_HEAD > "%ARQ_GIT%" 2>nul
set /p REMOTO=<"%ARQ_GIT%"
echo.
echo Versao DESATUALIZADA: ha uma atualizacao disponivel ^(%REMOTO%^).
echo Feche com "fechar-gerenciador.bat" e abra de novo para atualizar.
set "TEM_ATUALIZACAO=1"
exit /b 0

:checar_sem_conexao
echo.
echo Versao NAO VERIFICADA: nao foi possivel consultar o GitHub.
call :diagnosticar_git
if defined MOTIVO_GIT echo   %MOTIVO_GIT%
set "FALHA_CHECAGEM=1"
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
