// Integração com a API do LivePix: credenciais do app, token via
// client_credentials e total arrecadado no mês para a barra de progresso da
// overlay. O Client Secret, o token e o cache ficam no banco local (SQLite sem
// criptografia, como o restante do projeto) e nunca são devolvidos pelas APIs
// do painel.
import type { DatabaseSync } from 'node:sqlite';
import { getConfigValor, setConfigValor } from './config';
import type { LivepixStatusOverlay } from '../components/stream-overlay/common';

const CHAVE_CLIENT_ID = 'overlay_livepix_client_id';
const CHAVE_CLIENT_SECRET = 'overlay_livepix_client_secret';
const CHAVE_ACCESS_TOKEN = 'overlay_livepix_access_token';
const CHAVE_TOKEN_EXPIRA = 'overlay_livepix_token_expira';
const CHAVE_LOGIN = 'overlay_livepix_login';
const CHAVE_ERRO = 'overlay_livepix_erro';
const CHAVE_CACHE_TOTAL = 'overlay_livepix_cache_total';
const CHAVE_ESCOPOS = 'overlay_livepix_escopos';

const ESCOPOS = 'account:read payments:read messages:read';
const URL_TOKEN = 'https://oauth.livepix.gg/oauth2/token';
const URL_API = 'https://api.livepix.gg/v2';

// A overlay faz poll a cada ~2,5s; as doações são consultadas no máximo 1x a
// cada 5s. As doações com mensagem ficam em `/messages` (fonte principal na
// LivePix) e os PIX sem mensagem em `/payments`.
export const LIVEPIX_CACHE_MS = 5_000;
// Em erro/401/429 espera mais antes de tentar de novo: evita emitir tokens e
// bater na API repetidamente enquanto o problema não é resolvido.
export const LIVEPIX_ERRO_CACHE_MS = 60_000;
const TIMEOUT_MS = 10_000;
// Teto de páginas da listagem de doações (100 por página) para não varrer o
// histórico inteiro caso a lista não venha da mais recente para a mais antiga.
const LIMITE_PAGINAS = 20;

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export function nomeMesAtual(): string {
  return MESES[new Date().getMonth()] ?? '';
}

function formatarReais(valor: number): string {
  return `R$${valor.toFixed(2).replace('.', ',')}`;
}

async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

function texto(db: DatabaseSync, chave: string): string {
  return (getConfigValor(db, chave) ?? '').trim();
}

export function getLivepixClientId(db: DatabaseSync): string {
  return texto(db, CHAVE_CLIENT_ID);
}

function getLivepixClientSecret(db: DatabaseSync): string {
  return texto(db, CHAVE_CLIENT_SECRET);
}

function definirErro(db: DatabaseSync, mensagem: string): void {
  setConfigValor(db, CHAVE_ERRO, mensagem.slice(0, 300));
}

export function getLivepixStatus(db: DatabaseSync): LivepixStatusOverlay {
  const clientId = getLivepixClientId(db);
  return {
    clientId,
    clientIdDefinido: clientId !== '',
    secretDefinido: getLivepixClientSecret(db) !== '',
    conectado:
      clientId !== '' &&
      getLivepixClientSecret(db) !== '' &&
      texto(db, CHAVE_ACCESS_TOKEN) !== '',
    login: texto(db, CHAVE_LOGIN) || null,
    erro: texto(db, CHAVE_ERRO) || null,
  };
}

// Salva o Client ID/Secret do app criado no painel da LivePix. Secret vazio
// mantém o que já estava salvo. Trocar o Client ID invalida o token antigo.
export function setLivepixCredenciais(
  db: DatabaseSync,
  clientId: unknown,
  clientSecret: unknown
): LivepixStatusOverlay {
  const idNovo = String(clientId ?? '').trim().slice(0, 128);
  const segredoNovo = String(clientSecret ?? '').trim().slice(0, 256);
  const idAtual = getLivepixClientId(db);
  if (idNovo !== '' && idNovo !== idAtual) {
    limparTokensLivepix(db);
  }
  if (idNovo !== '') setConfigValor(db, CHAVE_CLIENT_ID, idNovo);
  if (segredoNovo !== '') setConfigValor(db, CHAVE_CLIENT_SECRET, segredoNovo);
  return getLivepixStatus(db);
}

