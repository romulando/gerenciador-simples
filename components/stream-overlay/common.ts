// Tipos e utilidades compartilhados da Stream Overlay (página admin, editor e OBS).

export interface MedalhaInfo {
  nome: string;
  nivel: number;
  imagem: string;
  cor: string;
}

export interface LayoutElemento {
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  baseWidth?: string;
  baseHeight?: string;
}

export interface LayoutOverlay {
  grouped?: boolean;
  medalWrapper?: LayoutElemento;
  infoBlock?: LayoutElemento;
  groupContainer?: LayoutElemento;
  subCounter?: LayoutElemento;
  slidesCounter?: LayoutElemento;
}

export type EstadoCena = 'menu' | 'draft' | 'game' | 'descanso';

export const ESTADOS_OVERLAY: readonly EstadoCena[] = ['menu', 'draft', 'game', 'descanso'];

export type LayoutsPorCena = Partial<Record<EstadoCena, LayoutOverlay>>;

export interface PedidoOverlay {
  id: number;
  trackingId: string | null;
  tipoServico: string;
  contaDota: string | null;
  mmrInicial: number | null;
  mmrAtual: number | null;
  mmrFinal: number | null;
  medalhaAtual: MedalhaInfo | null;
  medalhaInicial: MedalhaInfo | null;
  medalhaFinal: MedalhaInfo | null;
}

// Conta principal de um booster detectada pelo GSI (sem pedido vinculado):
// a overlay usa `mmr`/`medalha` no lugar dos dados do pedido.
export interface BoosterOverlay {
  id: number;
  nickname: string;
  nome: string;
  mmr: number | null;
  medalha: MedalhaInfo | null;
}

// ─── Carrossel de slides (cupom, patrocinadores, anuncie) ──────────────────

export type TipoSlide = 'cupom' | 'patrocinador' | 'anuncie';

export const TIPOS_SLIDE: readonly TipoSlide[] = ['cupom', 'patrocinador', 'anuncie'];

export interface PatrocinadorOverlay {
  id: string;
  // Nome de exibição no painel (opcional; vazio usa “Patrocinador N”).
  nome: string;
  imagem: string;
  duracaoMs: number;
  // Ligado: estica a imagem para preencher o card (pode distorcer);
  // desligado: preenche cortando o excedente (cover).
  esticar: boolean;
  ativo: boolean;
}

export interface SlidesOverlayConfig {
  rotacao: boolean;
  // 'seguido' = um slide troca direto no outro; 'intervalo' = o card some por
  // intervaloMs entre um slide e o próximo.
  modo: 'seguido' | 'intervalo';
  intervaloMs: number;
  ordem: TipoSlide[];
  // true = contador de subs em cima e barra do LivePix embaixo, no mesmo card;
  // false = alterna os dois usando subsMs/livepixMs.
  subsLivepixJuntos: boolean;
  subsMs: number;
  livepixMs: number;
  cupomMs: number;
  anuncieMs: number;
  cupom: { ativo: boolean; pre: string; codigo: string; pos: string };
  anuncie: { ativo: boolean; titulo: string; texto: string; contato: string };
  patrocinadores: PatrocinadorOverlay[];
}

export const SLIDE_DURACAO_MIN_MS = 1000;
export const SLIDE_DURACAO_MAX_MS = 600000;
export const SLIDE_PAUSA_MAX_MS = 600000;
export const SLIDES_MAX_PATROCINADORES = 30;
export const SLIDE_DURACAO_PADRAO_PATROCINADOR = 4000;

export function slidesPadrao(): SlidesOverlayConfig {
  return {
    rotacao: true,
    modo: 'seguido',
    intervaloMs: 3000,
    ordem: [...TIPOS_SLIDE],
    subsLivepixJuntos: false,
    subsMs: 5000,
    livepixMs: 8000,
    cupomMs: 5000,
    anuncieMs: 4000,
    cupom: { ativo: false, pre: 'Utilize o cupom', codigo: '', pos: '' },
    anuncie: { ativo: false, titulo: 'ANUNCIE AQUI', texto: 'Divulgue sua marca na live', contato: '' },
    patrocinadores: [],
  };
}

// Contador de subs da Twitch exibido na overlay. `contagem` é null quando o
// contador está desligado, a Twitch não está conectada ou houve erro.
export interface SubOverlayDados {
  ativo: boolean;
  contagem: number | null;
  meta: number;
  cor: string;
  erro: boolean;
}

// ─── Barra de progresso do LivePix (doações do mês) ────────────────────────

export type EstiloBarraLivepix = 'classic' | 'glass';

export const ESTILOS_BARRA_LIVEPIX: readonly EstiloBarraLivepix[] = ['classic', 'glass'];

// Meta da barra em reais.
export const LIVEPIX_META_MAX = 999999;

export function normalizarEstiloLivepix(v: unknown): EstiloBarraLivepix {
  return v === 'glass' ? 'glass' : 'classic';
}

