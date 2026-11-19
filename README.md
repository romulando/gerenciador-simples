# Gerenciador Simples — Theone

Painel local do booster Theone. Os dados de pedidos/registros/tracking ficam no
Supabase; a configuração do overlay, GSI, Twitch, LivePix e as partidas locais
ficam em `overlay.db` (SQLite).

## 1. Supabase

1. Rode `supabase/schema.sql` no SQL Editor do Supabase.
2. Em **Authentication > Providers**, ative o provedor **Email**.
3. Confirme que o usuário `theone@boostmmr.com.br` existe e está com e-mail
   confirmado (a senha fica só no seu gerenciador de senhas).

## 2. Variáveis

Copie `.env.local.example` para `.env.local` e preencha:

```env
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
THEONE_LOGIN=Theone
THEONE_EMAIL=theone@boostmmr.com.br
SITE_API_URL=https://boostmmr.com.br
THEONE_API_SECRET=...
```

O mesmo `THEONE_API_SECRET` precisa existir no `.env.local` do site
(`Boost-MMR-NextJS/boost`).

## 3. Instalar e rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:4000` e entre com `Theone` (ou o e-mail) e a senha
desse usuário no Supabase.

> A porta do painel é sempre **4000** (`npm run dev` já sobe com `-p 4000`),
> porque as URLs dos overlays usadas no OBS apontam para `localhost:4000`.

### Atalhos no Windows (`.bat`)

Dá para abrir, fechar e atualizar o painel com duplo clique, sem usar o terminal:

- `abrir-gerenciador.bat`: confere se o Node.js está instalado, procura uma
  versão nova publicada, roda `npm install` se as dependências estiverem
  faltando, sobe o servidor na porta 4000 em uma janela própria, espera
  responder e abre o navegador. Se o painel já estiver rodando na 4000, só abre
  o navegador (e avisa se a porta estiver ocupada por outro programa).
- `fechar-gerenciador.bat`: encerra o que estiver rodando na porta 4000. Se o
  processo não parecer ser o gerenciador, pede confirmação antes de matar.
- `atualizar-gerenciador.bat`: baixa e instala a última versão publicada no
  GitHub. Não precisa de conta no GitHub nem do `git` instalado.

> OBS/GSI/Twitch/LivePix funcionam porque o app roda no PC do Theone. Se rodar
> em outro computador, o controle do OBS e o GSI local não funcionam.

## 4. Atualizar o app de quem usa

O repositório é **privado**. O download das atualizações usa um token de
leitura que viaja dentro do pacote (`token.dat`), então o cliente não precisa de
conta no GitHub nem do `git` instalado.

### Uma vez só: criar o token

1. GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. *Repository access*: **Only select repositories** → `gerenciador-simples`.
3. *Repository permissions* → **Contents: Read-only** (nada além disso).
4. Cole o token no arquivo `token.txt` na raiz do projeto.

O `token.txt` está no `.gitignore`: ele não entra no repositório nem no
histórico. Só o zip publicado carrega uma cópia, como `token.dat`.

### A cada versão

1. Rode `publicar-versao.bat` e informe a versão nova (ex.: `1.0.1`).
2. Ele grava o `VERSAO.txt`, comita, faz push, cria a tag `v1.0.1`, monta o zip
   só com arquivos versionados, injeta o `token.dat`, publica a release e deixa
   uma cópia em `dist\gerenciador-1.0.1.zip`.
3. Cliente com o app fechado: ao abrir o `abrir-gerenciador.bat`, ele consulta a
   última release e pergunta *"Atualização disponível. Atualizar agora?
   [S/N]"*. Se aceitar, o `atualizar-gerenciador.bat` para o servidor, faz
   backup em `.backup-antigo`, copia os arquivos novos, roda `npm install` só se
   o `package.json` mudou e abre o app de novo.

### Cliente novo (ou primeira migração)

Envie o zip de `dist\` (pendrive, WhatsApp, Drive). É ele que traz o
`token.dat`; sem esse arquivo o app não consegue verificar atualizações e avisa
isso.

O que a atualização **nunca** toca: `.env.local`, `token.dat`, `overlay.db` (e
`-shm`/`-wal`), `node_modules`, `.next` e `public/uploads`. O `.backup-antigo`
é a versão anterior completa, para voltar atrás — pode apagar quando quiser.

> A versão publicada é a do commit da tag, não o que está no seu computador. Se
> você misturar trabalho pela metade, ele não vai para o cliente: só vai para
> frente quando você rodar o `publicar-versao.bat`.

> Se o token vazar: revogue em GitHub → Settings → Developer settings, crie
> outro, coloque no `token.txt` e publique uma versão nova. As instalações
> antigas param de atualizar e precisam receber um zip novo.

## 5. Importar os pedidos do Theone

No `gerenciador-pedidos`:

```bash
npm run sync-orders-theone -- --dry-run
npm run sync-orders-theone
```

O script importa pedidos/registros e remove os pedidos do Theone do
`web_tracking` normal (para o site usar o `web_tracking_theone`).

## 6. Stream Overlay

Em `/stream-overlay`:

1. Selecione o pedido no painel.
2. Copie a URL e adicione no OBS como Browser Source 1920×1080.
3. Use o card **GSI do Dota 2** para instalar o `.cfg` na pasta do Dota.
4. Configure OBS/Twitch/LivePix nos cards correspondentes.

## 7. Teste da API de recálculo

Com o site rodando:

```bash
node scripts/test-recalculo.mjs --pedido 32 --url http://localhost:4000
```

O teste exige que o pedido `73BV-U7F7-GHBK` retorne `mmr_final_calculado = 3866`.
