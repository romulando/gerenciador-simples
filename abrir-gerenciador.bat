@echo off
setlocal EnableExtensions
title Gerenciador Simples - Theone

rem ===========================================================================
rem  Abre o Gerenciador Simples.
rem
rem  Antes de abrir, atualiza o codigo pelo Git:
rem    - se a pasta ja e um clone (tem .git), roda "git pull --ff-only";
rem    - se ainda nao e clone, baixa o repositorio e transforma a pasta em
rem      clone, preservando .env.local, overlay.db, node_modules e uploads;
rem    - se a pasta estiver vazia (so com este .bat e os dados locais), baixa
rem      o projeto do zero e cria o .env.local a partir do exemplo.
rem
rem  O repositorio e publico: nao precisa de conta no GitHub.
rem  Se o Git nao estiver instalado, o script oferece instalar pelo winget.
rem
rem  Este .bat roda a partir de uma copia em TEMP porque a atualizacao pode
rem  substituir o proprio arquivo enquanto ele esta em execucao.
rem ===========================================================================

if /i "%~1"=="/dentro" goto :corpo

set "PASTA=%~dp0"
if "%PASTA:~-1%"=="\" set "PASTA=%PASTA:~0,-1%"
set "SEM_ATUALIZACAO="
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
set "REPO=https://github.com/romulando/gerenciador-simples.git"
set "GIT="
set "ATUALIZOU="
set "INSTALAR="

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
echo Sem o Git, o gerenciador abre normalmente, mas nao sera atualizado sozinho.
echo Instale em https://git-scm.com/download/win e abra este atalho de novo.
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

:ja_rodando
echo.
echo JA EXISTE UM SERVIDOR RODANDO NA PORTA %PORTA%.
if defined GIT call :checar_atualizacao_rodando
echo.
echo Abrindo o navegador...
start "" "%URL%"
echo Esta janela fecha em alguns segundos.
ping -n 5 127.0.0.1 >nul
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
echo Se ela estava vazia, o download do GitHub falhou; verifique a internet.
pause
goto :fim

:fim
endlocal
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
if defined SEM_ATUALIZACAO exit /b 0
if not defined GIT exit /b 0
if exist ".git" if exist "package.json" goto :atualizar_pull
if exist "package.json" goto :adotar_repo
goto :bootstrap_repo

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

set "GIT_TERMINAL_PROMPT=0"
"%GIT%" -C "%CD%" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 pull --ff-only --quiet >nul 2>nul
if errorlevel 1 (
  echo.
  echo AVISO: nao foi possivel atualizar agora ^(sem internet, alteracoes locais ou conflito^).
  echo Abrindo a versao atual.
  exit /b 0
)

set "NOVO="
"%GIT%" -C "%CD%" rev-parse HEAD > "%ARQ_GIT%" 2>nul
set /p NOVO=<"%ARQ_GIT%"
set "NOVO_CURTO="
"%GIT%" -C "%CD%" rev-parse --short HEAD > "%ARQ_GIT%" 2>nul
set /p NOVO_CURTO=<"%ARQ_GIT%"

if /i "%VELHO%"=="%NOVO%" (
  echo Ja esta na ultima versao ^(%NOVO_CURTO%^).
  exit /b 0
)

echo Atualizado: %VELHO_CURTO% -^> %NOVO_CURTO%
set "ATUALIZOU=1"

"%GIT%" -C "%CD%" diff --name-only "%VELHO%" "%NOVO%" > "%TEMP%\gs-diff.txt" 2>nul
findstr /i /c:"package.json" /c:"package-lock.json" "%TEMP%\gs-diff.txt" >nul 2>nul
if not errorlevel 1 set "INSTALAR=1"
del /q "%TEMP%\gs-diff.txt" >nul 2>nul
exit /b 0

rem ---------------------------------------------------------------------------
rem bootstrap_repo: pasta vazia ou so com dados locais. Baixa o projeto do
rem zero, cria o .env.local a partir do exemplo e segue para o npm install.
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
"%GIT%" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 clone --depth=1 --branch main "%REPO%" "%CLONE%" >nul 2>nul
if errorlevel 1 goto :bootstrap_falhou
if not exist "%CLONE%\package.json" goto :bootstrap_falhou
if not exist "%CLONE%\app\layout.tsx" goto :bootstrap_falhou
if not exist "%CLONE%\lib\overlay.ts" goto :bootstrap_falhou

echo Copiando os arquivos...
robocopy "%CLONE%" "%CD%" /E /IS /IT /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF .env.local token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :bootstrap_falhou
if not exist "package.json" goto :bootstrap_falhou
if not exist "app\layout.tsx" goto :bootstrap_falhou
if not exist "lib\overlay.ts" goto :bootstrap_falhou
if not exist ".git\HEAD" goto :bootstrap_falhou

