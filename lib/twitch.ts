// Integração com a Twitch (OAuth do canal): credenciais do app, tokens do
// broadcaster e contagem de subs para a overlay. O secret e os tokens ficam
// no banco local (SQLite sem criptografia, como o restante do projeto) e
// nunca são devolvidos pelas APIs do painel.
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getConfigValor, setConfigValor } from './config';
import type { TwitchStatusOverlay } from '../components/stream-overlay/common';

const CHAVE_CLIENT_ID = 'overlay_twitch_client_id';
const CHAVE_CLIENT_SECRET = 'overlay_twitch_client_secret';
const CHAVE_ACCESS_TOKEN = 'overlay_twitch_access_token';
const CHAVE_REFRESH_TOKEN = 'overlay_twitch_refresh_token';
const CHAVE_USER_ID = 'overlay_twitch_user_id';
const CHAVE_LOGIN = 'overlay_twitch_login';
const CHAVE_ERRO = 'overlay_twitch_erro';
const CHAVE_CACHE_SUBS = 'overlay_twitch_subs_cache';

const ESCOPO_SUBS = 'channel:read:subscriptions';
const URL_AUTORIZACAO = 'https://id.twitch.tv/oauth2/authorize';
const URL_TOKEN = 'https://id.twitch.tv/oauth2/token';
const URL_HELIX = 'https://api.twitch.tv/helix';

// A overlay faz poll a cada ~2,5s; a Twitch é consultada no máximo 1x a cada
// 5s (12 req/min, muito abaixo dos 800 pontos/min por client ID/usuário).
export const TWITCH_SUBS_CACHE_MS = 5_000;
// Em erro/renovação falha espera mais antes de tentar de novo.
export const TWITCH_SUBS_ERRO_CACHE_MS = 60_000;
const TIMEOUT_MS = 10_000;

async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

function texto(db: Database.Database, chave: string): string {
  return (getConfigValor(db, chave) ?? '').trim();
}

export function getTwitchClientId(db: Database.Database): string {
  return texto(db, CHAVE_CLIENT_ID);
}

function getTwitchClientSecret(db: Database.Database): string {
  return texto(db, CHAVE_CLIENT_SECRET);
}

export function getTwitchStatus(db: Database.Database): TwitchStatusOverlay {
  const clientId = getTwitchClientId(db);
  return {
    clientId,
    clientIdDefinido: clientId !== '',
    secretDefinido: getTwitchClientSecret(db) !== '',
    conectado: texto(db, CHAVE_ACCESS_TOKEN) !== '' || texto(db, CHAVE_REFRESH_TOKEN) !== '',
    login: texto(db, CHAVE_LOGIN) || null,
    erro: texto(db, CHAVE_ERRO) || null,
  };
}

// Salva o Client ID/Secret do app criado em dev.twitch.tv. Secret vazio
// mantém o que já estava salvo (permite editar só o Client ID). Trocar o
// Client ID invalida os tokens antigos (são de outro app).
export function setTwitchCredenciais(
  db: Database.Database,
  clientId: unknown,
  clientSecret: unknown
): TwitchStatusOverlay {
  const idNovo = String(clientId ?? '').trim().slice(0, 128);
  const segredoNovo = String(clientSecret ?? '').trim().slice(0, 256);
  const idAtual = getTwitchClientId(db);
  if (idNovo !== '' && idNovo !== idAtual) {
    limparTokens(db);
  }
  if (idNovo !== '') setConfigValor(db, CHAVE_CLIENT_ID, idNovo);
  if (segredoNovo !== '') setConfigValor(db, CHAVE_CLIENT_SECRET, segredoNovo);
  return getTwitchStatus(db);
}

export function limparTokens(db: Database.Database): void {
  for (const chave of [
    CHAVE_ACCESS_TOKEN,
    CHAVE_REFRESH_TOKEN,
    CHAVE_USER_ID,
    CHAVE_LOGIN,
    CHAVE_ERRO,
    CHAVE_CACHE_SUBS,
  ]) {
    setConfigValor(db, chave, '');
  }
}

function definirErro(db: Database.Database, mensagem: string): void {
  setConfigValor(db, CHAVE_ERRO, mensagem.slice(0, 300));
}