export function limparTokensLivepix(db: DatabaseSync): void {
  for (const chave of [
    CHAVE_ACCESS_TOKEN,
    CHAVE_TOKEN_EXPIRA,
    CHAVE_LOGIN,
    CHAVE_ERRO,
    CHAVE_CACHE_TOTAL,
    CHAVE_ESCOPOS,
  ]) {
    setConfigValor(db, chave, '');
  }
}

// Token de acesso via client_credentials, reaproveitado até perto de expirar.
async function obterTokenLivepix(db: DatabaseSync): Promise<string | null> {
  const clientId = getLivepixClientId(db);
  const clientSecret = getLivepixClientSecret(db);
  if (!clientId || !clientSecret) return null;

  const token = texto(db, CHAVE_ACCESS_TOKEN);
  const expira = Number(getConfigValor(db, CHAVE_TOKEN_EXPIRA));
  // Token emitido com escopos antigos (sem messages:read) não serve para ler as
  // doações: descarta e autentica de novo.
  const escoposAtuais = texto(db, CHAVE_ESCOPOS);
  if (
    token &&
    escoposAtuais === ESCOPOS &&
    Number.isFinite(expira) &&
    Date.now() < expira - 60_000
  ) {
    return token;
  }

  try {
    const res = await fetchComTimeout(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: ESCOPOS,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      message?: string;
      error?: string;
    };
    if (!res.ok || !json.access_token) {
      definirErro(
        db,
        json.message || json.error || `Não foi possível autenticar na LivePix (HTTP ${res.status}).`
      );
      return null;
    }
    setConfigValor(db, CHAVE_ACCESS_TOKEN, json.access_token);
    setConfigValor(db, CHAVE_ESCOPOS, ESCOPOS);
    const expiraEm = Date.now() + (Number(json.expires_in) || 3600) * 1000;
    setConfigValor(db, CHAVE_TOKEN_EXPIRA, String(expiraEm));
    return json.access_token;
  } catch {
    definirErro(db, 'Falha de rede ao autenticar na LivePix.');
    return null;
  }
}

