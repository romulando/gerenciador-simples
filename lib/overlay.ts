// Stream Overlay: dados exibidos no OBS a partir do GSI (conta logada),
// do pedido em acompanhamento (MMR Inicial/Atual/Final) e do banco local (W/L).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { DatabaseSync } from 'node:sqlite';
import { getConfigValor, setConfigValor } from './config';
import { getEstadoGsi } from './gsi';
import { obterPedidoPublicoTheone, type PedidoOverlayResumo } from './overlayOrder';
// Constantes compartilhadas com o client (módulo neutro, sem dependências server).
import {
  ESTADOS_OVERLAY,
  LIVEPIX_META_MAX,
  OVERLAY_SUB_META_MAX,
  OVERLAY_SUB_META_MIN,
  OVERLAY_WINS_LIMITE_DEFAULT,
  OVERLAY_WINS_LIMITE_MAX,
  OVERLAY_WINS_LIMITE_MIN,
  SLIDE_DURACAO_MAX_MS,
  SLIDE_DURACAO_MIN_MS,
  SLIDE_DURACAO_PADRAO_PATROCINADOR,
  SLIDES_MAX_PATROCINADORES,
  TIPOS_SLIDE,
  fogoPadrao,
  normalizarCorHex,
  normalizarDuracaoFogo,
  normalizarEstiloLivepix,
  normalizarPaletaFogo,
  slidesPadrao,
  type EstadoCena,
  type EstiloBarraLivepix,
  type FogoOverlayConfig,
  type LayoutsPorCena,
  type LivepixOverlayDados,
  type PatrocinadorOverlay,
  type SlidesOverlayConfig,
  type SubOverlayDados,
  type TipoSlide,
} from '../components/stream-overlay/common';
import { nomeMesAtual, obterTotalMesLivepix } from './livepix';
import { getCenasAtivas, resolverEstadoAtual } from './obsCenas';
import { obterContagemSubs } from './twitch';
import { getPedidoSelecionado, setPedidoSelecionado } from './pedidoSelecionado';
import { getContaPedido } from './pedidoContas';

export { getPedidoSelecionado, setPedidoSelecionado };

export {
  OVERLAY_SUB_META_MAX,
  OVERLAY_SUB_META_MIN,
  OVERLAY_WINS_LIMITE_DEFAULT,
  OVERLAY_WINS_LIMITE_MAX,
  OVERLAY_WINS_LIMITE_MIN,
};

// ─── Medalhas (portado do Dota 2 Observer) ─────────────────────────────────

export interface MedalhaInfo {
  nome: string;
  nivel: number;
  imagem: string;
  cor: string;
}

interface FaixaMedalha {
  nome: string;
  imagemBase: string;
  min: number;
  max: number;
  levels: number;
  cor: string;
}

const MEDALHAS: FaixaMedalha[] = [
  { nome: 'Arauto', imagemBase: 'Arauto', min: 0, max: 770, levels: 5, cor: '#AAB25A' },
  { nome: 'Guardião', imagemBase: 'Guardiao', min: 770, max: 1540, levels: 5, cor: '#A67356' },
  { nome: 'Cruzado', imagemBase: 'Cruzado', min: 1540, max: 2310, levels: 5, cor: '#00C2BD' },
  { nome: 'Arconte', imagemBase: 'Arconte', min: 2310, max: 3080, levels: 5, cor: '#12C4AD' },
  { nome: 'Lenda', imagemBase: 'Lenda', min: 3080, max: 3850, levels: 5, cor: '#D4A03C' },
  { nome: 'Ancião', imagemBase: 'Anciao', min: 3850, max: 4620, levels: 5, cor: '#5682D1' },
  { nome: 'Divino', imagemBase: 'Divino', min: 4620, max: 5620, levels: 5, cor: '#FFC75F' },
  { nome: 'Imortal', imagemBase: 'Imortal', min: 5620, max: 8000, levels: 1, cor: '#E67E42' },
];

