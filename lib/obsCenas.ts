// Controle de cenas do OBS (obs-websocket, porta 4455) integrado ao GSI do Dota 2.
// Portado do Dota 2 Observer: Menu/Draft/Jogando automáticos + modo Descanso.
import type { DatabaseSync } from 'node:sqlite';
// Variante JSON do obs-websocket-js: compatível com qualquer OBS (a msgpack
// exigiria suporte a MessagePack no servidor).
import OBSWebSocket from 'obs-websocket-js/json';
import { registrarEventoOverlay } from './overlayEventos';

export type EstadoCena = 'menu' | 'draft' | 'game' | 'descanso';

export interface NomesCenas {
  menu: string;
  draft: string;
  game: string;
  descanso: string;
}

export interface ObsConexao {
  host: string;
  port: number;
  senha: string;
}

const CENAS_DEFAULT: NomesCenas = {
  menu: 'Dota - Menu',
  draft: 'Dota - Draft',
  game: 'Dota - Jogando',
  descanso: 'Descanso',
};

const CONEXAO_DEFAULT: ObsConexao = {
  host: '127.0.0.1',
  port: 4455,
  senha: '123456',
};

const CHAVE_NOMES = 'obs_cenas';
const CHAVE_CONEXAO = 'obs_conexao';
const CHAVE_DESCANSO = 'obs_descanso';
const CHAVE_TRANSICAO_FOGO = 'overlay_transicao_fogo';

const RETRY_CONEXAO_MS = 10_000;
const THROTTLE_AUTO_MS = 3000;
const IGNORAR_AUTO_APOS_FORCAR_MS = 8000;
const FOGO_DURACAO_DEFAULT_MS = 2600;
// Margem extra do fallback: cobre o poll da overlay e a compilação do shader.
const TRANSICAO_FALLBACK_EXTRA_MS = 1200;

// ─── Config (tabela config) ────────────────────────────────────────────────
// Helpers locais para não criar dependência circular com lib/acompanhamento.

function lerConfig(db: DatabaseSync, chave: string): string | null {
  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave) as
    | { valor: string }
    | undefined;
  return row ? row.valor : null;
}