// Testa as credenciais consultando a conta autenticada (usado ao salvar).
export async function testarConexaoLivepix(
  db: DatabaseSync
): Promise<{ ok: boolean; mensagem: string }> {
  if (!getLivepixClientId(db) || !getLivepixClientSecret(db)) {
    return { ok: false, mensagem: 'Salve o Client ID e o Client Secret antes de testar.' };
  }
  const token = await obterTokenLivepix(db);
  if (!token) {
    return { ok: false, mensagem: texto(db, CHAVE_ERRO) || 'Não foi possível autenticar na LivePix.' };
  }
  try {
    const res = await fetchComTimeout(`${URL_API}/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { username?: string; displayName?: string };
      message?: string;
    };
    if (!res.ok) {
      const msg = json.message || `Não foi possível ler a conta (HTTP ${res.status}).`;
      definirErro(db, msg);
      return { ok: false, mensagem: msg };
    }
    const nome = String(json.data?.displayName || json.data?.username || '');
    setConfigValor(db, CHAVE_LOGIN, nome.slice(0, 120));
    definirErro(db, '');
    // Já valida a leitura das doações do mês (mensagens + pagamentos), para o
    // teste confirmar que a barra vai receber os valores.
    setConfigValor(db, CHAVE_CACHE_TOTAL, '');
    const total = await obterTotalMesLivepix(db);
    const conectado = `Conectado${nome ? ` como ${nome}` : ''}`;
    if (total.erro || total.total == null) {
      return { ok: true, mensagem: `${conectado}, mas não foi possível ler as doações agora.` };
    }
    return {
      ok: true,
      mensagem: `${conectado} — ${formatarReais(total.total)} em ${nomeMesAtual().toLowerCase()}.`,
    };
  } catch {
    definirErro(db, 'Falha de rede ao consultar a conta na LivePix.');
    return { ok: false, mensagem: 'Falha de rede ao consultar a conta na LivePix.' };
  }
}

interface CacheTotal {
  totalCentavos: number | null;
  tentadoEm: number;
  erro: boolean;
}

function lerCache(db: DatabaseSync): CacheTotal | null {
  const bruto = getConfigValor(db, CHAVE_CACHE_TOTAL);
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Partial<CacheTotal>;
    if (typeof c.tentadoEm !== 'number') return null;
    return {
      totalCentavos: typeof c.totalCentavos === 'number' ? c.totalCentavos : null,
      tentadoEm: c.tentadoEm,
      erro: Boolean(c.erro),
    };
  } catch {
    return null;
  }
}

function gravarCache(db: DatabaseSync, totalCentavos: number | null, erro: boolean): void {
  setConfigValor(
    db,
    CHAVE_CACHE_TOTAL,
    JSON.stringify({ totalCentavos, tentadoEm: Date.now(), erro } satisfies CacheTotal)
  );
}

interface ItemDoacaoLivepix {
  id?: string;
  proof?: string;
  reference?: string;
  amount?: number | string;
  currency?: string;
  createdAt?: string;
}

// As doações com mensagem chegam em `/messages` (fonte principal na LivePix);
// `/payments` cobre PIX sem mensagem. Os dois são somados no mês.
const RECURSOS_LIVEPIX = ['messages', 'payments'] as const;
type RecursoLivepix = (typeof RECURSOS_LIVEPIX)[number];

interface RespostaPaginaLivepix {
  itens: ItemDoacaoLivepix[];
  erro: string | null;
  // true quando a falha foi de autenticação (permite renovar o token e tentar 1x)
  auth: boolean;
}

// Busca uma página de doações recebidas. Em 401/403 sinaliza `auth` para o
// chamador renovar o token; em 429/erro de rede devolve a mensagem para manter
// o último total conhecido.
async function buscarPaginaLivepix(
  token: string,
  recurso: RecursoLivepix,
  page: number
): Promise<RespostaPaginaLivepix> {
  try {
    const params = new URLSearchParams({ currency: 'BRL', limit: '100', page: String(page) });
    const res = await fetchComTimeout(`${URL_API}/${recurso}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        itens: [],
        erro: `Não foi possível autenticar na LivePix (HTTP ${res.status}).`,
        auth: true,
      };
    }
    const json = (await res.json().catch(() => ({}))) as {
      data?: ItemDoacaoLivepix[];
      message?: string;
    };
    if (!res.ok) {
      return {
        itens: [],
        erro: json.message || `Não foi possível ler as doações (HTTP ${res.status}).`,
        auth: false,
      };
    }
    return { itens: Array.isArray(json.data) ? json.data : [], erro: null, auth: false };
  } catch {
    return { itens: [], erro: 'Falha de rede ao consultar as doações.', auth: false };
  }
}

// Percorre as páginas de um recurso guardando só as doações do mês corrente. A
// lista vem da mais recente para a mais antiga; a varredura para quando a
// página inteira é anterior ao mês (ou no teto de páginas).
async function buscarMesLivepix(
  token: string,
  recurso: RecursoLivepix,
  inicioMes: Date
): Promise<RespostaPaginaLivepix> {
  const itens: ItemDoacaoLivepix[] = [];
  for (let page = 1; page <= LIMITE_PAGINAS; page++) {
    const pagina = await buscarPaginaLivepix(token, recurso, page);
    if (pagina.erro) return { itens: [], erro: pagina.erro, auth: pagina.auth };
    if (pagina.itens.length === 0) break;

    let maisNovo: Date | null = null;
    for (const item of pagina.itens) {
      const quando = new Date(String(item.createdAt ?? ''));
      if (Number.isNaN(quando.getTime())) continue;
      if (maisNovo == null || quando > maisNovo) maisNovo = quando;
      if (quando < inicioMes) continue;
      itens.push(item);
    }
    if (maisNovo == null || maisNovo < inicioMes) break;
  }
  return { itens, erro: null, auth: false };
}

interface ResultadoTotalLivepix {
  totalCentavos: number;
  erro: string | null;
  auth: boolean;
}