set "ATUALIZOU=1"
set "INSTALAR=1"
call :bootstrap_env
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo.
echo Projeto baixado com sucesso.
exit /b 0

:bootstrap_env
if exist ".env.local" exit /b 0
if not exist ".env.local.example" exit /b 0
copy /y ".env.local.example" ".env.local" >nul 2>nul
echo.
echo O arquivo .env.local foi criado a partir do exemplo.
echo Preencha as variaveis do Supabase e salve.
echo O Notepad vai abrir agora; feche-o para continuar.
notepad ".env.local"
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

:bootstrap_falhou
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo.
echo ERRO: nao consegui baixar o projeto do GitHub.
echo Verifique a internet e tente de novo.
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
robocopy "%CD%" "%CD%\.backup-antigo" /E /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.git" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF .env.local token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo AVISO: nao consegui fazer o backup. Nada foi alterado.
  exit /b 0
)

set "CLONE=%TEMP%\gs-clone"
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
echo Baixando a versao mais recente...
set "GIT_TERMINAL_PROMPT=0"
"%GIT%" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 clone --depth=1 --branch main "%REPO%" "%CLONE%" >nul 2>nul
if errorlevel 1 (
  echo AVISO: nao consegui baixar a versao nova. Abrindo a versao atual.
  goto :adotar_falhou
)
if not exist "%CLONE%\package.json" goto :adotar_invalido
if not exist "%CLONE%\app\layout.tsx" goto :adotar_invalido

echo Aplicando os arquivos novos...
taskkill /FI "WINDOWTITLE eq Gerenciador Simples - Dev*" /T /F >nul 2>nul
ping -n 3 127.0.0.1 >nul

for %%D in (app components lib) do if exist "%%D" rd /s /q "%%D" >nul 2>nul
robocopy "%CLONE%" "%CD%" /E /IS /IT /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF .env.local token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :adotar_restaurar
if not exist "package.json" goto :adotar_restaurar
if not exist "app\layout.tsx" goto :adotar_restaurar
if not exist ".git\HEAD" goto :adotar_restaurar

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
goto :adotar_falhou

:adotar_restaurar
echo.
echo ERRO ao aplicar a atualizacao. Restaurando o backup...
if exist ".git" rd /s /q ".git" >nul 2>nul
robocopy "%CD%\.backup-antigo" "%CD%" /E /IS /IT /XD "%CD%\node_modules" "%CD%\.next" "%CD%\.backup-antigo" "%CD%\public\uploads" /XF .env.local token.dat overlay.db overlay.db-shm overlay.db-wal /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo.
  echo ATENCAO: a restauracao tambem falhou.
  echo Copie os arquivos de volta manualmente de:
  echo   %CD%\.backup-antigo
) else (
  echo Versao anterior restaurada.
)

:adotar_falhou
if exist "%CLONE%" rd /s /q "%CLONE%" >nul 2>nul
exit /b 0

:adotar_nao_e
echo AVISO: esta pasta nao parece ser o gerenciador. Nada foi alterado.
exit /b 1

rem ---------------------------------------------------------------------------
rem checar_atualizacao_rodando: nao altera nada; so avisa se ha versao nova.
rem ---------------------------------------------------------------------------
:checar_atualizacao_rodando
if not exist ".git" (
  echo Esta pasta ainda nao esta preparada para atualizacao automatica.
  echo Feche com "fechar-gerenciador.bat" e abra de novo para configurar.
  exit /b 0
)

set "GIT_TERMINAL_PROMPT=0"
"%GIT%" -C "%CD%" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 fetch --quiet origin >nul 2>nul
if errorlevel 1 exit /b 0

set "ARQ_GIT=%TEMP%\gs-git.txt"
set "ATRAS="
"%GIT%" -C "%CD%" rev-list --count HEAD..origin/main > "%ARQ_GIT%" 2>nul
set /p ATRAS=<"%ARQ_GIT%"
if not defined ATRAS exit /b 0
if "%ATRAS%"=="0" (
  echo Voce ja esta na ultima versao.
  exit /b 0
)

set "REMOTO="
"%GIT%" -C "%CD%" rev-parse --short origin/main > "%ARQ_GIT%" 2>nul
set /p REMOTO=<"%ARQ_GIT%"
echo Ha uma atualizacao disponivel ^(%REMOTO%^).
echo Feche com "fechar-gerenciador.bat" e abra de novo para atualizar.
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
