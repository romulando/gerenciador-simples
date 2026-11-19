'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from 'react';
import {
  ArrowLeft,
  Check,
  Coffee,
  Gamepad2,
  Home,
  Layers,
  List,
  RotateCcw,
  Save,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { btnPrimary, btnSecondary, buscarJson } from '@/components/pedidos/common';
import OverlayVisual from '@/components/stream-overlay/OverlayVisual';
import PainelCarrossel from '@/components/stream-overlay/PainelCarrossel';
import {
  BASE_GRUPO_H,
  BASE_GRUPO_W,
  BASE_INFO_H,
  BASE_INFO_W,
  BASE_MEDALHA_H,
  BASE_MEDALHA_W,
  BASE_SLIDES_H,
  BASE_SLIDES_W,
  CANVAS_ALTURA,
  CANVAS_LARGURA,
  ESTILOS_BARRA_LIVEPIX,
  SUB_COR_DEFAULT,
  baseProgresso,
  fatorFit,
  slidesTemItens,
  type DadosOverlay,
  type ElementoOverlay,
  type EstadoCena,
  type EstiloBarraLivepix,
  type LayoutElemento,
  type LayoutOverlay,
  type LayoutsPorCena,
  type RespostaPainelOverlay,
} from '@/components/stream-overlay/common';

const ABAS_CENA: { estado: EstadoCena; rotulo: string; Icone: LucideIcon }[] = [
  { estado: 'menu', rotulo: 'Menu', Icone: Home },
  { estado: 'draft', rotulo: 'Draft', Icone: List },
  { estado: 'game', rotulo: 'Jogando', Icone: Gamepad2 },
  { estado: 'descanso', rotulo: 'Descanso', Icone: Coffee },
];

// Elementos que convivem no modo separado (colisão entre eles).
const ELEMENTOS_SEPARADOS: readonly ElementoOverlay[] = [
  'medalWrapper',
  'infoBlock',
  'subCounter',
  'slidesCounter',
];
// Com o grupo ligado, o Agrupar vale só para medalha + W/L; o contador de subs
// (com a barra do LivePix) e o carrossel continuam independentes e colidem
// com o grupo.
const ELEMENTOS_AGRUPADOS: readonly ElementoOverlay[] = [
  'groupContainer',
  'subCounter',
  'slidesCounter',
];

function num(v: string | undefined | null, fallback = 0): number {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
}

interface ItemGesto {
  id: ElementoOverlay;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Retangulo {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Gesto {
  tipo: 'mover' | 'redimensionar';
  itens: ItemGesto[];
  inicioX: number;
  inicioY: number;
  aspecto: number;
  // Retângulos dos outros elementos (modo separado): limites para não sobrepor.
  limites?: Retangulo[];
}

interface Marquee {
  x: number;
  y: number;
  w: number;
  h: number;
}

function retanguloDe(layout: LayoutOverlay | null, id: ElementoOverlay): Retangulo | null {
  const el = layout?.[id];
  if (!el) return null;
  const width = num(el.width);
  const height = num(el.height);
  if (width <= 0 || height <= 0) return null;
  return { left: num(el.left), top: num(el.top), width, height };
}

function sobrepoe(
  left: number,
  top: number,
  width: number,
  height: number,
  outro: Retangulo
): boolean {
  return (
    left < outro.left + outro.width &&
    left + width > outro.left &&
    top < outro.top + outro.height &&
    top + height > outro.top
  );
}

// Limites de colisão: movendo 1 elemento de cada vez. Com o grupo ligado,
// colide grupo ↔ subs ↔ carrossel; separado, colide medalha ↔ info ↔ subs ↔
// carrossel. O sub/carrossel só contam quando estão visíveis.
function limitesContraLayout(
  alvo: LayoutOverlay,
  id: ElementoOverlay,
  idsMovidos: ElementoOverlay[],
  subVisivel: boolean,
  slidesVisivel: boolean
): Retangulo[] | undefined {
  if (idsMovidos.length !== 1) return undefined;
  const proprio = retanguloDe(alvo, id);
  if (!proprio) return undefined;
  const candidatos = (alvo.grouped ? ELEMENTOS_AGRUPADOS : ELEMENTOS_SEPARADOS).filter(
    (e) => (e !== 'subCounter' || subVisivel) && (e !== 'slidesCounter' || slidesVisivel)
  );
  const limites: Retangulo[] = [];
  for (const outroId of candidatos) {
    if (outroId === id || idsMovidos.includes(outroId)) continue;
    const outro = retanguloDe(alvo, outroId);
    if (!outro) continue;
    // Já sobrepostos (layout antigo): não trava o gesto; basta separar uma vez.
    if (sobrepoe(proprio.left, proprio.top, proprio.width, proprio.height, outro)) {
      return undefined;
    }
    limites.push(outro);
  }
  return limites.length > 0 ? limites : undefined;
}

// Mantém a moldura de um card justa: corrige uma base medida com o wrapper
// esticado (bug antigo) e acompanha a altura natural (ex.: meta do contador
// ligada/desligada), sem nunca passar do canvas 1920x1080.
function useAjustarMolduraCard({
  id,
  seletor,
  ativo,
  baseW,
  baseH,
  layout,
  escala,
  cena,
  canvasRef,
  setLayouts,
}: {
  id: ElementoOverlay;
  seletor: string;
  ativo: boolean;
  baseW: number;
  baseH: number;
  layout: LayoutOverlay | null;
  escala: number;
  cena: EstadoCena;
  canvasRef: RefObject<HTMLDivElement | null>;
  setLayouts: Dispatch<SetStateAction<LayoutsPorCena>>;
}) {
  useLayoutEffect(() => {
    if (!layout || escala <= 0 || !ativo) return;
    const el = layout[id];
    if (!el?.left || num(el.baseWidth) <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const card = canvas.querySelector<HTMLElement>(seletor);
    if (!card) return;

    const es = fatorFit(el, baseW, baseH);
    if (es <= 0) return;
    const rect = card.getBoundingClientRect();
    const naturalW = Math.round(rect.width / escala / es);
    const naturalH = Math.round(rect.height / escala / es);
    if (naturalW <= 0 || naturalH <= 0) return;

    const baseWidth = num(el.baseWidth);
    const baseHeight = num(el.baseHeight);
    const poluida = Math.abs(baseWidth - naturalW) > 8;
    const alturaMudou = baseHeight > 0 && Math.abs(baseHeight - naturalH) > 8;
    if (!poluida && !alturaMudou) return;

    setLayouts((atual) => {
      const alvo = atual[cena];
      if (!alvo?.[id]) return atual;
      const item = alvo[id];
      // Base poluída (largura ≠ natural): reencaixa no tamanho natural; caso
      // contrário, só a altura muda, mantendo a escala.
      const largura = poluida ? naturalW : num(item.width) || naturalW;
      const altura = poluida ? naturalH : Math.round(largura * (naturalH / naturalW));
      const pos = limitarAoCanvas(num(item.left), num(item.top), largura, altura);
      return {
        ...atual,
        [cena]: {
          ...alvo,
          [id]: {
            ...item,
            left: `${Math.round(pos.left)}px`,
            top: `${Math.round(pos.top)}px`,
            width: `${largura}px`,
            height: `${altura}px`,
            baseWidth: `${naturalW}px`,
            baseHeight: `${naturalH}px`,
          },
        },
      };
    });
  }, [id, seletor, ativo, baseW, baseH, layout, escala, cena, canvasRef, setLayouts]);
}

// Limita o movimento para encostar na borda do outro sem sobrepor. O lado de
// onde o arrasto vem define o eixo travado; dá para deslizar na borda e
// contornar o canto, mas nunca atravessar.
function limitarMovimentoUm(
  inicio: Retangulo,
  outro: Retangulo,
  left: number,
  top: number,
  dx: number,
  dy: number
): { left: number; top: number } {
  if (!sobrepoe(left, top, inicio.width, inicio.height, outro)) return { left, top };

  const veioDeCimaOuBaixo =
    inicio.top + inicio.height <= outro.top || inicio.top >= outro.top + outro.height;
  let x = left;
  let y = top;
  if (veioDeCimaOuBaixo) {
    if (dy > 0) y = Math.min(y, outro.top - inicio.height);
    else if (dy < 0) y = Math.max(y, outro.top + outro.height);
    else if (dx > 0) x = Math.min(x, outro.left - inicio.width);
    else if (dx < 0) x = Math.max(x, outro.left + outro.width);
  } else {
    if (dx > 0) x = Math.min(x, outro.left - inicio.width);
    else if (dx < 0) x = Math.max(x, outro.left + outro.width);
    else if (dy > 0) y = Math.min(y, outro.top - inicio.height);
    else if (dy < 0) y = Math.max(y, outro.top + outro.height);
  }
  return { left: x, top: y };
}

// Aplica o limite contra todos os outros elementos (modo separado).
function limitarMovimento(
  inicio: Retangulo,
  outros: Retangulo[],
  left: number,
  top: number,
  dx: number,
  dy: number
): { left: number; top: number } {
  let x = left;
  let y = top;
  for (const outro of outros) {
    ({ left: x, top: y } = limitarMovimentoUm(inicio, outro, x, y, dx, dy));
  }
  return { left: x, top: y };
}

// Limita o redimensionamento (canto inferior direito) para o retângulo não
// cruzar o outro: para no encosto, inclusive ao chegar no canto dele.
function limitarRedimensionamentoUm(
  inicio: Retangulo,
  outro: Retangulo,
  largura: number,
  altura: number
): { largura: number; altura: number } {
  if (!sobrepoe(inicio.left, inicio.top, largura, altura, outro)) {
    return { largura, altura };
  }
  let w = largura;
  let h = altura;
  if (w > inicio.width && outro.left >= inicio.left) {
    w = Math.min(w, outro.left - inicio.left);
  }
  if (h > inicio.height && outro.top >= inicio.top) {
    h = Math.min(h, outro.top - inicio.top);
  }
  if (sobrepoe(inicio.left, inicio.top, w, h, outro)) {
    // Elementos separados não chegam aqui; trava no tamanho atual por segurança.
    w = inicio.width;
    h = inicio.height;
  }
  return { largura: w, altura: h };
}

function limitarRedimensionamento(
  inicio: Retangulo,
  outros: Retangulo[],
  largura: number,
  altura: number
): { largura: number; altura: number } {
  let w = largura;
  let h = altura;
  for (const outro of outros) {
    ({ largura: w, altura: h } = limitarRedimensionamentoUm(inicio, outro, w, h));
  }
  return { largura: w, altura: h };
}

// Mantém o elemento dentro do canvas 1920x1080 (posição).
function limitarAoCanvas(
  left: number,
  top: number,
  width: number,
  height: number
): { left: number; top: number } {
  return {
    left: Math.min(Math.max(0, left), Math.max(0, CANVAS_LARGURA - width)),
    top: Math.min(Math.max(0, top), Math.max(0, CANVAS_ALTURA - height)),
  };
}

// Mantém o redimensionamento dentro do canvas (canto inferior direito).
function limitarTamanhoAoCanvas(
  left: number,
  top: number,
  largura: number,
  altura: number
): { largura: number; altura: number } {
  return {
    largura: Math.max(40, Math.min(largura, CANVAS_LARGURA - left)),
    altura: Math.max(30, Math.min(altura, CANVAS_ALTURA - top)),
  };
}

// Limita o deslocamento de um conjunto de itens para que NENHUM cruze a borda
// do canvas (preserva o arranjo da seleção múltipla).
function limitarDeslocamentoAoCanvas(
  itens: ItemGesto[],
  dx: number,
  dy: number
): { dx: number; dy: number } {
  let deslocX = dx;
  let deslocY = dy;
  for (const item of itens) {
    if (item.width <= 0 || item.height <= 0) continue;
    const maxX = Math.max(0, CANVAS_LARGURA - item.width);
    const maxY = Math.max(0, CANVAS_ALTURA - item.height);
    deslocX = Math.min(Math.max(deslocX, -item.left), maxX - item.left);
    deslocY = Math.min(Math.max(deslocY, -item.top), maxY - item.top);
  }
  return { dx: deslocX, dy: deslocY };
}

export default function EditarOverlayPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);
  const [layouts, setLayouts] = useState<LayoutsPorCena>({});
  const [cena, setCena] = useState<EstadoCena>('game');
  const layout = layouts[cena] ?? null;
  const [dados, setDados] = useState<DadosOverlay | null>(null);
  // O card do contador de subs aparece também quando só a barra do LivePix
  // está ligada; o carrossel só ocupa espaço quando tem slide ativo.
  const subVisivel = Boolean(dados?.sub.ativo) || Boolean(dados?.livepix?.ativo);
  const slidesVisivel = slidesTemItens(dados?.slides);
  // O design (Clássica/Vidro) vale para todo o card de progresso (contador de
  // subs e barra do LivePix) e define a proporção natural da moldura. No modo
  // junto, a moldura considera os dois cards empilhados.
  const estiloLivepix = dados?.livepix.estilo ?? 'classic';
  const juntosProgresso = Boolean(dados?.slides?.subsLivepixJuntos);
  const qtdProgresso =
    Number(Boolean(dados?.sub?.ativo)) + Number(Boolean(dados?.livepix?.ativo));
  const baseProgressoAtual = baseProgresso(estiloLivepix, juntosProgresso, qtdProgresso);
  const [selecionados, setSelecionados] = useState<ElementoOverlay[]>([]);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const gestoRef = useRef<Gesto | null>(null);
  const undoRef = useRef<LayoutsPorCena[]>([]);
  const materializadoRef = useRef<Set<EstadoCena>>(new Set());
  const iniciadoRef = useRef(false);
  // Cor/estilo escolhidos no seletor ainda não salvos (aplicados no Salvar).
  const corPendenteRef = useRef<string | null>(null);
  const estiloPendenteRef = useRef<EstiloBarraLivepix | null>(null);
  // Frames copiados com Ctrl+C (posição + tamanho) para colar com Ctrl+V no
  // mesmo elemento em outra cena; e o aviso flutuante de feedback.
  const areaTransferenciaRef = useRef<{ id: ElementoOverlay; elemento: LayoutElemento }[]>([]);
  const layoutsRef = useRef<LayoutsPorCena>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mantém um ref com o estado mais recente dos layouts (os atalhos de teclado
  // e o pushUndo são registrados uma vez e não podem enxergar closures antigas).
  useEffect(() => {
    layoutsRef.current = layouts;
  });

  useEffect(
    () => () => {
      if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    },
    []
  );

  // Escala o canvas 1920x1080 para caber no container
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calcular = () => setEscala(Math.max(0.1, el.clientWidth / CANVAS_LARGURA));
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Carga inicial: layout salvo + dados atuais (para a prévia)
  const carregar = useCallback(async () => {
    const [layoutResp, painelResp] = await Promise.all([
      buscarJson<{ layout: LayoutOverlay | null; layouts: LayoutsPorCena }>(
        '/api/overlay/layout'
      ),
      buscarJson<RespostaPainelOverlay>('/api/overlay/painel'),
    ]);
    if (!iniciadoRef.current) {
      iniciadoRef.current = true;
      const base = layoutResp.layout ?? { grouped: false };
      const iniciais: LayoutsPorCena = {};
      for (const aba of ABAS_CENA) iniciais[aba.estado] = layoutResp.layouts[aba.estado] ?? base;
      setLayouts(iniciais);
      setCena(painelResp.dados.estado ?? 'game');
    }
    setDados(() => {
      let novos = painelResp.dados;
      // O poll não pode descartar escolhas ainda não salvas (cor/estilo).
      const pendente = corPendenteRef.current;
      if (pendente) novos = { ...novos, sub: { ...novos.sub, cor: pendente } };
      const estiloPendente = estiloPendenteRef.current;
      if (estiloPendente) {
        novos = { ...novos, livepix: { ...novos.livepix, estilo: estiloPendente } };
      }
      return novos;
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await carregar();
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
    const t = setInterval(() => {
      carregar().catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [carregar]);

  // Materializa posições/tamanhos atuais dos elementos sem posição salva. O
  // contador de subs (com a barra do LivePix) e o carrossel são sempre
  // elementos independentes (não entram no grupo).
  useLayoutEffect(() => {
    if (!layout || escala <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const medir = (seletor: string): LayoutElemento | null => {
      const el = canvas.querySelector<HTMLElement>(seletor);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const base = canvas.getBoundingClientRect();
      const left = Math.round((rect.left - base.left) / escala);
      const top = Math.round((rect.top - base.top) / escala);
      const width = Math.round(rect.width / escala);
      const height = Math.round(rect.height / escala);
      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        baseWidth: `${width}px`,
        baseHeight: `${height}px`,
      };
    };

    // Posição padrão: à direita do elemento de referência, sem sair do canvas.
    const aDireita = (
      ref: LayoutElemento | null | undefined,
      el: LayoutElemento
    ): LayoutElemento => {
      if (!ref?.left) return el;
      const pos = limitarAoCanvas(
        num(ref.left) + num(ref.width) + 14,
        num(ref.top),
        num(el.width),
        num(el.height)
      );
      return { ...el, left: `${Math.round(pos.left)}px`, top: `${Math.round(pos.top)}px` };
    };

    const faltaBase = layout.grouped
      ? !layout.groupContainer?.left
      : !layout.medalWrapper?.left || !layout.infoBlock?.left;
    const faltaSub = subVisivel && num(layout.subCounter?.baseWidth) <= 0;
    const faltaSlides = slidesVisivel && num(layout.slidesCounter?.baseWidth) <= 0;
    const repetido = materializadoRef.current.has(cena) && !faltaSub && !faltaSlides;
    materializadoRef.current.add(cena);
    if (repetido || (!faltaBase && !faltaSub && !faltaSlides)) return;

    if (layout.grouped) {
      const grupo = faltaBase ? medir('[data-elemento="groupContainer"]') : null;
      const sub = faltaSub ? medir('[data-elemento="subCounter"]') : null;
      const slides = faltaSlides ? medir('[data-elemento="slidesCounter"]') : null;
      if ((faltaBase && !grupo) || (faltaSub && !sub) || (faltaSlides && !slides)) return;
      setLayouts((atual) => {
        const alvo = atual[cena];
        if (!alvo) return atual;
        const novo: LayoutOverlay = { ...alvo };

        if (grupo) {
          const largura = Math.round(num(grupo.width));
          const altura = Math.round(num(grupo.height));
          novo.groupContainer = {
            ...grupo,
            left: `${Math.round((CANVAS_LARGURA - largura) / 2)}px`,
            top: `${Math.round((CANVAS_ALTURA - altura) / 2)}px`,
          };
        }

        if (sub) {
          // Posição padrão: à direita do grupo (ou do info, como fallback).
          const ref = novo.groupContainer?.left
            ? novo.groupContainer
            : novo.infoBlock?.left
              ? novo.infoBlock
              : null;
          novo.subCounter = aDireita(ref, sub);
        }

        if (slides) {
          // Posição padrão: à direita do contador (ou do grupo/info).
          const ref = novo.subCounter?.left
            ? novo.subCounter
            : novo.groupContainer?.left
              ? novo.groupContainer
              : novo.infoBlock?.left
                ? novo.infoBlock
                : null;
          novo.slidesCounter = aDireita(ref, slides);
        }

        return { ...atual, [cena]: novo };
      });
    } else {
      const medalha = faltaBase ? medir('[data-elemento="medalWrapper"]') : null;
      const info = faltaBase ? medir('[data-elemento="infoBlock"]') : null;
      const sub = faltaSub ? medir('[data-elemento="subCounter"]') : null;
      const slides = faltaSlides ? medir('[data-elemento="slidesCounter"]') : null;
      if (
        (faltaBase && (!medalha || !info)) ||
        (faltaSub && !sub) ||
        (faltaSlides && !slides)
      ) {
        return;
      }
      if (!medalha && !info && !sub && !slides) return;
      setLayouts((atual) => {
        const alvo = atual[cena];
        if (!alvo) return atual;
        const novo: LayoutOverlay = {
          ...alvo,
          medalWrapper: medalha ?? alvo.medalWrapper,
          infoBlock: info ?? alvo.infoBlock,
        };
        if (sub) {
          // Posição padrão: à direita do bloco de info.
          novo.subCounter = aDireita(novo.infoBlock, sub);
        }
        if (slides) {
          // Posição padrão: à direita do contador (ou do info).
          const ref = novo.subCounter?.left ? novo.subCounter : novo.infoBlock;
          novo.slidesCounter = aDireita(ref, slides);
        }
        return { ...atual, [cena]: novo };
      });
    }
  }, [layout, escala, cena, subVisivel, slidesVisivel, dados?.slides]);

  // Mantém as molduras dos cards justas: corrige uma base medida com o wrapper
  // esticado (bug antigo) e acompanha a altura natural do contador de subs
  // quando a meta é ligada/desligada na Configuração da Overlay.
  useAjustarMolduraCard({
    id: 'subCounter',
    seletor: '[data-card="subs"]',
    ativo: subVisivel,
    baseW: baseProgressoAtual.w,
    baseH: baseProgressoAtual.h,
    layout,
    escala,
    cena,
    canvasRef,
    setLayouts,
  });
  useAjustarMolduraCard({
    id: 'slidesCounter',
    seletor: '[data-card="slides"]',
    ativo: slidesVisivel,
    baseW: BASE_SLIDES_W,
    baseH: BASE_SLIDES_H,
    layout,
    escala,
    cena,
    canvasRef,
    setLayouts,
  });

  function pushUndo() {
    const atual = layoutsRef.current;
    if (Object.keys(atual).length > 0) {
      undoRef.current.push(JSON.parse(JSON.stringify(atual)) as LayoutsPorCena);
      if (undoRef.current.length > 50) undoRef.current.shift();
    }
  }

  function elementoDe(id: ElementoOverlay): LayoutElemento {
    return layout?.[id] ?? {};
  }

  // Proporção natural do conteúdo (baseWidth/baseHeight): com ela o conteúdo
  // preenche a moldura exatamente, sem sobra de fundo preto.
  const BASE_POR_ELEMENTO: Record<ElementoOverlay, { w: number; h: number }> = {
    medalWrapper: { w: BASE_MEDALHA_W, h: BASE_MEDALHA_H },
    infoBlock: { w: BASE_INFO_W, h: BASE_INFO_H },
    groupContainer: { w: BASE_GRUPO_W, h: BASE_GRUPO_H },
    // O card de progresso segue a proporção do design escolhido.
    subCounter: baseProgressoAtual,
    slidesCounter: { w: BASE_SLIDES_W, h: BASE_SLIDES_H },
  };

  function aspectoOriginal(id: ElementoOverlay): number {
    const el = elementoDe(id);
    const padrao = BASE_POR_ELEMENTO[id];
    const baseW = num(el.baseWidth) || padrao.w;
    const baseH = num(el.baseHeight) || padrao.h;
    return baseW > 0 && baseH > 0 ? baseW / baseH : 1;
  }

  function iniciarGesto(gesto: Gesto) {
    gestoRef.current = gesto;
    const onMove = (ev: PointerEvent) => {
      const g = gestoRef.current;
      if (!g) return;
      const dx = (ev.clientX - g.inicioX) / escala;
      const dy = (ev.clientY - g.inicioY) / escala;
      setLayouts((atual) => {
        const base = atual[cena];
        if (!base) return atual;

        if (g.tipo === 'mover') {
          // Arrasta todos os itens da seleção juntos (sem sobrepor o outro e
          // sem passar da borda do canvas).
          const desloc = limitarDeslocamentoAoCanvas(g.itens, dx, dy);
          const deslocX = desloc.dx;
          const deslocY = desloc.dy;
          const novo = { ...base };
          for (const item of g.itens) {
            const atualEl = novo[item.id] ?? {};
            let left = item.left + deslocX;
            let top = item.top + deslocY;
            if (g.limites) {
              ({ left, top } = limitarMovimento(
                item,
                g.limites,
                left,
                top,
                deslocX,
                deslocY
              ));
            }
            ({ left, top } = limitarAoCanvas(left, top, item.width, item.height));
            novo[item.id] = {
              ...atualEl,
              left: `${Math.round(left)}px`,
              top: `${Math.round(top)}px`,
            };
          }
          return { ...atual, [cena]: novo };
        }

        const item = g.itens[0];
        if (!item) return atual;
        // Os cards de subs/LivePix e do carrossel redimensionam SEMPRE na
        // proporção original (moldura justa ao conteúdo); nos demais, só com
        // Shift.
        const travarAspecto =
          ev.shiftKey || item.id === 'subCounter' || item.id === 'slidesCounter';
        let largura: number;
        let altura: number;
        if (travarAspecto) {
          // Shift: trava na proporção original (eixo dominante do arrasto)
          const sW = (item.width + dx) / item.width;
          const sH = (item.height + dy) / item.height;
          const s = Math.max(0.05, Math.abs(sW - 1) >= Math.abs(sH - 1) ? sW : sH);
          largura = item.width * s;
          altura = largura / g.aspecto;
          if (largura < 40) {
            largura = 40;
            altura = largura / g.aspecto;
          }
          if (altura < 30) {
            altura = 30;
            largura = altura * g.aspecto;
          }
        } else {
          largura = Math.max(40, item.width + dx);
          altura = Math.max(30, item.height + dy);
        }

        if (g.limites) {
          const ajustado = limitarRedimensionamento(item, g.limites, largura, altura);
          if (travarAspecto && (ajustado.largura !== largura || ajustado.altura !== altura)) {
            // Mantém a proporção ao encostar no outro: encolhe os dois eixos.
            const fator = Math.min(
              largura > 0 ? ajustado.largura / largura : 1,
              altura > 0 ? ajustado.altura / altura : 1
            );
            largura = Math.max(40, largura * fator);
            altura = Math.max(30, largura / g.aspecto);
          } else {
            largura = ajustado.largura;
            altura = ajustado.altura;
          }
        }

        // Nunca passa da borda do canvas (canto inferior direito).
        ({ largura, altura } = limitarTamanhoAoCanvas(item.left, item.top, largura, altura));

        // Reencaixa na proporção depois dos limites (borda do canvas/do outro).
        if (travarAspecto) {
          const maxLargura = Math.max(40, CANVAS_LARGURA - item.left);
          const maxAltura = Math.max(30, CANVAS_ALTURA - item.top);
          largura = Math.min(largura, maxLargura, maxAltura * g.aspecto);
          altura = largura / g.aspecto;
        }

        return {
          ...atual,
          [cena]: {
            ...base,
            [item.id]: {
              ...(base[item.id] ?? {}),
              width: `${Math.round(largura)}px`,
              height: `${Math.round(altura)}px`,
            },
          },
        };
      });
    };
    const onUp = () => {
      gestoRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function itensDoGesto(ids: ElementoOverlay[]): ItemGesto[] {
    return ids.map((id) => {
      const el = elementoDe(id);
      return {
        id,
        left: num(el.left),
        top: num(el.top),
        width: num(el.width),
        height: num(el.height),
      };
    });
  }

  function aoPointerDownElemento(id: ElementoOverlay, e: ReactPointerEvent<HTMLElement>) {
    if (!layout) return;
    if (e.button !== 0) return;

    if (e.shiftKey) {
      setSelecionados((atual) =>
        atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
      );
      e.preventDefault();
      return;
    }

    // Se o elemento já faz parte da seleção, arrasta a seleção inteira.
    const ids = selecionados.includes(id) ? selecionados : [id];
    setSelecionados(ids);
    pushUndo();
    iniciarGesto({
      tipo: 'mover',
      itens: itensDoGesto(ids),
      inicioX: e.clientX,
      inicioY: e.clientY,
      aspecto: 1,
      limites: layout
        ? limitesContraLayout(layout, id, ids, subVisivel, slidesVisivel)
        : undefined,
    });
    e.preventDefault();
  }

  function aoPointerDownHandle(id: ElementoOverlay, e: ReactPointerEvent<HTMLElement>) {
    if (!layout) return;
    setSelecionados([id]);
    const el = elementoDe(id);
    pushUndo();
    iniciarGesto({
      tipo: 'redimensionar',
      itens: [
        {
          id,
          left: num(el.left),
          top: num(el.top),
          width: num(el.width, 100),
          height: num(el.height, 50),
        },
      ],
      inicioX: e.clientX,
      inicioY: e.clientY,
      aspecto: aspectoOriginal(id),
      limites: limitesContraLayout(layout, id, [id], subVisivel, slidesVisivel),
    });
  }

  // Traçado de seleção: arrastar no fundo do canvas seleciona os elementos
  // que o retângulo cruzar (Shift soma à seleção atual).
  function aoPointerDownCanvas(e: ReactPointerEvent<HTMLDivElement>) {
    if (!layout) return;
    if (e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest('[data-elemento]') || alvo.closest('[data-handle]')) return;

    const canvas = canvasRef.current;
    if (!canvas || escala <= 0) return;
    const base = canvas.getBoundingClientRect();
    const inicioX = (e.clientX - base.left) / escala;
    const inicioY = (e.clientY - base.top) / escala;
    const soma = e.shiftKey;
    if (!soma) setSelecionados([]);

    const caixa = (clientX: number, clientY: number): Marquee => {
      const x = (clientX - base.left) / escala;
      const y = (clientY - base.top) / escala;
      return {
        x: Math.min(inicioX, x),
        y: Math.min(inicioY, y),
        w: Math.abs(x - inicioX),
        h: Math.abs(y - inicioY),
      };
    };

    const onMove = (ev: PointerEvent) => setMarquee(caixa(ev.clientX, ev.clientY));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMarquee(null);

      const fim = caixa(ev.clientX, ev.clientY);
      if (fim.w < 4 && fim.h < 4) return; // clique simples: seleção já foi limpa acima

      const acertos: ElementoOverlay[] = [];
      canvas.querySelectorAll<HTMLElement>('[data-elemento]').forEach((el) => {
        const id = el.dataset.elemento as ElementoOverlay | undefined;
        if (!id) return;
        const r = el.getBoundingClientRect();
        const l = (r.left - base.left) / escala;
        const t = (r.top - base.top) / escala;
        const rr = (r.right - base.left) / escala;
        const bb = (r.bottom - base.top) / escala;
        if (l < fim.x + fim.w && rr > fim.x && t < fim.y + fim.h && bb > fim.y) {
          acertos.push(id);
        }
      });

      setSelecionados((atual) => {
        if (!soma) return acertos;
        const novo = [...atual];
        for (const id of acertos) if (!novo.includes(id)) novo.push(id);
        return novo;
      });
    };

    setMarquee({ x: inicioX, y: inicioY, w: 0, h: 0 });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    e.preventDefault();
  }

  function alternarGrupo() {
    if (!layout) return;
    pushUndo();
    setSelecionados([]);
    if (layout.grouped) {
      // Separar: o sub mantém a posição própria (nunca fez parte do grupo).
      setLayouts((atual) => {
        const alvo = atual[cena];
        if (!alvo) return atual;
        return { ...atual, [cena]: { ...alvo, grouped: false } };
      });
      return;
    }
    // Agrupa medindo o conteúdo natural (fundo justo) e centraliza no canvas.
    materializadoRef.current.delete(cena);
    setLayouts((atual) => {
      const alvo = atual[cena];
      if (!alvo) return atual;
      return {
        ...atual,
        [cena]: {
          grouped: true,
          medalWrapper: alvo.medalWrapper,
          infoBlock: alvo.infoBlock,
          subCounter: alvo.subCounter,
          groupContainer: {},
        },
      };
    });
    setSelecionados(['groupContainer']);
  }

  function restaurarPadrao() {
    pushUndo();
    materializadoRef.current.delete(cena);
    setSelecionados([]);
    setLayouts((atual) => {
      const alvo = atual[cena];
      if (!alvo) return atual;
      return { ...atual, [cena]: { grouped: false } };
    });
  }

  function trocarCena(nova: EstadoCena) {
    setCena(nova);
    setSelecionados([]);
    setMarquee(null);
  }

  // Cor de destaque (contador, carrossel e barra do LivePix) e design do card
  // de progresso: globais (todas as cenas). Os seletores só aplicam na prévia;
  // a gravação acontece no botão Salvar.
  const corSubs = dados?.sub.cor ?? SUB_COR_DEFAULT;

  function alterarCorSubs(nova: string) {
    corPendenteRef.current = nova;
    setDados((atual) => (atual ? { ...atual, sub: { ...atual.sub, cor: nova } } : atual));
  }

  function alterarEstiloLivepix(novo: EstiloBarraLivepix) {
    estiloPendenteRef.current = novo;
    setDados((atual) =>
      atual ? { ...atual, livepix: { ...atual.livepix, estilo: novo } } : atual
    );
  }

  function mostrarAviso(texto: string) {
    setAviso(texto);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(null), 2200);
  }

  // Atalhos: Ctrl+Z desfaz; Ctrl+C/Ctrl+V copiam/colam o frame entre cenas;
  // setas movem o selecionado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const anterior = undoRef.current.pop();
        if (anterior) setLayouts(anterior);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selecionados.length === 0) return;
        e.preventDefault();
        const base = layoutsRef.current[cena] ?? null;
        areaTransferenciaRef.current = selecionados.map((id) => ({
          id,
          elemento: { ...(base?.[id] ?? {}) },
        }));
        mostrarAviso(
          selecionados.length === 1
            ? 'Coordenadas copiadas'
            : `Coordenadas de ${selecionados.length} elementos copiadas`
        );
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const copiados = areaTransferenciaRef.current;
        if (copiados.length === 0) return;
        e.preventDefault();
        pushUndo();
        setLayouts((atual) => {
          const base = atual[cena];
          if (!base) return atual;
          const novo = { ...base };
          for (const item of copiados) {
            novo[item.id] = { ...(novo[item.id] ?? {}), ...item.elemento };
          }
          return { ...atual, [cena]: novo };
        });
        setSelecionados(copiados.map((c) => c.id));
        mostrarAviso(
          copiados.length === 1
            ? 'Coordenadas coladas'
            : `Coordenadas de ${copiados.length} elementos coladas`
        );
        return;
      }
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if ((dx !== 0 || dy !== 0) && selecionados.length > 0) {
        e.preventDefault();
        setLayouts((atual) => {
          const base = atual[cena];
          if (!base) return atual;
          const novo = { ...base };
          const itens: ItemGesto[] = selecionados.map((id) => {
            const el = novo[id] ?? {};
            return {
              id,
              left: num(el.left),
              top: num(el.top),
              width: num(el.width),
              height: num(el.height),
            };
          });
          const desloc = limitarDeslocamentoAoCanvas(itens, dx, dy);
          for (const item of itens) {
            const el = novo[item.id] ?? {};
            let left = item.left + desloc.dx;
            let top = item.top + desloc.dy;
            if (selecionados.length === 1) {
              const proprio = retanguloDe(base, item.id);
              const limites = limitesContraLayout(
                base,
                item.id,
                [item.id],
                subVisivel,
                slidesVisivel
              );
              if (proprio && limites) {
                ({ left, top } = limitarMovimento(
                  proprio,
                  limites,
                  left,
                  top,
                  desloc.dx,
                  desloc.dy
                ));
              }
              ({ left, top } = limitarAoCanvas(left, top, item.width, item.height));
            }
            novo[item.id] = {
              ...el,
              left: `${Math.round(left)}px`,
              top: `${Math.round(top)}px`,
            };
          }
          return { ...atual, [cena]: novo };
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecionados, cena, subVisivel, slidesVisivel]);

  async function salvar() {
    if (!layout) return;
    setSalvando(true);
    setErro('');
    try {
      await buscarJson('/api/overlay/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cena, layout }),
      });
      // A cor e o estilo da barra do LivePix são globais e também só gravam
      // ao clicar em Salvar.
      const corPendente = corPendenteRef.current;
      const estiloPendente = estiloPendenteRef.current;
      if (corPendente || estiloPendente) {
        await buscarJson('/api/overlay/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(corPendente ? { subCor: corPendente } : {}),
            ...(estiloPendente ? { livepixEstilo: estiloPendente } : {}),
          }),
        });
        corPendenteRef.current = null;
        estiloPendenteRef.current = null;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Editar Overlay</h1>
          <p className="text-sm text-gray-500">
            Arraste e redimensione os elementos no canvas 1920×1080 — cada cena tem posições
            próprias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/stream-overlay" className={btnSecondary}>
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </span>
          </Link>
          <button className={btnSecondary} onClick={() => alternarGrupo()} disabled={!layout}>
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              {layout?.grouped ? 'Separar' : 'Agrupar'}
            </span>
          </button>
          <button
            className={btnSecondary}
            onClick={() => {
              const anterior = undoRef.current.pop();
              if (anterior) setLayouts(anterior);
            }}
            title="Desfazer (Ctrl+Z)"
          >
            <span className="flex items-center gap-1.5">
              <Undo2 className="h-4 w-4" />
              Desfazer
            </span>
          </button>
          <button
            className={btnSecondary}
            onClick={() => restaurarPadrao()}
            disabled={!layout}
            title="Restaurar posições padrão"
          >
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão
            </span>
          </button>
          <label
            className={`${btnSecondary} relative flex cursor-pointer items-center gap-2`}
            title="Cor do card/faixa do contador de subs, do carrossel e da barra do LivePix (vale para todas as cenas; grava no botão Salvar)"
          >
            <span
              className="h-4 w-4 rounded-full border border-white/30"
              style={{ background: corSubs }}
            />
            Cor dos subs
            <input
              type="color"
              value={corSubs}
              onChange={(e) => alterarCorSubs(e.target.value)}
              className="absolute h-0 w-0 opacity-0"
              aria-label="Cor dos subs"
            />
          </label>
          <div
            className={`${btnSecondary} flex items-center !p-1`}
            title="Design do card de progresso (contador de subs e barra do LivePix): Clássica (faixa baixa preta) ou Vidro (card largo) — vale para todas as cenas; grava no botão Salvar"
          >
            {ESTILOS_BARRA_LIVEPIX.map((estilo) => {
              const ativa = estiloLivepix === estilo;
              return (
                <button
                  key={estilo}
                  type="button"
                  onClick={() => alterarEstiloLivepix(estilo)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    ativa ? 'bg-[#e8a020]/20 text-white' : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {estilo === 'classic' ? 'Clássica' : 'Vidro'}
                </button>
              );
            })}
          </div>
          <button className={btnPrimary} onClick={() => void salvar()} disabled={salvando || !layout}>
            <span className="flex items-center gap-1.5">
              {salvo ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {salvando
                ? 'Salvando...'
                : salvo
                  ? 'Salvo!'
                  : `Salvar (${ABAS_CENA.find((a) => a.estado === cena)?.rotulo ?? cena})`}
            </span>
          </button>
        </div>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
        <p className="mb-3 text-xs text-gray-400">
          Cada cena (Menu/Draft/Jogando/Descanso) tem posições próprias — a aba com a bolinha
          verde é a cena no ar no OBS agora. Clique para selecionar; arraste no fundo para desenhar
          um traçado e selecionar tudo que ele cruza. Segure{' '}
          <span className="font-semibold text-gray-200">Shift</span> e clique para
          somar/remover um elemento da seleção — com os dois selecionados, arrastar move os
          dois juntos. Os elementos não se sobrepõem (o movimento para ao encostar na borda do
          outro) nem passam do limite do canvas 1920×1080. O canto inferior direito redimensiona
          e, com <span className="font-semibold text-gray-200">Shift</span> pressionado, mantém a
          proporção original (o fundo acompanha o conteúdo). Setas do teclado ajustam 1px · Ctrl+Z
          desfaz · Ctrl+C/Ctrl+V copiam e colam a posição + tamanho do elemento entre as cenas.
          O botão Salvar grava a cena aberta e aplica na overlay do OBS na hora. O botão
          Agrupar junta apenas a medalha e o W/L; o card de progresso (contador de subs e barra
          do LivePix, alternando ou os dois juntos conforme o painel abaixo) e o carrossel são
          elementos independentes (fora do grupo) e redimensionam sempre na proporção do design
          (Clássica = faixa baixa; Vidro = card largo). A cor é global e muda pelo seletor “Cor
          dos subs”; o design do card de progresso muda pelos botões ao lado. Os slides do
          carrossel (cupom, patrocinadores e anuncie aqui), o tempo de cada card e os tempos de
          rotação ficam no painel abaixo do canvas.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {ABAS_CENA.map(({ estado, rotulo, Icone }) => {
            const ativa = cena === estado;
            const noAr = dados?.estado === estado;
            return (
              <button
                key={estado}
                type="button"
                onClick={() => trocarCena(estado)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 ${
                  ativa
                    ? 'border-[#e8a020]/60 bg-[#e8a020]/15 text-white shadow-[0_0_16px_rgba(232,160,32,0.25)]'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Icone className={`h-4 w-4 ${ativa ? 'text-[#e8a020]' : ''}`} />
                {rotulo}
                {noAr && (
                  <span
                    className="h-2 w-2 animate-pulse rounded-full bg-green-400"
                    title="Cena no ar no OBS agora"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-xl border border-[#e8a020]/30 bg-[#0a0c10]"
          style={{ height: CANVAS_ALTURA * escala }}
        >
          <div
            ref={canvasRef}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: CANVAS_LARGURA,
              height: CANVAS_ALTURA,
              transform: `scale(${escala})`,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '96px 54px',
              outline: '2px solid rgba(232,160,32,0.45)',
              outlineOffset: '-2px',
            }}
            onPointerDown={aoPointerDownCanvas}
          >
            <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-white/[0.06]" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-white/[0.06]" />
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#e8a020]">
              {CANVAS_LARGURA} × {CANVAS_ALTURA}
            </span>
            {layout && (
              <OverlayVisual
                dados={dados}
                layout={layout}
                editavel
                selecionados={selecionados}
                onPointerDownElemento={aoPointerDownElemento}
                onPointerDownHandle={aoPointerDownHandle}
              />
            )}
            {marquee && (
              <div
                className="pointer-events-none absolute z-40 border border-[#e8a020] bg-[#e8a020]/10"
                style={{
                  left: marquee.x,
                  top: marquee.y,
                  width: marquee.w,
                  height: marquee.h,
                }}
              />
            )}
          </div>
        </div>
      </section>

      {dados && (
        <PainelCarrossel
          slidesIniciais={dados.slides}
          onSalvo={(slides) => setDados((d) => (d ? { ...d, slides } : d))}
        />
      )}

      {aviso && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-[#e8a020]/40 bg-[#0a0c10]/95 px-4 py-2 text-sm text-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <Check className="h-4 w-4 text-[#e8a020]" />
            {aviso}
          </div>
        </div>
      )}
    </div>
  );
}