// URL de consentimento + state anti-CSRF (o cookie do state é gravado na rota).
export function montarUrlAutorizacao(
  db: Database.Database,
  redirectUri: string
): { url: string; state: string } | null {
  const clientId = getTwitchClientId(db);
  if (!clientId) return null;
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPO_SUBS,
    state,
  });
  return { url: `${URL_AUTORIZACAO}?${params.toString()}`, state };
}

interface RespostaTokenTwitch {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  message?: string;
}

// Troca o `code` do callback por tokens e identifica o canal conectado.
export async function concluirAutorizacao(
  db: Database.Database,
  code: string,
  redirectUri: string
): Promise<{ ok: boolean; mensagem: string }> {
  const clientId = getTwitchClientId(db);
  const clientSecret = getTwitchClientSecret(db);
  if (!clientId || !clientSecret) {
    return { ok: false, mensagem: 'Salve o Client ID e o Client Secret antes de conectar.' };
  }

  let tokens: RespostaTokenTwitch;
  try {
    const res = await fetchComTimeout(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as RespostaTokenTwitch;
    if (!res.ok || !json.access_token) {
      return { ok: false, mensagem: json.message || `Falha ao trocar o código (HTTP ${res.status}).` };
    }
    tokens = json;
  } catch {
    return { ok: false, mensagem: 'Não foi possível falar com a Twitch. Verifique a internet.' };
  }

  setConfigValor(db, CHAVE_ACCESS_TOKEN, tokens.access_token ?? '');
  if (tokens.refresh_token) setConfigValor(db, CHAVE_REFRESH_TOKEN, tokens.refresh_token);

  // Identifica o canal autenticado (id + login) para o helix/subscriptions.
  try {
    const res = await fetchComTimeout(`${URL_HELIX}/users`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Client-Id': clientId,
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { id?: string; login?: string; display_name?: string }[];
    };
    const usuario = json.data?.[0];
    if (!res.ok || !usuario?.id) {
      return { ok: false, mensagem: 'Tokens salvos, mas não foi possível identificar o canal.' };
    }
    setConfigValor(db, CHAVE_USER_ID, usuario.id);
    setConfigValor(db, CHAVE_LOGIN, usuario.display_name || usuario.login || '');
  } catch {
    return { ok: false, mensagem: 'Tokens salvos, mas falha ao consultar o canal na Twitch.' };
  }

  definirErro(db, '');
  setConfigValor(db, CHAVE_CACHE_SUBS, '');
  return { ok: true, mensagem: 'Twitch conectada com sucesso.' };
}

// Renova o access token com o refresh token. Retorna null se não der.
async function renovarAccessToken(db: Database.Database): Promise<string | null> {
  const clientId = getTwitchClientId(db);
  const clientSecret = getTwitchClientSecret(db);
  const refresh = texto(db, CHAVE_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refresh) return null;
  try {
    const res = await fetchComTimeout(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refresh,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as RespostaTokenTwitch;
    if (!res.ok || !json.access_token) {
      definirErro(db, 'A autorização com a Twitch expirou. Conecte novamente.');
      return null;
    }
    setConfigValor(db, CHAVE_ACCESS_TOKEN, json.access_token);
    if (json.refresh_token) setConfigValor(db, CHAVE_REFRESH_TOKEN, json.refresh_token);
    definirErro(db, '');
    return json.access_token;
  } catch {
    definirErro(db, 'Falha de rede ao renovar o token da Twitch.');
    return null;
  }
}

async function buscarTotalSubs(db: Database.Database, accessToken: string): Promise<Response> {
  const broadcasterId = texto(db, CHAVE_USER_ID);
  const params = new URLSearchParams({ broadcaster_id: broadcasterId, first: '1' });
  return fetchComTimeout(`${URL_HELIX}/subscriptions?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': getTwitchClientId(db),
    },
  });
}

interface CacheSubs {
  total: number | null;
  tentadoEm: number;
  erro: boolean;
}

function lerCache(db: Database.Database): CacheSubs | null {
  const bruto = getConfigValor(db, CHAVE_CACHE_SUBS);
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Partial<CacheSubs>;
    if (typeof c.tentadoEm !== 'number') return null;
    return {
      total: typeof c.total === 'number' ? c.total : null,
      tentadoEm: c.tentadoEm,
      erro: Boolean(c.erro),
    };
  } catch {
    return null;
  }
}

function gravarCache(db: Database.Database, total: number | null, erro: boolean): void {
  setConfigValor(
    db,
    CHAVE_CACHE_SUBS,
    JSON.stringify({ total, tentadoEm: Date.now(), erro } satisfies CacheSubs)
  );
}

// Contagem atual de subs com cache curto. Em cache vencido devolve o último
// valor conhecido e atualiza em segundo plano (stale-while-revalidate): o
// payload da overlay não pode ficar preso atrás da API da Twitch, senão o
// layout só chega depois de a cena já ter trocado no OBS. Sem nenhum cache
// ainda, espera a primeira resposta. Chamadas concorrentes compartilham a
// mesma requisição.
let emAndamento: Promise<{ contagem: number | null; erro: boolean }> | null = null;

function iniciarAtualizacaoSubs(
  db: Database.Database,
  cache: CacheSubs | null
): Promise<{ contagem: number | null; erro: boolean }> {
  if (emAndamento) return emAndamento;
  const p = buscarContagemRemota(db, cache);
  emAndamento = p;
  const limpar = () => {
    if (emAndamento === p) emAndamento = null;
  };
  // buscarContagemRemota já trata os erros; o then evita rejeição não tratada.
  void p.then(limpar, limpar);
  return p;
}

export async function obterContagemSubs(
  db: Database.Database
): Promise<{ contagem: number | null; erro: boolean }> {
  const cache = lerCache(db);
  if (cache) {
    const ttl = cache.erro ? TWITCH_SUBS_ERRO_CACHE_MS : TWITCH_SUBS_CACHE_MS;
    if (Date.now() - cache.tentadoEm < ttl) {
      return { contagem: cache.total, erro: cache.erro };
    }
    void iniciarAtualizacaoSubs(db, cache);
    return { contagem: cache.total, erro: cache.erro };
  }
  return iniciarAtualizacaoSubs(db, cache);
}

async function buscarContagemRemota(
  db: Database.Database,
  cache: CacheSubs | null
): Promise<{ contagem: number | null; erro: boolean }> {
  const clientId = getTwitchClientId(db);
  let accessToken = texto(db, CHAVE_ACCESS_TOKEN);
  const broadcasterId = texto(db, CHAVE_USER_ID);
  if (!clientId || !broadcasterId || (!accessToken && !texto(db, CHAVE_REFRESH_TOKEN))) {
    // Não conectado: não é erro, apenas sem número.
    return { contagem: null, erro: false };
  }

  try {
    if (!accessToken) {
      accessToken = (await renovarAccessToken(db)) ?? '';
      if (!accessToken) {
        gravarCache(db, cache?.total ?? null, true);
        return { contagem: cache?.total ?? null, erro: true };
      }
    }

    let res = await buscarTotalSubs(db, accessToken);
    if (res.status === 401) {
      const renovado = await renovarAccessToken(db);
      if (renovado) res = await buscarTotalSubs(db, renovado);
    }

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      definirErro(
        db,
        json.message || `Não foi possível ler os subs (HTTP ${res.status}).`
      );
      gravarCache(db, cache?.total ?? null, true);
      return { contagem: cache?.total ?? null, erro: true };
    }

    const json = (await res.json()) as { total?: number | null };
    const total = Number(json.total);
    if (!Number.isFinite(total)) {
      definirErro(db, 'Resposta inesperada da Twitch para os subs.');
      gravarCache(db, cache?.total ?? null, true);
      return { contagem: cache?.total ?? null, erro: true };
    }
    definirErro(db, '');
    gravarCache(db, total, false);
    return { contagem: total, erro: false };
  } catch {
    definirErro(db, 'Falha de rede ao consultar os subs na Twitch.');
    gravarCache(db, cache?.total ?? null, true);
    return { contagem: cache?.total ?? null, erro: true };
  }
}