function gravarConfig(db: DatabaseSync, chave: string, valor: string): void {
  db.prepare(
    `INSERT INTO config (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).run(chave, valor);
}

// Lê só o necessário da transição de fogo (ativa + duração) direto do config,
// sem importar lib/overlay (evita dependência circular).
function lerFogo(db: DatabaseSync): { ativo: boolean; duracaoMs: number } {
  const bruto = lerConfig(db, CHAVE_TRANSICAO_FOGO);
  if (!bruto) return { ativo: false, duracaoMs: FOGO_DURACAO_DEFAULT_MS };
  try {
    const parsed = JSON.parse(bruto) as { ativo?: unknown; duracaoMs?: unknown };
    const duracao = Number(parsed.duracaoMs);
    return {
      ativo: parsed.ativo === true,
      duracaoMs:
        Number.isFinite(duracao) && duracao > 0 ? duracao : FOGO_DURACAO_DEFAULT_MS,
    };
  } catch {
    return { ativo: false, duracaoMs: FOGO_DURACAO_DEFAULT_MS };
  }
}

export function getObsNomes(db: DatabaseSync): NomesCenas {
  const bruto = lerConfig(db, CHAVE_NOMES);
  if (!bruto) return { ...CENAS_DEFAULT };
  try {
    const parsed = JSON.parse(bruto) as Partial<Record<EstadoCena, unknown>>;
    return {
      menu: String(parsed.menu ?? '').trim() || CENAS_DEFAULT.menu,
      draft: String(parsed.draft ?? '').trim() || CENAS_DEFAULT.draft,
      game: String(parsed.game ?? '').trim() || CENAS_DEFAULT.game,
      descanso: String(parsed.descanso ?? '').trim() || CENAS_DEFAULT.descanso,
    };
  } catch {
    return { ...CENAS_DEFAULT };
  }
}

export function setObsNomes(db: DatabaseSync, nomes: Partial<Record<EstadoCena, unknown>>): NomesCenas {
  const atuais = getObsNomes(db);
  const novos: NomesCenas = {
    menu: String(nomes.menu ?? '').trim() || atuais.menu,
    draft: String(nomes.draft ?? '').trim() || atuais.draft,
    game: String(nomes.game ?? '').trim() || atuais.game,
    descanso: String(nomes.descanso ?? '').trim() || atuais.descanso,
  };
  gravarConfig(db, CHAVE_NOMES, JSON.stringify(novos));
  return novos;
}

export function getObsConexao(db: DatabaseSync): ObsConexao {
  const bruto = lerConfig(db, CHAVE_CONEXAO);
  if (!bruto) return { ...CONEXAO_DEFAULT };
  try {
    const parsed = JSON.parse(bruto) as { host?: unknown; port?: unknown; senha?: unknown };
    const host = String(parsed.host ?? '').trim() || CONEXAO_DEFAULT.host;
    const port = Number(parsed.port);
    const senha = typeof parsed.senha === 'string' ? parsed.senha : CONEXAO_DEFAULT.senha;
    return {
      host,
      port: Number.isFinite(port) && port > 0 && port < 65536 ? Math.round(port) : CONEXAO_DEFAULT.port,
      senha,
    };
  } catch {
    return { ...CONEXAO_DEFAULT };
  }
}

export function setObsConexao(
  db: DatabaseSync,
  parcial: { host?: unknown; port?: unknown; senha?: unknown }
): ObsConexao {
  const atual = getObsConexao(db);
  const host = String(parcial.host ?? '').trim() || atual.host;
  const portBruto = Number(parcial.port);
  const port =
    Number.isFinite(portBruto) && portBruto > 0 && portBruto < 65536 ? Math.round(portBruto) : atual.port;
  const senha =
    typeof parcial.senha === 'string' && parcial.senha.length > 0 ? parcial.senha : atual.senha;
  const nova: ObsConexao = { host, port, senha };
  gravarConfig(db, CHAVE_CONEXAO, JSON.stringify(nova));
  // Força reconexão com os novos dados
  desconectar();
  return nova;
}

export function getModoDescanso(db: DatabaseSync): boolean {
  return lerConfig(db, CHAVE_DESCANSO) === '1';
}

function setModoDescanso(db: DatabaseSync, ativo: boolean): void {
  gravarConfig(db, CHAVE_DESCANSO, ativo ? '1' : '0');
}

// ─── Estado da conexão (globalThis sobrevive ao hot reload) ────────────────

export interface TransicaoPendente {
  seq: number;
  destino: EstadoCena;
  origem: 'manual' | 'auto';
  criadoEm: number;
}

interface EstadoObsInterno {
  client: OBSWebSocket | null;
  conectado: boolean;
  conectando: boolean;
  ultimaTentativa: number;
  cenaAtual: string | null;
  ultimoEstado: EstadoCena | null;
  ultimaTrocaAuto: number;
  ignorarAutoAte: number;
  erroConexao: string;
  // Transição de fogo anunciada e ainda não aplicada no OBS: a overlay toca o
  // efeito e confirma na cobertura; até lá a cena atual continua no ar.
  transicao: TransicaoPendente | null;
  transicaoSeq: number;
  transicaoTimer: ReturnType<typeof setTimeout> | null;
}

const globalForObs = globalThis as unknown as { _obsCenas?: EstadoObsInterno };

function estado(): EstadoObsInterno {
  if (!globalForObs._obsCenas) {
    globalForObs._obsCenas = {
      client: null,
      conectado: false,
      conectando: false,
      ultimaTentativa: 0,
      cenaAtual: null,
      ultimoEstado: null,
      ultimaTrocaAuto: 0,
      ignorarAutoAte: 0,
      erroConexao: '',
      transicao: null,
      transicaoSeq: 0,
      transicaoTimer: null,
    };
  }
  const s = globalForObs._obsCenas;
  // Hot reload preserva o global antigo: completa os campos novos para não
  // iniciar com seq NaN/timer indefinido em desenvolvimento.
  if (s.transicao === undefined) s.transicao = null;
  if (!Number.isFinite(s.transicaoSeq)) s.transicaoSeq = 0;
  if (s.transicaoTimer === undefined) s.transicaoTimer = null;
  return s;
}

function cancelarTransicao(s: EstadoObsInterno): void {
  if (s.transicaoTimer) {
    clearTimeout(s.transicaoTimer);
    s.transicaoTimer = null;
  }
  s.transicao = null;
}

export function getUltimoEstadoObs(): EstadoCena | null {
  return estado().ultimoEstado;
}

// Cena que o painel deve acender: já reflete o destino de uma transição
// anunciada, mesmo antes de o OBS trocar de fato.
export function getEstadoExibicao(db: DatabaseSync): EstadoCena | null {
  const s = estado();
  return s.transicao?.destino ?? resolverEstadoAtual(db);
}

export function getTransicaoPendente(): TransicaoPendente | null {
  return estado().transicao;
}

// Atualiza a cena atual e mantém o modo Descanso alinhado à cena real do OBS:
// ligado apenas quando a cena atual é a cena de Descanso configurada, e
// desligado assim que o OBS sai dela (por clique, atalho ou mudança manual).
function sincronizarCenaAtual(db: DatabaseSync, cena: string | null): void {
  const s = estado();
  s.cenaAtual = cena || null;
  if (!cena) return;
  try {
    const ligado = cena === getObsNomes(db).descanso;
    if (getModoDescanso(db) !== ligado) setModoDescanso(db, ligado);
  } catch (e) {
    // Falha de config nunca deve derrubar o listener do OBS.
    console.error('Falha ao sincronizar o modo Descanso com a cena do OBS:', e);
  }
}

export function getCenaAtualObs(): string | null {
  return estado().cenaAtual;
}

export function resolverEstadoAtual(db: DatabaseSync): EstadoCena | null {
  const s = estado();
  if (s.cenaAtual) {
    const nomes = getObsNomes(db);
    const encontrado = (Object.keys(nomes) as EstadoCena[]).find(
      (e) => nomes[e] === s.cenaAtual
    );
    if (encontrado) return encontrado;
  }
  return s.ultimoEstado;
}

function mensagemErro(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e ?? 'Erro desconhecido');
}

function marcarFalha(s: EstadoObsInterno, e: unknown): void {
  s.erroConexao = mensagemErro(e);
  s.conectado = false;
  s.client = null;
  s.cenaAtual = null;
  cancelarTransicao(s);
}

export function desconectar(): void {
  const s = estado();
  try {
    void s.client?.disconnect();
  } catch {
    // ignore
  }
  s.client = null;
  s.conectado = false;
  s.conectando = false;
  s.ultimaTentativa = 0;
  s.cenaAtual = null;
  s.erroConexao = '';
  cancelarTransicao(s);
}

// Conecta (ou reconecta) no OBS respeitando o intervalo de retry.
export async function garantirConexao(db: DatabaseSync): Promise<boolean> {
  const s = estado();
  if (s.conectado && s.client) return true;
  if (s.conectando) return false;
  if (Date.now() - s.ultimaTentativa < RETRY_CONEXAO_MS) return false;

  s.conectando = true;
  s.ultimaTentativa = Date.now();
  const cfg = getObsConexao(db);
  try {
    const client = new OBSWebSocket();
    await client.connect(`ws://${cfg.host}:${cfg.port}`, cfg.senha || undefined);
    s.client = client;
    s.conectado = true;
    s.erroConexao = '';
    client.on('CurrentProgramSceneChanged', (ev) => {
      sincronizarCenaAtual(db, ev.sceneName);
    });
    client.on('ConnectionClosed', () => {
      s.conectado = false;
      s.client = null;
      s.cenaAtual = null;
    });
    try {
      const atual = await client.call('GetCurrentProgramScene');
      sincronizarCenaAtual(db, atual.currentProgramSceneName);
    } catch {
      // cena atual é opcional
    }
    return true;
  } catch (e) {
    marcarFalha(s, e);
    return false;
  } finally {
    s.conectando = false;
  }
}