export interface LivepixOverlayDados {
  ativo: boolean;
  estilo: EstiloBarraLivepix;
  // Meta em reais (0 = sem meta definida; a barra fica em 0%).
  meta: number;
  // Total arrecadado no mês em reais (null quando desligado ou sem dados).
  total: number | null;
  mes: string;
  erro: boolean;
}

export interface LivepixStatusOverlay {
  clientId: string;
  clientIdDefinido: boolean;
  secretDefinido: boolean;
  conectado: boolean;
  login: string | null;
  erro: string | null;
}

// ─── Transição de fogo entre cenas ─────────────────────────────────────────
// O efeito cobre a tela no instante da troca de cena. Somente as paletas de
// fogo do arquivo de referência entram aqui (a fumaça ficou de fora). A
// escolha é global: vale para Menu, Draft, Jogando e Descanso.

export type PaletaFogo = 'orange' | 'blue' | 'purple' | 'green' | 'dark';

export const PALETAS_FOGO: readonly PaletaFogo[] = [
  'orange',
  'blue',
  'purple',
  'green',
  'dark',
];

export const FOGO_DURACAO_MIN_MS = 1500;
export const FOGO_DURACAO_MAX_MS = 4500;
export const FOGO_DURACAO_DEFAULT_MS = 2600;

export interface FogoOverlayConfig {
  ativo: boolean;
  paleta: PaletaFogo;
  duracaoMs: number;
}

export function fogoPadrao(): FogoOverlayConfig {
  return { ativo: false, paleta: 'orange', duracaoMs: FOGO_DURACAO_DEFAULT_MS };
}

export function normalizarPaletaFogo(valor: unknown): PaletaFogo {
  return PALETAS_FOGO.includes(valor as PaletaFogo) ? (valor as PaletaFogo) : 'orange';
}

export function normalizarDuracaoFogo(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return FOGO_DURACAO_DEFAULT_MS;
  return Math.min(FOGO_DURACAO_MAX_MS, Math.max(FOGO_DURACAO_MIN_MS, Math.round(n)));
}

export interface DadosOverlay {
  ativo: boolean;
  atualizadoEm: string;
  estado: EstadoCena | null;
  pedido: PedidoOverlay | null;
  wins: number;
  losses: number;
  limiteWins: number;
  modoBoost: boolean;
  gsi: { online: boolean; contaDetectada: string | null };
  booster: BoosterOverlay | null;
  layout: LayoutOverlay | null;
  sub: SubOverlayDados;
  slides: SlidesOverlayConfig;
  livepix: LivepixOverlayDados;
  fogo: FogoOverlayConfig;
}

// O carrossel (cupom, patrocinadores, anuncie) só aparece quando há ao menos
// um slide ativo — usado para exibir/posicionar o elemento no editor.
export function slidesTemItens(slides: SlidesOverlayConfig | null | undefined): boolean {
  if (!slides) return false;
  if (slides.cupom.ativo && slides.cupom.codigo.trim() !== '') return true;
  if (slides.anuncie.ativo) return true;
  return slides.patrocinadores.some((p) => p.ativo && p.imagem !== '');
}

export interface EventoOverlay {
  id: number;
  tipo: string;
  mensagem: string;
  detalhes: string;
  createdAt: string;
  clienteNome?: string | null;
}

export interface ContaPedidoOverlay {
  trackingId: string;
  accountId: string;
  tipoServico: string;
  atualizadoEm: string;
}

export interface RespostaPainelOverlay {
  dados: DadosOverlay;
  limiteWins: number;
  modoBoost: boolean;
  token: string;
  pedidoSelecionado?: string;
  pedidoSelecionadoTipo?: string;
  contas?: ContaPedidoOverlay[];
  pendentes?: {
    pendentes: number;
    recalculoPendente: number;
    ultimoErro: string;
    atualizadoEm: string | null;
  };
  eventos: EventoOverlay[];
}

// ─── Controle de Cenas (OBS) ───────────────────────────────────────────────

export interface NomesCenas {
  menu: string;
  draft: string;
  game: string;
  descanso: string;
}

export interface RespostaCenasObs {
  conectado: boolean;
  cenaAtual: string | null;
  cenas: string[];
  erro: string;
  nomes: NomesCenas;
  modoDescanso: boolean;
  ultimoEstado: EstadoCena | null;
  conexao: { host: string; port: number; senhaDefinida: boolean };
}

export const CANVAS_LARGURA = 1920;
export const CANVAS_ALTURA = 1080;

// Limites do "últimas X partidas" (modo de contagem de wins do banco local).
export const OVERLAY_WINS_LIMITE_DEFAULT = 10;
export const OVERLAY_WINS_LIMITE_MIN = 1;
export const OVERLAY_WINS_LIMITE_MAX = 200;

export const TEXTO_OVERLAY_SOMBRA =
  '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';