export function medalhaDoMmr(mmr: number | null | undefined): MedalhaInfo | null {
  if (mmr == null) return null;
  const valor = Number(mmr);
  if (!Number.isFinite(valor)) return null;
  const faixa =
    MEDALHAS.find((m) => valor >= m.min && valor < m.max) ??
    (valor >= 8000 ? MEDALHAS[MEDALHAS.length - 1] : null);
  if (!faixa) return null;
  const passo = (faixa.max - faixa.min) / faixa.levels;
  const nivel = Math.min(faixa.levels, Math.max(1, Math.floor((valor - faixa.min) / passo) + 1));
  const arquivo =
    faixa.levels === 1 ? `${faixa.imagemBase}.png` : `${faixa.imagemBase}-${nivel}.png`;
  return { nome: faixa.nome, nivel, imagem: `/images/medals/${arquivo}`, cor: faixa.cor };
}

// ─── Config (tabela config) ────────────────────────────────────────────────

const CHAVE_TOKEN = 'overlay_token';
const CHAVE_LIMITE_WINS = 'overlay_wins_ultimas';
const CHAVE_LAYOUT = 'overlay_layout';
const CHAVE_LAYOUT_CENAS = 'overlay_layout_cenas';
const CHAVE_MODO_BOOST = 'overlay_modo_boost';
const CHAVE_SUB_ATIVO = 'overlay_sub_ativo';
const CHAVE_SUB_META = 'overlay_sub_meta';
const CHAVE_SUB_COR = 'overlay_sub_cor';
const CHAVE_SLIDES = 'overlay_slides';
const CHAVE_LIVEPIX_ATIVO = 'overlay_livepix_ativo';
const CHAVE_LIVEPIX_ESTILO = 'overlay_livepix_estilo';
const CHAVE_LIVEPIX_META = 'overlay_livepix_meta';
const CHAVE_TRANSICAO_FOGO = 'overlay_transicao_fogo';

// Imagens enviadas dos patrocinadores (uma pasta própria, como no Marketing).
const SPONSORS_DIR = path.join(process.cwd(), 'public', 'uploads', 'sponsors');

// Token usado na URL da overlay (/overlay?token=...). Gerado uma única vez.
export function getOverlayToken(db: DatabaseSync): string {
  const existente = (getConfigValor(db, CHAVE_TOKEN) ?? '').trim();
  if (/^[a-f0-9]{16,64}$/i.test(existente)) return existente;
  const token = crypto.randomBytes(16).toString('hex');
  setConfigValor(db, CHAVE_TOKEN, token);
  return token;
}

export function getOverlayWinsLimite(db: DatabaseSync): number {
  const valor = Number(getConfigValor(db, CHAVE_LIMITE_WINS));
  if (!Number.isFinite(valor) || valor <= 0) return OVERLAY_WINS_LIMITE_DEFAULT;
  return Math.min(OVERLAY_WINS_LIMITE_MAX, Math.max(OVERLAY_WINS_LIMITE_MIN, Math.round(valor)));
}

export function setOverlayWinsLimite(db: DatabaseSync, valor: unknown): number {
  const n = Math.min(
    OVERLAY_WINS_LIMITE_MAX,
    Math.max(OVERLAY_WINS_LIMITE_MIN, Math.round(Number(valor) || OVERLAY_WINS_LIMITE_DEFAULT))
  );
  setConfigValor(db, CHAVE_LIMITE_WINS, String(n));
  return n;
}

// Modo Boost: exibe a linha medalha inicial -> final + MMRs na overlay.
// Padrão ligado (comportamento anterior); pode ser desligado na Configuração.
export function getOverlayModoBoost(db: DatabaseSync): boolean {
  const valor = (getConfigValor(db, CHAVE_MODO_BOOST) ?? '').trim().toLowerCase();
  if (valor === '') return true;
  return valor === '1' || valor === 'true' || valor === 'on';
}

export function setOverlayModoBoost(db: DatabaseSync, valor: unknown): boolean {
  const ativo = valor === true || valor === 1 || valor === '1' || valor === 'true';
  setConfigValor(db, CHAVE_MODO_BOOST, ativo ? '1' : '0');
  return ativo;
}

// ─── Contador de subs da Twitch ────────────────────────────────────────────

// Padrão desligado: não altera overlays existentes até o usuário configurar.
export function getOverlaySubAtivo(db: DatabaseSync): boolean {
  const valor = (getConfigValor(db, CHAVE_SUB_ATIVO) ?? '').trim().toLowerCase();
  return valor === '1' || valor === 'true' || valor === 'on';
}