// Soma as doações do mês dos dois recursos. Deduplica por `proof`/`id` porque a
// mesma doação pode aparecer em mais de uma listagem.
async function somarMesLivepix(
  token: string,
  inicioMes: Date
): Promise<ResultadoTotalLivepix> {
  const vistos = new Set<string>();
  let totalCentavos = 0;
  for (const recurso of RECURSOS_LIVEPIX) {
    const { itens, erro, auth } = await buscarMesLivepix(token, recurso, inicioMes);
    if (erro) return { totalCentavos: 0, erro, auth };
    for (const item of itens) {
      const chave = String(item.proof ?? '').trim() || String(item.id ?? '').trim();
      if (chave) {
        if (vistos.has(chave)) continue;
        vistos.add(chave);
      }
      const centavos = Math.round(Number(item.amount));
      if (Number.isFinite(centavos) && centavos > 0) totalCentavos += centavos;
    }
  }
  return { totalCentavos, erro: null, auth: false };
}

// Início do mês corrente no fuso local do servidor: o total zera sozinho na
// virada do mês, junto com a meta.
function inicioDoMes(): Date {
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

// Total arrecadado (em reais) do mês corrente, com cache curto. Em cache
// vencido devolve o último valor conhecido e atualiza em segundo plano
// (stale-while-revalidate), para o payload da overlay não ficar preso atrás da
// API do LivePix. Em erro mantém o último valor conhecido e sinaliza `erro`
// (a barra aparece atenuada); o cache de erro é mais longo para não insistir
// na API. Sem nenhum cache ainda, espera a primeira resposta.
let emAndamento: Promise<{ total: number | null; erro: boolean }> | null = null;

function iniciarAtualizacaoTotal(
  db: DatabaseSync,
  cache: CacheTotal | null
): Promise<{ total: number | null; erro: boolean }> {
  if (emAndamento) return emAndamento;
  const p = buscarTotalRemoto(db, cache);
  emAndamento = p;
  const limpar = () => {
    if (emAndamento === p) emAndamento = null;
  };
  // buscarTotalRemoto já trata os erros; o then evita rejeição não tratada.
  void p.then(limpar, limpar);
  return p;
}

export async function obterTotalMesLivepix(
  db: DatabaseSync
): Promise<{ total: number | null; erro: boolean }> {
  const cache = lerCache(db);
  if (cache) {
    const ttl = cache.erro ? LIVEPIX_ERRO_CACHE_MS : LIVEPIX_CACHE_MS;
    if (Date.now() - cache.tentadoEm < ttl) {
      return { total: emReais(cache.totalCentavos), erro: cache.erro };
    }
    void iniciarAtualizacaoTotal(db, cache);
    return { total: emReais(cache.totalCentavos), erro: cache.erro };
  }
  return iniciarAtualizacaoTotal(db, cache);
}

function emReais(centavos: number | null): number | null {
  return centavos == null ? null : centavos / 100;
}

async function buscarTotalRemoto(
  db: DatabaseSync,
  cache: CacheTotal | null
): Promise<{ total: number | null; erro: boolean }> {
  const token = await obterTokenLivepix(db);
  if (!token) {
    gravarCache(db, cache?.totalCentavos ?? null, true);
    return { total: emReais(cache?.totalCentavos ?? null), erro: true };
  }

  const inicioMes = inicioDoMes();
  let resultado = await somarMesLivepix(token, inicioMes);

  // Token expirado/invalidado entre a leitura e a chamada: renova e repete 1x.
  if (resultado.auth) {
    setConfigValor(db, CHAVE_ACCESS_TOKEN, '');
    setConfigValor(db, CHAVE_TOKEN_EXPIRA, '');
    const renovado = await obterTokenLivepix(db);
    if (renovado) resultado = await somarMesLivepix(renovado, inicioMes);
  }

  if (resultado.erro) {
    definirErro(db, resultado.erro);
    gravarCache(db, cache?.totalCentavos ?? null, true);
    return { total: emReais(cache?.totalCentavos ?? null), erro: true };
  }

  definirErro(db, '');
  gravarCache(db, resultado.totalCentavos, false);
  return { total: resultado.totalCentavos / 100, erro: false };
}