// ─── Operações de cena ──────────────────────────────────────────────────────

export interface StatusObs {
  conectado: boolean;
  cenaAtual: string | null;
  cenas: string[];
  erro: string;
}

export async function statusObs(db: DatabaseSync): Promise<StatusObs> {
  const s = estado();
  const conectado = await garantirConexao(db);
  if (!conectado || !s.client) {
    return { conectado: false, cenaAtual: null, cenas: [], erro: s.erroConexao };
  }
  try {
    const resp = await s.client.call('GetSceneList');
    const lista = (resp.scenes ?? []) as { sceneName?: unknown; sceneIndex?: unknown }[];
    const cenas = [...lista]
      .sort((a, b) => (Number(a.sceneIndex) || 0) - (Number(b.sceneIndex) || 0))
      .map((c) => String(c.sceneName ?? ''))
      .filter(Boolean);
    if (typeof resp.currentProgramSceneName === 'string' && resp.currentProgramSceneName) {
      sincronizarCenaAtual(db, resp.currentProgramSceneName);
    }
    return { conectado: true, cenaAtual: s.cenaAtual, cenas, erro: '' };
  } catch (e) {
    marcarFalha(s, e);
    return { conectado: false, cenaAtual: null, cenas: [], erro: s.erroConexao };
  }
}