export function setOverlaySubAtivo(db: DatabaseSync, valor: unknown): boolean {
  const ativo = valor === true || valor === 1 || valor === '1' || valor === 'true';
  setConfigValor(db, CHAVE_SUB_ATIVO, ativo ? '1' : '0');
  return ativo;
}

// Meta de subs (0 = sem meta; a barra de progresso fica oculta).
export function getOverlaySubMeta(db: DatabaseSync): number {
  const valor = Number(getConfigValor(db, CHAVE_SUB_META));
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.min(OVERLAY_SUB_META_MAX, Math.round(valor));
}

export function setOverlaySubMeta(db: DatabaseSync, valor: unknown): number {
  const n = Math.min(
    OVERLAY_SUB_META_MAX,
    Math.max(OVERLAY_SUB_META_MIN, Math.round(Number(valor) || 0))
  );
  setConfigValor(db, CHAVE_SUB_META, String(n));
  return n;
}

// Cor de destaque do card (faixa superior, rótulo, dot e barra de progresso).
export function getOverlaySubCor(db: DatabaseSync): string {
  return normalizarCorHex(getConfigValor(db, CHAVE_SUB_COR));
}

export function setOverlaySubCor(db: DatabaseSync, valor: unknown): string {
  const cor = normalizarCorHex(valor);
  setConfigValor(db, CHAVE_SUB_COR, cor);
  return cor;
}

// ─── Barra de progresso do LivePix ─────────────────────────────────────────

// Padrão desligado: não altera overlays existentes até o usuário configurar.
export function getOverlayLivepixAtivo(db: DatabaseSync): boolean {
  const valor = (getConfigValor(db, CHAVE_LIVEPIX_ATIVO) ?? '').trim().toLowerCase();
  return valor === '1' || valor === 'true' || valor === 'on';
}

export function setOverlayLivepixAtivo(db: DatabaseSync, valor: unknown): boolean {
  const ativo = valor === true || valor === 1 || valor === '1' || valor === 'true';
  setConfigValor(db, CHAVE_LIVEPIX_ATIVO, ativo ? '1' : '0');
  return ativo;
}

export function getOverlayLivepixEstilo(db: DatabaseSync): EstiloBarraLivepix {
  return normalizarEstiloLivepix(getConfigValor(db, CHAVE_LIVEPIX_ESTILO));
}

export function setOverlayLivepixEstilo(db: DatabaseSync, valor: unknown): EstiloBarraLivepix {
  const estilo = normalizarEstiloLivepix(valor);
  setConfigValor(db, CHAVE_LIVEPIX_ESTILO, estilo);
  return estilo;
}

// Meta da barra em reais (0 = sem meta). Guardada em centavos (inteiro).
export function getOverlayLivepixMeta(db: DatabaseSync): number {
  const centavos = Number(getConfigValor(db, CHAVE_LIVEPIX_META));
  if (!Number.isFinite(centavos) || centavos <= 0) return 0;
  return Math.min(LIVEPIX_META_MAX, centavos / 100);
}

export function setOverlayLivepixMeta(db: DatabaseSync, valor: unknown): number {
  const reais = Math.min(LIVEPIX_META_MAX, Math.max(0, Number(valor) || 0));
  const centavos = Math.round(reais * 100);
  setConfigValor(db, CHAVE_LIVEPIX_META, String(centavos));
  return centavos / 100;
}

// ─── Transição de fogo entre cenas ─────────────────────────────────────────

// Uma única configuração global: a paleta/duração escolhida vale para as
// quatro cenas. Guardada como JSON para não espalhar chaves no config.
export function getOverlayFogo(db: DatabaseSync): FogoOverlayConfig {
  const bruto = getConfigValor(db, CHAVE_TRANSICAO_FOGO);
  if (!bruto) return fogoPadrao();
  try {
    const parsed = JSON.parse(bruto) as Partial<FogoOverlayConfig>;
    return {
      ativo: parsed.ativo === true,
      paleta: normalizarPaletaFogo(parsed.paleta),
      duracaoMs: normalizarDuracaoFogo(parsed.duracaoMs),
    };
  } catch {
    return fogoPadrao();
  }
}

