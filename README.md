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

Pré-requisito: **Node.js 22.13 ou superior** (recomendado: 24 LTS). O banco local
usa o `node:sqlite` embutido no Node, então não há dependência nativa para compilar.

```bash
npm install
npm run dev
```

Acesse `http://localhost:4000` e entre com `Theone` (ou o e-mail) e a senha
desse usuário no Supabase.

> A porta do painel é sempre **4000** (`npm run dev` já sobe com `-p 4000`),
> porque as URLs dos overlays usadas no OBS apontam para `localhost:4000`.

### Atalhos no Windows (`.bat`)

Dá para abrir e fechar o painel com duplo clique, sem usar o terminal:

- `abrir-gerenciador.bat`: confere se o Node.js está instalado, roda
  `npm install` se as dependências estiverem faltando, sobe o servidor na porta
  4000 em uma janela própria, espera responder e abre o navegador. Se o painel
  já estiver rodando na 4000, só abre o navegador (e avisa se a porta estiver
  ocupada por outro programa).
- `fechar-gerenciador.bat`: encerra o que estiver rodando na porta 4000. Se o
  processo não parecer ser o gerenciador, pede confirmação antes de matar.

> OBS/GSI/Twitch/LivePix funcionam porque o app roda no PC do Theone. Se rodar
> em outro computador, o controle do OBS e o GSI local não funcionam.

## 4. Entregar uma versão nova

Não há publicação automática nem release no GitHub: o app é entregue como
pasta/zip e roda com `npm run dev`, igual no seu computador.

### Gerar o zip

1. Feche o gerenciador (`fechar-gerenciador.bat`).
2. Atualize o `VERSAO.txt` com a versão nova (ex.: `1.1.0`).
3. Compacte a pasta do projeto **sem** `.env.local`, `overlay.db` (e
   `-shm`/`-wal`), `node_modules`, `.next`, `.git`, `.backup-antigo` e
   `public/uploads`.
4. Envie o zip por WhatsApp, Drive ou pendrive.

### Instalar no PC do cliente

1. Rode `fechar-gerenciador.bat`.
2. Substitua os arquivos da pasta do app pelos do zip, mantendo `.env.local`,
   `overlay.db` (e `-shm`/`-wal`), `node_modules` e `public/uploads`.
3. Se o `package.json` mudou, rode `npm install` dentro da pasta.
4. Abra com `abrir-gerenciador.bat`.

> Cliente novo: envie a pasta completa (sem `node_modules` e `.next`) já com o
> `.env.local` dele preenchido. Na primeira abertura o `abrir-gerenciador.bat`
> roda o `npm install` sozinho.

> Antes de substituir os arquivos, copie a pasta atual para outro lugar se
> quiser poder voltar atrás.

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
