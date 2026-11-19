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

Pré-requisitos: **Node.js 22.13 ou superior** (recomendado: 24 LTS) e **Git**.
O Git é usado pelo atalho para manter o app atualizado. O repositório é
público, então não é preciso conta no GitHub.

Em um computador novo:

```bash
git clone https://github.com/romulando/gerenciador-simples.git
cd gerenciador-simples
npm install
npm run dev
```

Copie `.env.local.example` para `.env.local` e preencha as variáveis da seção 2.
O banco local usa o `node:sqlite` embutido no Node, então não há dependência
nativa para compilar.

Acesse `http://localhost:4000` e entre com `Theone` (ou o e-mail) e a senha
desse usuário no Supabase.

> A porta do painel é sempre **4000** (`npm run dev` já sobe com `-p 4000`),
> porque as URLs dos overlays usadas no OBS apontam para `localhost:4000`.

### Atalhos no Windows (`.bat`)

Dá para abrir e fechar o painel com duplo clique, sem usar o terminal:

- `abrir-gerenciador.bat`: antes de abrir, atualiza o código com `git pull`.
  Se a pasta ainda não for um clone, transforma em clone na primeira abertura,
  preservando `.env.local`, `overlay.db`, `node_modules` e `public/uploads`.
  Se a pasta estiver vazia (só com o atalho e os dados locais), baixa o
  projeto do zero, cria o `.env.local` a partir do exemplo e abre no Notepad
  para preencher. Se o Git não estiver instalado, oferece instalar pelo
  `winget`. Se o painel já estiver rodando na 4000, avisa, mostra se há
  atualização e só abre o navegador. Se o pull falhar (sem internet,
  alterações locais ou conflito), abre a versão atual mesmo assim.
- `fechar-gerenciador.bat`: encerra o que estiver rodando na porta 4000. Se o
  processo não parecer ser o gerenciador, pede confirmação antes de matar.

### Instalar em uma pasta nova (só com o atalho)

1. Crie uma pasta vazia (ou coloque nela o `.env.local` do cliente, se já tiver).
2. Coloque `abrir-gerenciador.bat` dentro dela e execute.
3. Ele baixa o projeto do GitHub, cria o `.env.local` a partir do exemplo
   (abre no Notepad), roda `npm install` e abre o painel.

Se a pasta tiver outros arquivos, o atalho pede confirmação antes de copiar o
projeto por cima. Ele não apaga `.env.local`, `overlay.db` nem `public/uploads`.

> Se o painel já estiver rodando na porta 4000, feche com
> `fechar-gerenciador.bat` antes de abrir o atalho em uma pasta nova.

> OBS/GSI/Twitch/LivePix funcionam porque o app roda no PC do Theone. Se rodar
> em outro computador, o controle do OBS e o GSI local não funcionam.

## 4. Publicar uma versão nova

A publicação é feita direto no branch `main` do GitHub. Não há zip, release
nem token: os clientes atualizam ao abrir o atalho.

1. Faça commit e envie para o `main`:

   ```bash
   git add .
   git commit -m "sua mensagem"
   git push origin main
   ```

2. No cliente, feche o painel com `fechar-gerenciador.bat` (se estiver aberto)
   e abra `abrir-gerenciador.bat`. Ele roda `git pull`, limpa o cache do Next
   e roda `npm install` se `package.json`/`package-lock.json` mudaram.

3. Se o cliente estiver com o painel aberto, o atalho avisa que existe
   atualização; é só fechar e abrir de novo.

O que é preservado em qualquer atualização: `.env.local`, `overlay.db` (e
`-shm`/`-wal`), `public/uploads` e `node_modules`. O `.next` é limpo quando há
código novo e o Next recria na próxima abertura.

Na primeira configuração de uma pasta que ainda não é clone, é criado um backup
em `.backup-antigo`.

### Cliente novo

1. Instale **Node.js 22.13+** e **Git** (o atalho também oferece instalar o Git).
2. Crie uma pasta e coloque o `abrir-gerenciador.bat` (e o `.env.local` do
   cliente, se já tiver).
3. Execute o atalho; ele baixa o projeto, roda `npm install` e abre o painel.

### Cliente que já tem o gerenciador (uma vez)

1. Instale o Git (o atalho novo também oferece instalar pelo `winget`).
2. Substitua o `abrir-gerenciador.bat` pelo novo (basta enviar esse arquivo).
3. Abra o atalho; ele transforma a pasta em clone e atualiza o código,
   mantendo os dados locais.

> O `abrir-gerenciador.bat` novo precisa estar no `main` antes de ser enviado
> ao cliente, porque a primeira atualização baixa o que estiver no `main`.

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

> O arquivo do GSI é o mesmo usado pelo `gerenciador-pedidos`: o último painel que
> instalar é o que recebe os dados do Dota 2. Para os pedidos do Theone, instale
> pelo Simples. Com o painel/aba de Acompanhamento aberto, as partidas são
> registradas automaticamente no pedido (fila local + sincronização autenticada).

## 7. Teste da API de recálculo

Com o site rodando:

```bash
node scripts/test-recalculo.mjs --pedido 32 --url http://localhost:4000
```

O teste exige que o pedido `73BV-U7F7-GHBK` retorne `mmr_final_calculado = 3866`.