// Aceita atualização parcial (mantém o que não veio no corpo do PUT).
export function setOverlayFogo(db: DatabaseSync, valor: unknown): FogoOverlayConfig {
  const atual = getOverlayFogo(db);
  const bruto = (valor ?? {}) as Partial<FogoOverlayConfig>;
  const config: FogoOverlayConfig = {
    ativo: bruto.ativo === undefined ? atual.ativo : bruto.ativo === true,
    paleta:
      bruto.paleta === undefined ? atual.paleta : normalizarPaletaFogo(bruto.paleta),
    duracaoMs:
      bruto.duracaoMs === undefined
        ? atual.duracaoMs
        : normalizarDuracaoFogo(bruto.duracaoMs),
  };
  setConfigValor(db, CHAVE_TRANSICAO_FOGO, JSON.stringify(config));
  return config;
}

// ─── Carrossel de slides (subs, cupom, patrocinadores, anuncie) ────────────

function textoLimpo(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function duracaoLimpa(v: unknown, padrao: number, min = SLIDE_DURACAO_MIN_MS): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(SLIDE_DURACAO_MAX_MS, Math.max(min, Math.round(n)));
}

// Imagem salva em public/uploads/sponsors: aceita apenas nome de arquivo.
function nomeImagemSeguro(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^[\w][\w.-]{0,120}$/.test(s) ? s : '';
}

function salvarImagemPatrocinador(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (!match) return '';
  const mime = match[1].split('/')[1].toLowerCase();
  const ext = mime === 'jpeg' ? '.jpg' : '.' + mime.replace(/[^a-z0-9]/g, '');
  const nome = `sponsor-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.mkdirSync(SPONSORS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SPONSORS_DIR, nome), Buffer.from(match[2], 'base64'));
  return nome;
}

// Remove imagens de patrocinador em disco que não são mais referenciadas.
function limparUploadsPatrocinadores(referenciadas: Set<string>): void {
  if (!fs.existsSync(SPONSORS_DIR)) return;
  for (const arquivo of fs.readdirSync(SPONSORS_DIR)) {
    if (!referenciadas.has(arquivo)) {
      try {
        fs.unlinkSync(path.join(SPONSORS_DIR, arquivo));
      } catch {
        // ignora falha ao remover
      }
    }
  }
}

// Sanitiza a configuração do carrossel. Com `salvarImagens`, data URLs de
// patrocinadores novos são gravadas em disco e trocadas pelo nome do arquivo.
export function sanitizarSlides(v: unknown, salvarImagens: boolean): SlidesOverlayConfig {
  const padrao = slidesPadrao();
  const l = (v ?? {}) as Record<string, unknown>;

  const ordem: SlidesOverlayConfig['ordem'] = [];
  if (Array.isArray(l.ordem)) {
    for (const t of l.ordem) {
      const tipo = t as TipoSlide;
      if (TIPOS_SLIDE.includes(tipo) && !ordem.includes(tipo)) {
        ordem.push(tipo);
      }
    }
  }
  for (const t of TIPOS_SLIDE) {
    if (!ordem.includes(t)) ordem.push(t);
  }

  const cupomBruto = (l.cupom ?? {}) as Record<string, unknown>;
  const anuncieBruto = (l.anuncie ?? {}) as Record<string, unknown>;

  const idsUsados = new Set<string>();
  const patrocinadores: PatrocinadorOverlay[] = [];
  // Legado: quando a opção era um switch global, vira o padrão dos
  // patrocinadores que ainda não têm a escolha individual salva.
  const esticarLegado = Boolean(l.esticarPatrocinador);
  const listaBruta = Array.isArray(l.patrocinadores) ? l.patrocinadores : [];
  for (const item of listaBruta.slice(0, SLIDES_MAX_PATROCINADORES)) {
    const p = (item ?? {}) as Record<string, unknown>;
    const imagemBruta = typeof p.imagem === 'string' ? p.imagem.trim() : '';
    const imagem = imagemBruta.startsWith('data:')
      ? salvarImagens
        ? salvarImagemPatrocinador(imagemBruta)
        : ''
      : nomeImagemSeguro(imagemBruta);
    if (!imagem) continue;

    let id = typeof p.id === 'string' ? p.id.trim() : '';
    if (!/^[a-z0-9-]{1,40}$/i.test(id) || idsUsados.has(id)) {
      id = `sp-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    }
    idsUsados.add(id);

    patrocinadores.push({
      id,
      nome: textoLimpo(p.nome, 60),
      imagem,
      duracaoMs: duracaoLimpa(p.duracaoMs, SLIDE_DURACAO_PADRAO_PATROCINADOR),
      esticar: p.esticar === undefined ? esticarLegado : Boolean(p.esticar),
      ativo: p.ativo === undefined ? true : Boolean(p.ativo),
    });
  }

  return {
    rotacao: l.rotacao === undefined ? padrao.rotacao : Boolean(l.rotacao),
    modo: l.modo === 'intervalo' ? 'intervalo' : 'seguido',
    intervaloMs: duracaoLimpa(l.intervaloMs, padrao.intervaloMs, 0),
    ordem,
    subsLivepixJuntos: Boolean(l.subsLivepixJuntos),
    subsMs: duracaoLimpa(l.subsMs, padrao.subsMs),
    livepixMs: duracaoLimpa(l.livepixMs, padrao.livepixMs),
    cupomMs: duracaoLimpa(l.cupomMs, padrao.cupomMs),
    anuncieMs: duracaoLimpa(l.anuncieMs, padrao.anuncieMs),
    cupom: {
      ativo: Boolean(cupomBruto.ativo),
      pre:
        typeof cupomBruto.pre === 'string'
          ? textoLimpo(cupomBruto.pre, 80)
          : padrao.cupom.pre,
      codigo: textoLimpo(cupomBruto.codigo, 32),
      pos:
        typeof cupomBruto.pos === 'string' ? textoLimpo(cupomBruto.pos, 80) : padrao.cupom.pos,
    },
    anuncie: {
      ativo: Boolean(anuncieBruto.ativo),
      titulo:
        typeof anuncieBruto.titulo === 'string'
          ? textoLimpo(anuncieBruto.titulo, 60)
          : padrao.anuncie.titulo,
      texto:
        typeof anuncieBruto.texto === 'string'
          ? textoLimpo(anuncieBruto.texto, 120)
          : padrao.anuncie.texto,
      contato: textoLimpo(anuncieBruto.contato, 60),
    },
    patrocinadores,
  };
}