export type ElementoOverlay =
  | 'medalWrapper'
  | 'infoBlock'
  | 'groupContainer'
  | 'subCounter'
  | 'slidesCounter';

export function medida(v: string | undefined | null): number {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Fatores de escala portados do overlay original (Observer).
// Dimensões naturais de fallback (quando o layout não guardou baseWidth/baseHeight).
export const BASE_MEDALHA_W = 88;
export const BASE_MEDALHA_H = 93;
export const BASE_INFO_W = 280;
export const BASE_INFO_H = 90;
export const BASE_GRUPO_W = 500;
export const BASE_GRUPO_H = 130;
// Card do carrossel (cupom, patrocinadores, anuncie).
export const BASE_SLIDES_W = 380;
export const BASE_SLIDES_H = 200;
// Card de progresso (contador de subs / barra do LivePix, mesmo elemento e
// mesmos designs). Tamanhos naturais do HTML de referência: clássica é uma
// faixa baixa e o vidro um card mais largo e baixo que o card antigo.
export const BASE_PROGRESSO_W = 450;
export const BASE_PROGRESSO_CLASSIC_H = 36;
export const BASE_PROGRESSO_GLASS_H = 105;
export const LIVEPIX_TITULO = 'LIVEPIX';

// Espaçamento vertical entre o contador de subs e a barra do LivePix quando
// os dois são exibidos juntos (um em cima do outro).
export const PROGRESSO_JUNTOS_GAP = 12;

export function baseProgresso(
  estilo: EstiloBarraLivepix,
  juntos = false,
  quantidade = 1
): { w: number; h: number } {
  const alturaCard = estilo === 'glass' ? BASE_PROGRESSO_GLASS_H : BASE_PROGRESSO_CLASSIC_H;
  // `quantidade` limita o modo junto ao que está realmente visível: com só um
  // dos widgets ligado, o card continua com a altura de um.
  const n = juntos ? Math.max(1, Math.min(2, quantidade)) : 1;
  return {
    w: BASE_PROGRESSO_W,
    h: alturaCard * n + (n - 1) * PROGRESSO_JUNTOS_GAP,
  };
}

// ─── Contador de subs (Twitch) ─────────────────────────────────────────────

export const SUB_COR_DEFAULT = '#e8a020';
export const OVERLAY_SUB_META_MIN = 0;
export const OVERLAY_SUB_META_MAX = 999999;

export interface TwitchStatusOverlay {
  clientId: string;
  clientIdDefinido: boolean;
  secretDefinido: boolean;
  conectado: boolean;
  login: string | null;
  erro: string | null;
}

// Normaliza uma cor #RGB/#RRGGBB (com fallback para a cor padrão da overlay).
export function normalizarCorHex(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return SUB_COR_DEFAULT;
}

// #rrggbb -> rgba(r, g, b, alfa), para os pontos translúcidos do card.
export function corComAlfa(hex: string, alfa: number): string {
  const cor = normalizarCorHex(hex);
  const r = parseInt(cor.slice(1, 3), 16);
  const g = parseInt(cor.slice(3, 5), 16);
  const b = parseInt(cor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

// Resolve a imagem do patrocinador: nome de arquivo salvo em
// public/uploads/sponsors ou uma URL/data URL já pronta (prévia local).
export function urlImagemPatrocinador(valor: string): string {
  if (valor.startsWith('data:') || valor.startsWith('http') || valor.startsWith('/')) {
    return valor;
  }
  return `/uploads/sponsors/${valor}`;
}

// Fator de ajuste do conteúdo à moldura: min(largura/base, altura/base).
// Usa o menor fator para o conteúdo SEMPRE caber dentro da moldura — quando a
// moldura encolhe, o conteúdo encolhe junto em vez de transbordar/quebrar linha.
// Dimensões ausentes são ignoradas (só largura → escala pela largura etc.).
export function fatorFit(
  layout: LayoutElemento | null | undefined,
  baseWPadrao: number,
  baseHPadrao: number
): number {
  const w = medida(layout?.width);
  const h = medida(layout?.height);
  if (!w && !h) return 1;
  const baseW = medida(layout?.baseWidth) || baseWPadrao;
  const baseH = medida(layout?.baseHeight) || baseHPadrao;
  const sx = w > 0 ? w / baseW : Number.POSITIVE_INFINITY;
  const sy = h > 0 ? h / baseH : Number.POSITIVE_INFINITY;
  return Math.min(sx, sy);
}

export function rotuloTipoEvento(tipo: string): string {
  switch (tipo) {
    case 'gsi_conectado':
      return 'GSI';
    case 'conta_detectada':
      return 'Conta';
    case 'jogo_salvo':
      return 'Jogo';
    case 'vinculo_auto':
      return 'Vínculo';
    case 'cena_trocada':
      return 'Cena';
    default:
      return tipo;
  }
}