interface ResultadoTroca {
  ok: boolean;
  erro?: string;
  cenaAtual: string | null;
  // O pedido virou (ou já era) uma transição anunciada, ainda não aplicada.
  pendente?: boolean;
  // Pedido repetido/atrasado: não fez nada e não é erro.
  ignorada?: boolean;
}

async function trocarCena(db: DatabaseSync, nome: string): Promise<ResultadoTroca> {
  const s = estado();
  const conectado = await garantirConexao(db);
  if (!conectado || !s.client) {
    return { ok: false, erro: s.erroConexao || 'OBS desconectado', cenaAtual: null };
  }
  try {
    await s.client.call('SetCurrentProgramScene', { sceneName: nome });
    s.cenaAtual = nome;
    return { ok: true, cenaAtual: nome };
  } catch (e) {
    marcarFalha(s, e);
    return { ok: false, erro: s.erroConexao, cenaAtual: null };
  }
}

// Anuncia a troca para a overlay (que toca o fogo) sem mexer no OBS ainda.
function criarTransicaoPendente(
  db: DatabaseSync,
  destino: EstadoCena,
  origem: 'manual' | 'auto'
): TransicaoPendente {
  const s = estado();
  cancelarTransicao(s);
  s.transicaoSeq += 1;
  const pendente: TransicaoPendente = {
    seq: s.transicaoSeq,
    destino,
    origem,
    criadoEm: Date.now(),
  };
  s.transicao = pendente;

  const { duracaoMs } = lerFogo(db);
  // A overlay confirma quando o fogo cobre (~metade da duração). Se ela não
  // estiver aberta, troca mesmo assim para as cenas nunca ficarem travadas.
  const prazo = Math.round(duracaoMs / 2) + TRANSICAO_FALLBACK_EXTRA_MS;
  const timer = setTimeout(() => {
    void concluirTransicao(db, pendente.seq, true).catch(() => {});
  }, prazo);
  (timer as unknown as { unref?: () => void }).unref?.();
  s.transicaoTimer = timer;
  return pendente;
}

// Executa a troca anunciada (confirmação da overlay ou fallback do timer).
// Idempotente: a primeira confirmação vence e as demais são ignoradas.
async function concluirTransicao(
  db: DatabaseSync,
  seq: number,
  fallback: boolean
): Promise<ResultadoTroca> {
  const s = estado();
  const pendente = s.transicao;
  if (!pendente || pendente.seq !== seq) {
    return { ok: true, cenaAtual: s.cenaAtual, ignorada: true };
  }

  cancelarTransicao(s);

  const nome = getObsNomes(db)[pendente.destino];
  const modoAnterior = getModoDescanso(db);
  const ultimoAnterior = s.ultimoEstado;
  const ignorarAnterior = s.ignorarAutoAte;

  setModoDescanso(db, pendente.destino === 'descanso');
  s.ultimoEstado = pendente.destino;
  s.ignorarAutoAte = Date.now() + IGNORAR_AUTO_APOS_FORCAR_MS;

  const res = await trocarCena(db, nome);
  if (!res.ok) {
    setModoDescanso(db, modoAnterior);
    s.ultimoEstado = ultimoAnterior;
    s.ignorarAutoAte = ignorarAnterior;
    return res;
  }

  const como = pendente.origem === 'manual' ? 'manualmente' : 'automaticamente';
  const aviso = fallback ? ' (sem confirmação da transição)' : '';
  registrarEventoOverlay(db, 'cena_trocada', `Cena trocada ${como}${aviso}: ${nome}`);
  return res;
}

// Chamada pela overlay no instante em que o fogo cobre a tela.
export async function confirmarTransicao(
  db: DatabaseSync,
  seq: number
): Promise<ResultadoTroca> {
  return concluirTransicao(db, seq, false);
}