export function getOverlaySlides(db: DatabaseSync): SlidesOverlayConfig {
  const bruto = getConfigValor(db, CHAVE_SLIDES);
  if (!bruto) return slidesPadrao();
  try {
    return sanitizarSlides(JSON.parse(bruto), false);
  } catch {
    return slidesPadrao();
  }
}

export function setOverlaySlides(db: DatabaseSync, valor: unknown): SlidesOverlayConfig {
  const atual = getOverlaySlides(db);
  const patch = (valor ?? {}) as Record<string, unknown>;
  // Mescla por cima da config atual: um PUT parcial (ex.: só a `ordem`)
  // nunca apaga patrocinadores, textos ou tempos já salvos.
  const mesclado: Record<string, unknown> = { ...atual, ...patch };
  if (patch.cupom && typeof patch.cupom === 'object') {
    mesclado.cupom = { ...atual.cupom, ...(patch.cupom as Record<string, unknown>) };
  }
  if (patch.anuncie && typeof patch.anuncie === 'object') {
    mesclado.anuncie = { ...atual.anuncie, ...(patch.anuncie as Record<string, unknown>) };
  }
  const config = sanitizarSlides(mesclado, true);
  setConfigValor(db, CHAVE_SLIDES, JSON.stringify(config));
  limparUploadsPatrocinadores(new Set(config.patrocinadores.map((p) => p.imagem)));
  return config;
}

// ─── Layout (posições/tamanhos salvos no editor) ───────────────────────────

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

function limparMedida(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim().slice(0, 16);
  return /^-?\d+(\.\d+)?(px)?$/.test(s) ? s : '';
}

function sanitizarElemento(v: unknown): LayoutElemento {
  const e = (v ?? {}) as Record<string, unknown>;
  return {
    left: limparMedida(e.left),
    top: limparMedida(e.top),
    width: limparMedida(e.width),
    height: limparMedida(e.height),
    baseWidth: limparMedida(e.baseWidth),
    baseHeight: limparMedida(e.baseHeight),
  };
}

export function sanitizarLayout(v: unknown): LayoutOverlay {
  const l = (v ?? {}) as Record<string, unknown>;
  const layout: LayoutOverlay = { grouped: Boolean(l.grouped) };
  layout.medalWrapper = sanitizarElemento(l.medalWrapper);
  layout.infoBlock = sanitizarElemento(l.infoBlock);
  layout.subCounter = sanitizarElemento(l.subCounter);
  layout.slidesCounter = sanitizarElemento(l.slidesCounter);
  if (l.groupContainer) layout.groupContainer = sanitizarElemento(l.groupContainer);
  return layout;
}

export function getOverlayLayout(db: DatabaseSync): LayoutOverlay | null {
  const bruto = getConfigValor(db, CHAVE_LAYOUT);
  if (!bruto) return null;
  try {
    return sanitizarLayout(JSON.parse(bruto));
  } catch {
    return null;
  }
}

export function getOverlayLayouts(db: DatabaseSync): LayoutsPorCena {
  const bruto = getConfigValor(db, CHAVE_LAYOUT_CENAS);
  if (!bruto) return {};
  try {
    const parsed = JSON.parse(bruto) as Record<string, unknown>;
    const layouts: LayoutsPorCena = {};
    for (const cena of ESTADOS_OVERLAY) {
      const valor = parsed[cena];
      if (valor && typeof valor === 'object') layouts[cena] = sanitizarLayout(valor);
    }
    return layouts;
  } catch {
    return {};
  }
}

export interface EstadoLayoutOverlay {
  estado: EstadoCena | null;
  layout: LayoutOverlay | null;
  fogo: FogoOverlayConfig;
}

// Cena atual + layout correspondente. É leitura pura do banco (nenhuma chamada
// externa), para a overlay consultar em alta frequência e reposicionar os
// elementos no mesmo instante em que a cena troca no OBS. A config da
// transição de fogo viaja junto para a overlay saber se deve animar a troca.
export function estadoLayoutOverlay(
  db: DatabaseSync,
  cenaForcada?: EstadoCena | null
): EstadoLayoutOverlay {
  const estado = cenaForcada ?? resolverEstadoAtual(db);
  const layouts = getOverlayLayouts(db);
  return {
    estado,
    layout: (estado ? layouts[estado] : null) ?? getOverlayLayout(db) ?? null,
    fogo: getOverlayFogo(db),
  };
}

export function setOverlayLayoutCena(
  db: DatabaseSync,
  cena: EstadoCena,
  layout: unknown
): LayoutsPorCena {
  const novos: LayoutsPorCena = { ...getOverlayLayouts(db), [cena]: sanitizarLayout(layout) };
  setConfigValor(db, CHAVE_LAYOUT_CENAS, JSON.stringify(novos));
  return novos;
}

// ─── Contagem de W/L (somente banco local) ─────────────────────────────────

export interface ContagemWins {
  wins: number;
  losses: number;
  total: number;
  limite: number;
}

// Conta vitórias/derrotas das últimas X partidas salvas no banco local.
// Com `accountId`, considera somente as partidas daquela conta (conta logada no
// Dota 2 via GSI ou conta do pedido em exibição na overlay).
export function contarWinsUltimas(
  db: DatabaseSync,
  limite: number,
  accountId?: string | null
): ContagemWins {
  const n = Math.min(
    OVERLAY_WINS_LIMITE_MAX,
    Math.max(OVERLAY_WINS_LIMITE_MIN, Math.round(Number(limite) || OVERLAY_WINS_LIMITE_DEFAULT))
  );
  const conta = String(accountId ?? '').replace(/\D/g, '');
  const rows = (
    conta
      ? db
          .prepare(
            `SELECT resultado FROM partidas
             WHERE accountId = ?
             ORDER BY finalizadaEm DESC, id DESC
             LIMIT ?`
          )
          .all(conta, n)
      : db
          .prepare(
            `SELECT resultado FROM partidas
             ORDER BY finalizadaEm DESC, id DESC
             LIMIT ?`
          )
          .all(n)
  ) as { resultado: string }[];
  const wins = rows.filter((r) => r.resultado === 'W').length;
  return { wins, losses: rows.length - wins, total: rows.length, limite: n };
}

// ─── Pedido exibido na overlay (selecionado no painel) ────────────────────