// Troca manual (botões Menu/Draft/Jogando/Descanso).
export async function forcarEstado(
  db: DatabaseSync,
  alvo: EstadoCena
): Promise<ResultadoTroca> {
  const s = estado();
  const nome = getObsNomes(db)[alvo];
  if (!nome) return { ok: false, erro: 'Nome da cena não configurado', cenaAtual: null };

  // Já existe uma transição em andamento: ignora o clique extra.
  if (s.transicao) return { ok: true, cenaAtual: s.cenaAtual, ignorada: true };

  const fogo = lerFogo(db);
  if (fogo.ativo) {
    const conectado = await garantirConexao(db);
    // Outra troca pode ter entrado enquanto conectava.
    if (s.transicao) return { ok: true, cenaAtual: s.cenaAtual, ignorada: true };
    if (!conectado || !s.client) {
      return { ok: false, erro: s.erroConexao || 'OBS desconectado', cenaAtual: null };
    }
    criarTransicaoPendente(db, alvo, 'manual');
    s.ignorarAutoAte = Date.now() + IGNORAR_AUTO_APOS_FORCAR_MS;
    return { ok: true, cenaAtual: s.cenaAtual, pendente: true };
  }

  // Sem transição de fogo: aplica o estado antes da troca para o GSI não puxar
  // outra cena durante a chamada ao OBS; se a troca falhar, tudo é restaurado.
  const modoAnterior = getModoDescanso(db);
  const ultimoAnterior = s.ultimoEstado;
  const ignorarAnterior = s.ignorarAutoAte;

  setModoDescanso(db, alvo === 'descanso');
  s.ultimoEstado = alvo;
  s.ignorarAutoAte = Date.now() + IGNORAR_AUTO_APOS_FORCAR_MS;

  const res = await trocarCena(db, nome);
  if (!res.ok) {
    setModoDescanso(db, modoAnterior);
    s.ultimoEstado = ultimoAnterior;
    s.ignorarAutoAte = ignorarAnterior;
    return res;
  }

  registrarEventoOverlay(db, 'cena_trocada', `Cena trocada manualmente: ${nome}`);
  return res;
}

// ─── Integração com o GSI ───────────────────────────────────────────────────

function mapearEstadoGsi(gameState: string): EstadoCena | null {
  // Sem game_state = o cliente está no dashboard/menu. O Dota deixa de enviar
  // o bloco "map" (ou o estado) ao sair de um demo/partida espetada.
  if (!gameState) return 'menu';
  if (
    gameState === 'DOTA_GAMERULES_STATE_HERO_SELECTION' ||
    gameState === 'DOTA_GAMERULES_STATE_STRATEGY_TIME'
  ) {
    return 'draft';
  }
  if (
    gameState === 'DOTA_GAMERULES_STATE_PRE_GAME' ||
    gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS'
  ) {
    return 'game';
  }
  if (gameState.startsWith('DOTA_GAMERULES_STATE_')) return 'menu';
  return null;
}

async function processarTransicao(db: DatabaseSync, alvo: EstadoCena): Promise<void> {
  const s = estado();
  const modoDescanso = getModoDescanso(db);

  // No modo Descanso, o menu não puxa cena sozinho (só clique manual).
  if (alvo === 'menu' && modoDescanso) return;

  // Draft/Jogando acontecem normalmente e encerram o modo Descanso: a troca
  // de cena desliga o modo automaticamente (ele segue a cena real do OBS).
  if (alvo === s.ultimoEstado) return;
  // Forçar manualmente um Menu/Draft/Jogando não deve ser revertido na hora
  // pelo GSI — mas Draft/Jogando são sinais fortes e sempre assumem.
  if (alvo === 'menu' && Date.now() < s.ignorarAutoAte) return;

  // Uma transição já está no ar: não anuncia outra por cima.
  if (s.transicao) return;

  const agora = Date.now();
  if (agora - s.ultimaTrocaAuto < THROTTLE_AUTO_MS) return;

  const nome = getObsNomes(db)[alvo];
  if (!nome) return;

  const fogo = lerFogo(db);
  if (fogo.ativo) {
    const conectado = await garantirConexao(db);
    // Outra troca pode ter entrado enquanto conectava.
    if (s.transicao) return;
    if (!conectado) return;
    criarTransicaoPendente(db, alvo, 'auto');
    s.ultimaTrocaAuto = agora;
    return;
  }

  const res = await trocarCena(db, nome);
  if (res.ok) {
    s.ultimaTrocaAuto = agora;
    s.ultimoEstado = alvo;
    registrarEventoOverlay(db, 'cena_trocada', `Cena trocada automaticamente: ${nome}`);
  }
}

// Chamado a cada payload do GSI (fire-and-forget; nunca derruba o GSI).
// gameState vazio também é um sinal válido: significa "sem partida" (menu).
export function aoEstadoGsi(db: DatabaseSync, gameState: string): void {
  const alvo = mapearEstadoGsi(gameState);
  if (!alvo) return;
  void processarTransicao(db, alvo).catch(() => {});
}