export async function pedidoDoOverlay(
  db: DatabaseSync
): Promise<PedidoOverlayResumo | null> {
  const trackingId = getPedidoSelecionado(db);
  if (!trackingId) return null;
  return obterPedidoPublicoTheone(trackingId);
}

// ─── Payload da overlay ────────────────────────────────────────────────────

export interface DadosOverlay {
  ativo: boolean;
  atualizadoEm: string;
  estado: EstadoCena | null;
  cenasAtivo: boolean;
  pedido: {
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
  } | null;
  wins: number;
  losses: number;
  limiteWins: number;
  modoBoost: boolean;
  gsi: { online: boolean; contaDetectada: string | null };
  // Conta logada pertence à conta principal de um booster cadastrado: a
  // overlay exibe a medalha/MMR dessa conta (sem pedido).
  booster: {
    id: number;
    nickname: string;
    nome: string;
    mmr: number | null;
    medalha: MedalhaInfo | null;
  } | null;
  layout: LayoutOverlay | null;
  sub: SubOverlayDados;
  slides: SlidesOverlayConfig;
  livepix: LivepixOverlayDados;
  fogo: FogoOverlayConfig;
}

export async function dadosOverlay(
  db: DatabaseSync,
  cenaForcada?: EstadoCena | null
): Promise<DadosOverlay> {
  const gsi = getEstadoGsi();
  const pedido = await pedidoDoOverlay(db);
  const limite = getOverlayWinsLimite(db);
  const contaPedido = pedido?.trackingId ? getContaPedido(db, pedido.trackingId) : '';
  // Sem conta detectada no GSI, usa a conta vinculada ao pedido em exibição.
  const contagem = contarWinsUltimas(db, limite, gsi.accountId || contaPedido || '');
  // Sem partidas locais do GSI, usa o W/L publicado no tracking.
  const wins = contagem.total > 0 ? contagem.wins : pedido?.vitorias ?? 0;
  const losses = contagem.total > 0 ? contagem.losses : pedido?.derrotas ?? 0;
  const { estado, layout, fogo } = estadoLayoutOverlay(db, cenaForcada);
  const subAtivo = getOverlaySubAtivo(db);
  // Só consulta a Twitch quando o contador está ligado. O cache vencido é
  // atualizado em segundo plano (stale-while-revalidate), para o payload não
  // ficar preso atrás da API e o layout chegar rápido na troca de cena.
  const subs = subAtivo
    ? await obterContagemSubs(db)
    : { contagem: null, erro: false };
  const livepixAtivo = getOverlayLivepixAtivo(db);
  // Só consulta a LivePix quando a barra está ligada (mesmo esquema de cache).
  const livepixTotal = livepixAtivo
    ? await obterTotalMesLivepix(db)
    : { total: null, erro: false };
  return {
    ativo: pedido != null,
    atualizadoEm: new Date().toISOString(),
    estado,
    cenasAtivo: getCenasAtivas(db),
    pedido: pedido
      ? {
          id: pedido.id,
          trackingId: pedido.trackingId,
          tipoServico: pedido.tipoServico,
          contaDota: contaPedido || null,
          mmrInicial: pedido.mmrInicial,
          mmrAtual: pedido.mmrAtual,
          mmrFinal: pedido.mmrFinal,
          medalhaAtual: medalhaDoMmr(pedido.mmrAtual),
          medalhaInicial: medalhaDoMmr(pedido.mmrInicial),
          medalhaFinal: medalhaDoMmr(pedido.mmrFinal),
        }
      : null,
    wins,
    losses,
    limiteWins: limite,
    modoBoost: getOverlayModoBoost(db),
    gsi: { online: gsi.online, contaDetectada: gsi.accountId },
    booster: null,
    layout,
    sub: {
      ativo: subAtivo,
      contagem: subs.contagem,
      meta: getOverlaySubMeta(db),
      cor: getOverlaySubCor(db),
      erro: subs.erro,
    },
    slides: getOverlaySlides(db),
    livepix: {
      ativo: livepixAtivo,
      estilo: getOverlayLivepixEstilo(db),
      meta: getOverlayLivepixMeta(db),
      total: livepixTotal.total,
      mes: nomeMesAtual(),
      erro: livepixTotal.erro,
    },
    fogo,
  };
}
