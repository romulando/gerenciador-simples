'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  BASE_GRUPO_H,
  BASE_GRUPO_W,
  BASE_INFO_H,
  BASE_INFO_W,
  BASE_MEDALHA_H,
  BASE_MEDALHA_W,
  BASE_PROGRESSO_CLASSIC_H,
  BASE_PROGRESSO_GLASS_H,
  BASE_PROGRESSO_W,
  BASE_SLIDES_H,
  BASE_SLIDES_W,
  CANVAS_ALTURA,
  CANVAS_LARGURA,
  DadosOverlay,
  ElementoOverlay,
  LayoutElemento,
  LayoutOverlay,
  LIVEPIX_TITULO,
  PROGRESSO_JUNTOS_GAP,
  MedalhaInfo,
  SUB_COR_DEFAULT,
  TEXTO_OVERLAY_SOMBRA,
  TipoSlide,
  baseProgresso,
  corComAlfa,
  fatorFit,
  medida,
  slidesPadrao,
  slidesTemItens,
  urlImagemPatrocinador,
} from './common';

interface OverlayVisualProps {
  dados: DadosOverlay | null;
  layout?: LayoutOverlay | null;
  editavel?: boolean;
  selecionados?: ElementoOverlay[];
  onPointerDownElemento?: (id: ElementoOverlay, e: ReactPointerEvent<HTMLElement>) => void;
  onPointerDownHandle?: (id: ElementoOverlay, e: ReactPointerEvent<HTMLElement>) => void;
}

function estiloWrapper(el: LayoutElemento | null | undefined): CSSProperties | undefined {
  if (!el) return undefined;
  if (!el.left && !el.top && !el.width && !el.height) return undefined;
  // Posições antigas fora do canvas são trazidas para dentro da borda.
  let left = el.left || undefined;
  let top = el.top || undefined;
  const largura = medida(el.width);
  const altura = medida(el.height);
  if (left && largura > 0) {
    const n = Math.min(Math.max(0, medida(left)), Math.max(0, CANVAS_LARGURA - largura));
    left = `${Math.round(n)}px`;
  }
  if (top && altura > 0) {
    const n = Math.min(Math.max(0, medida(top)), Math.max(0, CANVAS_ALTURA - altura));
    top = `${Math.round(n)}px`;
  }
  return {
    position: 'absolute',
    left,
    top,
    width: el.width || undefined,
    height: el.height || undefined,
  };
}

function ChromeEdicao({
  id,
  visivel,
  onPointerDownHandle,
}: {
  id: ElementoOverlay;
  visivel?: boolean;
  onPointerDownHandle?: OverlayVisualProps['onPointerDownHandle'];
}) {
  if (!visivel) return null;
  return (
    <span
      data-handle
      title="Redimensionar"
      className="absolute -bottom-0.5 -right-0.5 z-30 h-5 w-5 cursor-nwse-resize rounded-tl-lg border border-black/70 bg-[#e8a020] after:absolute after:bottom-1 after:right-1 after:h-2 after:w-2 after:border-b-2 after:border-r-2 after:border-black/80"
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDownHandle?.(id, e);
      }}
    />
  );
}

const ORDEM_MEDALHAS: readonly string[] = [
  'Arauto',
  'Guardião',
  'Cruzado',
  'Arconte',
  'Lenda',
  'Ancião',
  'Divino',
  'Imortal',
];

function rankMedalha(medalha: MedalhaInfo | null | undefined): number | null {
  if (!medalha) return null;
  const indice = ORDEM_MEDALHAS.indexOf(medalha.nome);
  if (indice === -1) return null;
  return indice * 5 + medalha.nivel;
}

function ConteudoMedalha({
  dados,
  escala,
  preencher = true,
}: {
  dados: DadosOverlay | null;
  escala: number;
  preencher?: boolean;
}) {
  const pedido = dados?.pedido ?? null;
  // Sem pedido vinculado, a conta detectada pode ser a principal de um booster:
  // exibe a medalha/MMR cadastrados para ela.
  const booster = pedido ? null : dados?.booster ?? null;
  const medalha = pedido?.medalhaAtual ?? booster?.medalha ?? null;
  const mmr = pedido?.mmrAtual ?? booster?.mmr ?? null;

  const [animMedalha, setAnimMedalha] = useState<'enter-down' | 'enter-up' | 'idle'>('idle');
  const rankAnteriorRef = useRef<number | null>(null);

  useEffect(() => {
    const rankAtual = rankMedalha(medalha);
    const rankAnterior = rankAnteriorRef.current;
    rankAnteriorRef.current = rankAtual;
    if (rankAtual == null || rankAnterior == null || rankAtual === rankAnterior) return;
    setAnimMedalha(rankAtual > rankAnterior ? 'enter-down' : 'enter-up');
    const t = setTimeout(() => setAnimMedalha('idle'), 400);
    return () => clearTimeout(t);
  }, [medalha]);

  return (
    <div
      className={`flex flex-col items-center justify-center bg-black/50 ${
        preencher ? 'h-full w-full' : ''
      }`}
      style={{ padding: `${2 * escala}px ${8 * escala}px` }}
    >
      <img
        key={medalha?.imagem ?? 'sem-medalha'}
        src={medalha?.imagem ?? '/images/medals/Unrank.png'}
        alt="Medalha"
        draggable={false}
        className={`shrink-0 object-contain ${
          animMedalha === 'enter-down'
            ? 'medal-enter-down'
            : animMedalha === 'enter-up'
              ? 'medal-enter-up'
              : ''
        }`}
        style={{ width: 72 * escala, height: 72 * escala }}
      />
      {mmr != null && (
        <span
          className="whitespace-nowrap font-semibold"
          style={{
            fontSize: 11 * escala,
            letterSpacing: 0.5 * escala,
            color: '#fff',
            textShadow: TEXTO_OVERLAY_SOMBRA,
          }}
        >
          {mmr} MMR
        </span>
      )}
    </div>
  );
}

function ConteudoInfo({
  dados,
  escala,
  preencher = true,
}: {
  dados: DadosOverlay | null;
  escala: number;
  preencher?: boolean;
}) {
  const wins = dados?.wins ?? 0;
  const losses = dados?.losses ?? 0;
  const pedido = dados?.pedido ?? null;
  // Modo Boost ligado (Configuração da Overlay) -> exibe medalha inicial -> final.
  const mostrarProgresso =
    Boolean(dados?.modoBoost) &&
    pedido != null &&
    (pedido.mmrInicial != null || pedido.mmrFinal != null);
  return (
    <div
      className={`flex flex-col justify-start bg-black/50 ${
        preencher ? 'h-full w-full' : ''
      }`}
      style={{ padding: `${6 * escala}px ${8 * escala}px`, rowGap: 1 * escala }}
    >
      <div
        className="flex whitespace-nowrap font-semibold leading-tight"
        style={{ fontSize: 15 * escala, columnGap: 12 * escala, textShadow: TEXTO_OVERLAY_SOMBRA }}
      >
        <span className="text-[lightgreen]">
          <span className="text-white">{wins}</span>W
        </span>
        <span className="text-[lightcoral]">
          <span className="text-white">{losses}</span>L
        </span>
      </div>
      {mostrarProgresso && (
        <div
          className="flex flex-nowrap items-center whitespace-nowrap"
          style={{ columnGap: 4 * escala, textShadow: TEXTO_OVERLAY_SOMBRA }}
        >
          {pedido.medalhaInicial && (
            <img
              src={pedido.medalhaInicial.imagem}
              alt={pedido.medalhaInicial.nome}
              draggable={false}
              className="shrink-0 object-contain"
              style={{ height: 36 * escala, width: 'auto' }}
            />
          )}
          <span className="font-semibold text-white" style={{ fontSize: 12 * escala }}>
            {pedido.mmrInicial ?? '—'}
          </span>
          <ArrowRight
            className="shrink-0 text-[#e8a020]"
            style={{ width: 14 * escala, height: 14 * escala }}
          />
          {pedido.medalhaFinal && (
            <img
              src={pedido.medalhaFinal.imagem}
              alt={pedido.medalhaFinal.nome}
              draggable={false}
              className="shrink-0 object-contain"
              style={{ height: 36 * escala, width: 'auto' }}
            />
          )}
          <span className="font-semibold text-white" style={{ fontSize: 12 * escala }}>
            {pedido.mmrFinal ?? '—'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Contador de subs + barra do LivePix (mesmo card, alternam) ────────────
// O contador de subs saiu do carrossel: ele e a barra de progresso do LivePix
// dividem o mesmo card (mesmo elemento/layout), cada um com sua duração. A cor
// configurada tinge o card, a faixa e a barra (no design Clássica o fundo é a
// faixa preta opaca; no Vidro, os dois usam o mesmo fundo translúcido).
// O carrossel (cupom, patrocinadores e anuncie) virou o elemento independente
// `slidesCounter`.

interface SlideDef {
  chave: string;
  tipo: TipoSlide;
  duracaoMs: number;
  imagem?: string;
  esticar?: boolean;
}

const TRANSICAO_CARROSSEL_MS = 600;

type ItemSubsLivepix = 'subs' | 'livepix';

function fmtValor(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
}

// Widget de progresso do card: serve tanto o contador de subs (Twitch) quanto a
// barra do LivePix, nos dois designs do HTML de referência — clássica (faixa
// preta 450x36 com preenchimento na cor) e vidro (card 450x105 com acento).
// No vidro, os dois widgets usam o mesmo fundo translúcido com blur; só a
// clássica permanece com a faixa preta opaca.
function WidgetProgresso({
  tipo,
  dados,
  escala,
  valorAnimado = null,
  bump = false,
}: {
  tipo: 'subs' | 'livepix';
  dados: DadosOverlay | null;
  escala: number;
  valorAnimado?: number | null;
  bump?: boolean;
}) {
  const cor = dados?.sub?.cor ?? SUB_COR_DEFAULT;
  const estilo = dados?.livepix?.estilo ?? 'classic';
  const sub = dados?.sub ?? null;
  const livepix = dados?.livepix ?? null;

  let valorTexto: string;
  let meta: number;
  let pct: number;
  let erro: boolean;
  let microEsquerda: ReactNode;
  let metaValor = '';
  let classicaEsquerda: string;
  let classicaDireita = '';
  let prefixo = '';

  if (tipo === 'livepix') {
    const total = livepix?.total ?? 0;
    meta = livepix?.meta ?? 0;
    erro = Boolean(livepix?.erro);
    pct = meta > 0 ? Math.round((total / meta) * 100) : 0;
    valorTexto = fmtValor(total);
    prefixo = 'R$';
    const mes = (livepix?.mes ?? '').toUpperCase();
    microEsquerda = (
      <>
        <b style={{ color: cor }}>{LIVEPIX_TITULO}</b> · {mes}
      </>
    );
    metaValor = meta > 0 ? `R$${fmtValor(meta)}` : '';
    classicaEsquerda =
      meta > 0
        ? `${LIVEPIX_TITULO} ${mes} R$${fmtValor(total)}(${pct}%)`
        : `${LIVEPIX_TITULO} ${mes} R$${fmtValor(total)}`;
    classicaDireita = meta > 0 ? `R$${fmtValor(meta)}` : '';
  } else {
    const contagem = sub?.contagem ?? null;
    meta = sub?.meta ?? 0;
    erro = Boolean(sub?.erro);
    pct = meta > 0 && contagem != null ? Math.round((contagem / meta) * 100) : 0;
    valorTexto = valorAnimado == null ? '—' : valorAnimado.toLocaleString('pt-BR');
    microEsquerda = <b style={{ color: cor }}>SUBS</b>;
    metaValor = meta > 0 ? fmtValor(meta) : '';
    classicaEsquerda = meta > 0 ? `SUBS ${valorTexto}(${pct}%)` : `SUBS ${valorTexto}`;
    classicaDireita = meta > 0 ? `META ${fmtValor(meta)}` : '';
  }

  if (estilo === 'glass') {
    return (
      <div
        data-card="progresso"
        style={{
          boxSizing: 'border-box',
          width: BASE_PROGRESSO_W * escala,
          height: BASE_PROGRESSO_GLASS_H * escala,
          padding: `${9 * escala}px ${18 * escala}px`,
          borderRadius: 24 * escala,
          color: '#fff',
          fontFamily:
            '-apple-system, "SF Pro Display", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: 'rgba(10, 10, 12, 0.62)',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
          border: `1px solid ${bump ? corComAlfa(cor, 0.55) : 'rgba(255, 255, 255, 0.1)'}`,
          boxShadow: bump
            ? `0 ${8 * escala}px ${32 * escala}px rgba(0, 0, 0, 0.5), 0 0 ${36 * escala}px ${corComAlfa(cor, 0.35)}`
            : `0 ${8 * escala}px ${32 * escala}px rgba(0, 0, 0, 0.5)`,
          position: 'relative',
          opacity: erro ? 0.6 : 1,
          transition: 'opacity 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease',
        }}
      >
        <i
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 24 * escala,
            right: 24 * escala,
            height: Math.max(1, 1.5 * escala),
            borderRadius: 9999,
            background: `linear-gradient(to right, transparent, ${corComAlfa(cor, 0.8)}, transparent)`,
          }}
        />
        <div className="flex items-baseline justify-between" style={{ columnGap: 12 * escala }}>
          <span
            className="font-semibold uppercase"
            style={{
              fontSize: 10 * escala,
              letterSpacing: '0.2em',
              color: '#9ca3af',
              whiteSpace: 'nowrap',
            }}
          >
            {microEsquerda}
          </span>
          {metaValor && (
            <span
              className="font-semibold uppercase"
              style={{
                fontSize: 10 * escala,
                letterSpacing: '0.2em',
                color: cor,
                whiteSpace: 'nowrap',
              }}
            >
              <b>META</b>
            </span>
          )}
        </div>
        <div
          className="flex items-end justify-between"
          style={{ columnGap: 12 * escala, marginTop: 6 * escala }}
        >
          <span
            className="font-bold"
            style={{
              fontSize: 32 * escala,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              transform: bump ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.35s ease',
            }}
          >
            {prefixo && (
              <span
                style={{
                  fontSize: '0.5em',
                  verticalAlign: 'top',
                  lineHeight: 1.5,
                  marginRight: 3 * escala,
                  color: cor,
                }}
              >
                {prefixo}
              </span>
            )}
            {valorTexto}
          </span>
          {metaValor && (
            <span
              className="font-bold"
              style={{
                fontSize: 32 * escala,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: '#fff',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {metaValor}
            </span>
          )}
        </div>
        {meta > 0 && (
          <>
            <div
              style={{
                position: 'relative',
                height: 14 * escala,
                marginTop: 6 * escala,
              }}
            >
              <span
                className="font-bold"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${Math.max(0, Math.min(100, pct))}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 14 * escala,
                  lineHeight: 1,
                  letterSpacing: '0.02em',
                  color: cor,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  textShadow: `0 ${1 * escala}px ${2 * escala}px rgba(0, 0, 0, 0.85)`,
                  transition: 'left 1.2s cubic-bezier(.22,.8,.3,1)',
                }}
              >
                {pct}%
              </span>
            </div>
            <div
              style={{
                boxSizing: 'border-box',
                height: 10 * escala,
                marginTop: 2 * escala,
                borderRadius: 9999,
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.14)',
                border: `1px solid ${corComAlfa(cor, 0.2)}`,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, pct)}%`,
                  borderRadius: 9999,
                  background: `linear-gradient(to right, ${corComAlfa(cor, 0.7)}, ${cor})`,
                  boxShadow: `0 0 ${12 * escala}px ${corComAlfa(cor, 0.4)}`,
                  transition: 'width 1.2s cubic-bezier(.22,.8,.3,1)',
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      data-card="progresso"
      style={{
        width: BASE_PROGRESSO_W * escala,
        height: BASE_PROGRESSO_CLASSIC_H * escala,
        background: '#000',
        borderRadius: 6 * escala,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: BASE_PROGRESSO_CLASSIC_H * 0.5 * escala,
        color: '#fff',
        opacity: erro ? 0.6 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${Math.min(100, pct)}%`,
          background: cor,
          transition: 'width 1.2s cubic-bezier(.22,.8,.3,1)',
        }}
      />
      <div
        className="flex items-center justify-between"
        style={{
          position: 'absolute',
          inset: 0,
          padding: `0 ${12 * escala}px`,
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            transform: bump ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.35s ease',
            transformOrigin: 'left center',
          }}
        >
          {classicaEsquerda}
        </span>
        <span>{classicaDireita}</span>
      </div>
    </div>
  );
}

// Card do contador de subs e da barra do LivePix: alterna os dois (cada um com
// sua duração) ou, com `subsLivepixJuntos`, empilha o contador em cima e a
// barra embaixo na mesma moldura.
function ConteudoSubsLivepix({
  dados,
  escala,
  preencher = true,
}: {
  dados: DadosOverlay | null;
  escala: number;
  preencher?: boolean;
}) {
  const sub = dados?.sub ?? null;
  const contagem = sub?.contagem ?? null;
  const slides = dados?.slides ?? slidesPadrao();
  const juntos = Boolean(slides.subsLivepixJuntos);
  const qtdProgresso =
    Number(Boolean(sub?.ativo)) + Number(Boolean(dados?.livepix?.ativo));
  // O design (Clássica/Vidro) vale para os dois widgets e define a moldura.
  // No modo junto, a moldura cresce para caber os dois empilhados.
  const base = baseProgresso(dados?.livepix?.estilo ?? 'classic', juntos, qtdProgresso);

  const [mostrado, setMostrado] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const [atual, setAtual] = useState<number | null>(null);
  const [saindo, setSaindo] = useState<number | null>(null);
  const mostradoRef = useRef<number | null>(null);
  const bumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contagem animada + "bump" quando o número aumenta (igual ao HTML).
  // O rAF tira os setState do corpo síncrono do efeito e alinha a animação.
  useEffect(() => {
    let cancelado = false;
    let animacao: number | null = null;

    const aplicar = () => {
      if (cancelado) return;
      if (contagem == null) {
        mostradoRef.current = null;
        setMostrado(null);
        return;
      }
      const anterior = mostradoRef.current;
      if (anterior == null) {
        mostradoRef.current = contagem;
        setMostrado(contagem);
        return;
      }
      if (contagem === anterior) return;

      if (contagem > anterior) {
        setBump(true);
        if (bumpRef.current) clearTimeout(bumpRef.current);
        bumpRef.current = setTimeout(() => setBump(false), 1600);
      }

      const de = anterior;
      const inicio = performance.now();
      const duracao = 900;
      const passo = (t: number) => {
        if (cancelado) return;
        const p = Math.min(1, (t - inicio) / duracao);
        const e = 1 - Math.pow(1 - p, 3);
        const valor = Math.round(de + (contagem - de) * e);
        mostradoRef.current = valor;
        setMostrado(valor);
        if (p < 1) animacao = requestAnimationFrame(passo);
      };
      animacao = requestAnimationFrame(passo);
    };

    const inicial = requestAnimationFrame(aplicar);
    return () => {
      cancelado = true;
      cancelAnimationFrame(inicial);
      if (animacao) cancelAnimationFrame(animacao);
    };
  }, [contagem]);

  useEffect(
    () => () => {
      if (bumpRef.current) clearTimeout(bumpRef.current);
    },
    []
  );

  const itens: ItemSubsLivepix[] = [];
  if (sub?.ativo) itens.push('subs');
  if (dados?.livepix?.ativo) itens.push('livepix');
  const itensKey = itens.join('|');

  // Alterna contador de subs e barra do LivePix no mesmo card, cada um com sua
  // duração (subsMs/livepixMs), quando não está no modo junto. O conteúdo
  // antigo sai antes do novo entrar.
  useEffect(() => {
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const agenda = (fn: () => void, ms: number) => {
      timers.push(
        setTimeout(() => {
          if (vivo) fn();
        }, ms)
      );
    };
    const duracaoDe = (item: ItemSubsLivepix) =>
      item === 'subs' ? slides.subsMs : slides.livepixMs;

    const iniciar = () => {
      if (!vivo) return;
      // No modo junto os dois aparecem ao mesmo tempo: não há rotação.
      if (juntos) {
        setAtual(null);
        setSaindo(null);
        return;
      }
      const n = itens.length;
      if (n === 0) {
        setAtual(null);
        setSaindo(null);
        return;
      }
      setAtual(0);
      setSaindo(null);
      if (n === 1) return;

      let indice = 0;
      const proximo = () => {
        if (!vivo) return;
        const alvo = (indice + 1) % n;
        setSaindo(indice);
        setAtual(null);
        indice = alvo;
        agenda(() => {
          setSaindo(null);
          setAtual(alvo);
          agenda(proximo, duracaoDe(itens[alvo]));
        }, TRANSICAO_CARROSSEL_MS + 120);
      };
      agenda(proximo, duracaoDe(itens[0]));
    };

    const raf = requestAnimationFrame(iniciar);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensKey, slides.subsMs, slides.livepixMs, juntos]);

  const iSubs = itens.indexOf('subs');
  const iLivepix = itens.indexOf('livepix');
  const classeSlide = (i: number) =>
    `ov-slide${i >= 0 && atual === i ? ' ov-slide-ativa' : ''}${
      i >= 0 && saindo === i ? ' ov-slide-saindo' : ''
    }`;

  return (
    <div className={`flex items-center justify-center ${preencher ? 'h-full w-full' : ''}`}>
      <div
        data-card="subs"
        className="relative"
        style={{ width: base.w * escala, height: base.h * escala }}
      >
        {juntos ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ rowGap: PROGRESSO_JUNTOS_GAP * escala }}
          >
            {sub?.ativo && (
              <WidgetProgresso
                tipo="subs"
                dados={dados}
                escala={escala}
                valorAnimado={mostrado}
                bump={bump}
              />
            )}
            {dados?.livepix?.ativo && (
              <WidgetProgresso tipo="livepix" dados={dados} escala={escala} />
            )}
          </div>
        ) : (
          <div className="absolute inset-0" style={{ '--ov-esc': String(escala) } as CSSProperties}>
            {/* Contador de subs */}
            <section className={classeSlide(iSubs)}>
              <div className="flex h-full w-full items-center justify-center">
                <WidgetProgresso
                  tipo="subs"
                  dados={dados}
                  escala={escala}
                  valorAnimado={mostrado}
                  bump={bump}
                />
              </div>
            </section>

            {/* Barra de progresso do LivePix */}
            <section className={classeSlide(iLivepix)}>
              <div className="flex h-full w-full items-center justify-center">
                <WidgetProgresso tipo="livepix" dados={dados} escala={escala} />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function PillCarrossel({ rotulo, cor, escala }: { rotulo: string; cor: string; escala: number }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        columnGap: 8 * escala,
        padding: `${5 * escala}px ${12 * escala}px`,
        borderRadius: 9999,
        border: '1px solid rgba(255, 255, 255, 0.10)',
        background: 'rgba(255, 255, 255, 0.05)',
      }}
    >
      <span
        style={{
          width: 6 * escala,
          height: 6 * escala,
          borderRadius: '50%',
          background: cor,
          boxShadow: `0 0 8px ${cor}`,
        }}
      />
      <span
        className="font-semibold uppercase"
        style={{ fontSize: 10 * escala, letterSpacing: '0.2em', color: cor, lineHeight: 1.4 }}
      >
        {rotulo}
      </span>
    </span>
  );
}

function ConteudoSlides({
  dados,
  escala,
  preencher = true,
}: {
  dados: DadosOverlay | null;
  escala: number;
  preencher?: boolean;
}) {
  const cor = dados?.sub?.cor ?? SUB_COR_DEFAULT;
  const slides = dados?.slides ?? slidesPadrao();

  const [atual, setAtual] = useState<number | null>(null);
  const [saindo, setSaindo] = useState<number | null>(null);
  // Na pausa entre slides (modo intervalo) o card INTEIRO some.
  const [pausa, setPausa] = useState(false);

  // Lista de slides visíveis conforme a ordem/ativação configurada.
  const defs: SlideDef[] = [];
  for (const tipo of slides.ordem) {
    if (tipo === 'cupom') {
      if (slides.cupom.ativo && slides.cupom.codigo.trim() !== '') {
        defs.push({ chave: 'cupom', tipo, duracaoMs: slides.cupomMs });
      }
    } else if (tipo === 'patrocinador') {
      for (const p of slides.patrocinadores) {
        if (p.imagem && p.ativo) {
          defs.push({
            chave: `sp:${p.id}`,
            tipo,
            duracaoMs: p.duracaoMs,
            imagem: p.imagem,
            esticar: p.esticar,
          });
        }
      }
    } else if (tipo === 'anuncie') {
      if (slides.anuncie.ativo) {
        defs.push({ chave: 'anuncie', tipo, duracaoMs: slides.anuncieMs });
      }
    }
  }
  const defsKey = defs.map((d) => `${d.chave}:${d.duracaoMs}`).join('|');

  // Rotação: 'seguido' troca sem pausa (conteúdo sai, card fica e o novo
  // entra); 'intervalo' some com o card junto do conteúdo por intervaloMs
  // antes do próximo. A contagem muda com sub novo -> reinicia no slide de
  // subs. O rAF tira os setState do corpo síncrono do efeito.
  useEffect(() => {
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const agenda = (fn: () => void, ms: number) => {
      timers.push(
        setTimeout(() => {
          if (vivo) fn();
        }, ms)
      );
    };

    const iniciar = () => {
      if (!vivo) return;
      const n = defs.length;
      if (n === 0) {
        setAtual(null);
        setSaindo(null);
        setPausa(false);
        return;
      }
      const base = 0;
      setPausa(false);
      setAtual(base);
      setSaindo(null);
      if (!slides.rotacao || n === 1) return;

      let indice = base;
      const proximo = () => {
        if (!vivo) return;
        const alvo = (indice + 1) % n;
        const duracao = defs[alvo]?.duracaoMs ?? 5000;
        // O conteúdo antigo sempre sai antes do novo entrar (sem sobreposição).
        setSaindo(indice);
        setAtual(null);
        indice = alvo;
        if (slides.modo === 'intervalo' && slides.intervaloMs > 0) {
          // Card e conteúdo somem juntos; o card volta com o próximo slide.
          setPausa(true);
          agenda(() => setSaindo(null), TRANSICAO_CARROSSEL_MS + 120);
          agenda(() => {
            setPausa(false);
            setAtual(alvo);
            agenda(proximo, duracao);
          }, slides.intervaloMs + TRANSICAO_CARROSSEL_MS);
        } else {
          // Sem pausa o card fica; ele fica vazio por um instante na troca.
          agenda(() => {
            setSaindo(null);
            setAtual(alvo);
            agenda(proximo, duracao);
          }, TRANSICAO_CARROSSEL_MS + 120);
        }
      };
      agenda(proximo, defs[base]?.duracaoMs ?? 5000);
    };

    const raf = requestAnimationFrame(iniciar);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defsKey, slides.rotacao, slides.modo, slides.intervaloMs]);

  if (defs.length === 0) return null;

  return (
    <div className={`flex items-center justify-center ${preencher ? 'h-full w-full' : ''}`}>
      <div
        data-card="slides"
        className="relative overflow-hidden"
        style={{
          width: BASE_SLIDES_W * escala,
          height: BASE_SLIDES_H * escala,
          background: 'rgba(10, 10, 12, 0.62)',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: 24 * escala,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          opacity: pausa ? 0 : 1,
          transition: 'opacity 0.6s ease, box-shadow 0.4s ease, border-color 0.4s ease',
        }}
      >
        {/* Faixa de destaque no topo */}
        <span
          aria-hidden
          className="absolute"
          style={{
            top: 0,
            left: 24 * escala,
            right: 24 * escala,
            height: Math.max(1, 1.5 * escala),
            borderRadius: 9999,
            background: `linear-gradient(to right, transparent, ${corComAlfa(cor, 0.8)}, transparent)`,
            zIndex: 3,
          }}
        />
        <div className="absolute inset-0" style={{ '--ov-esc': String(escala) } as CSSProperties}>
          {defs.map((d, i) => (
            <section
              key={d.chave}
              className={`ov-slide${atual === i ? ' ov-slide-ativa' : ''}${
                saindo === i ? ' ov-slide-saindo' : ''
              }`}
            >
              {d.tipo === 'cupom' && (
                <div
                  className="flex flex-col items-center text-center"
                  style={{ rowGap: 8 * escala, padding: `${16 * escala}px ${20 * escala}px` }}
                >
                  <PillCarrossel rotulo="Cupom" cor={cor} escala={escala} />
                  <div style={{ fontSize: 16 * escala, fontWeight: 300, color: '#d1d5db' }}>
                    {slides.cupom.pre}
                  </div>
                  <div
                    style={{
                      padding: `${2 * escala}px ${20 * escala}px ${4 * escala}px`,
                      fontSize: 44 * escala,
                      lineHeight: 1.15,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      color: cor,
                      textShadow: `0 0 ${24 * escala}px ${corComAlfa(cor, 0.45)}`,
                      border: `1px solid ${corComAlfa(cor, 0.35)}`,
                      background: corComAlfa(cor, 0.07),
                      borderRadius: 16 * escala,
                    }}
                  >
                    {slides.cupom.codigo}
                  </div>
                  {slides.cupom.pos && (
                    <div style={{ fontSize: 19 * escala, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                      {slides.cupom.pos}
                    </div>
                  )}
                </div>
              )}

              {d.tipo === 'patrocinador' && d.imagem && (
                <div className="absolute inset-0">
                  <img
                    src={urlImagemPatrocinador(d.imagem)}
                    alt=""
                    draggable={false}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: d.esticar ? 'fill' : 'cover',
                    }}
                  />
                </div>
              )}

              {d.tipo === 'anuncie' && (
                <div
                  className="flex flex-col items-center text-center"
                  style={{ rowGap: 6 * escala, padding: `${16 * escala}px ${20 * escala}px` }}
                >
                  <PillCarrossel rotulo="Anuncie" cor={cor} escala={escala} />
                  <div
                    style={{
                      fontSize: 30 * escala,
                      lineHeight: 1.1,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      color: cor,
                      textShadow: `0 0 ${20 * escala}px ${corComAlfa(cor, 0.4)}`,
                    }}
                  >
                    {slides.anuncie.titulo}
                  </div>
                  {slides.anuncie.texto && (
                    <div style={{ fontSize: 15 * escala, fontWeight: 300, color: '#d1d5db' }}>
                      {slides.anuncie.texto}
                    </div>
                  )}
                  {slides.anuncie.contato && (
                    <div style={{ fontSize: 17 * escala, fontWeight: 600, color: '#fff' }}>
                      {slides.anuncie.contato}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OverlayVisual({
  dados,
  layout,
  editavel = false,
  selecionados = [],
  onPointerDownElemento,
  onPointerDownHandle,
}: OverlayVisualProps) {
  const grouped = Boolean(layout?.grouped);
  // Sem posições salvas, os elementos ficam em fluxo (flex), inclusive no
  // editor — é assim que o editor mede o tamanho natural antes de fixar.
  const temPosicao = grouped
    ? Boolean(estiloWrapper(layout?.groupContainer))
    : Boolean(estiloWrapper(layout?.medalWrapper) || estiloWrapper(layout?.infoBlock));

  const classesBase = editavel ? ' cursor-grab touch-none select-none' : '';
  const marcaSelecionado = (id: ElementoOverlay) =>
    editavel && selecionados.includes(id) ? ' outline outline-2 outline-offset-2 outline-[#e8a020]' : '';
  // Sem moldura salva, o elemento precisa encolher para o conteúdo (w-fit):
  // dentro da raiz posicionada (absolute inset-0) um div flex esticaria para
  // os 1920px e o editor mediria um tamanho natural errado.
  const classesMoldura = (el: LayoutElemento | null | undefined) =>
    estiloWrapper(el) ? '' : ' w-fit';

  const propsElemento = (id: ElementoOverlay) => ({
    'data-elemento': id,
    onPointerDown:
      editavel && onPointerDownElemento
        ? (e: ReactPointerEvent<HTMLDivElement>) => onPointerDownElemento(id, e)
        : undefined,
  });

  const esMedalha = fatorFit(layout?.medalWrapper, BASE_MEDALHA_W, BASE_MEDALHA_H);
  const esInfo = fatorFit(layout?.infoBlock, BASE_INFO_W, BASE_INFO_H);
  const esGrupo = fatorFit(layout?.groupContainer, BASE_GRUPO_W, BASE_GRUPO_H);
  const juntosSubs = Boolean(dados?.slides?.subsLivepixJuntos);
  const qtdProgresso =
    Number(Boolean(dados?.sub?.ativo)) + Number(Boolean(dados?.livepix?.ativo));
  const baseSub = baseProgresso(
    dados?.livepix?.estilo ?? 'classic',
    juntosSubs,
    qtdProgresso
  );
  // A moldura do card de progresso acompanha a proporção natural atual: ao
  // ligar o modo junto (ou trocar Clássica/Vidro), o card cresce na hora mesmo
  // antes de o layout ser salvo no editor.
  const larguraSub = medida(layout?.subCounter?.width);
  const alturaSub = larguraSub > 0 ? Math.round(larguraSub * (baseSub.h / baseSub.w)) : 0;
  const layoutSub =
    layout?.subCounter && alturaSub > 0
      ? { ...layout.subCounter, height: `${alturaSub}px` }
      : layout?.subCounter;
  const esSub =
    larguraSub > 0 ? larguraSub / baseSub.w : fatorFit(layout?.subCounter, baseSub.w, baseSub.h);
  const estiloSub = estiloWrapper(layoutSub);
  const esSlides = fatorFit(layout?.slidesCounter, BASE_SLIDES_W, BASE_SLIDES_H);
  // Os elementos só existem na overlay quando ligados na Configuração/editor; o
  // editor mostra exatamente o que será exibido (WYSIWYG). O card do contador
  // de subs aparece também quando só a barra do LivePix está ligada.
  const mostrarSubs = Boolean(dados?.sub?.ativo) || Boolean(dados?.livepix?.ativo);
  const mostrarSlides = slidesTemItens(dados?.slides);

  return (
    <div
      id="overlayRoot"
      className={`z-[2] ${
        temPosicao
          ? 'absolute inset-0'
          : 'absolute left-0 top-0 flex items-center gap-[14px] px-[14px] py-2'
      }`}
    >
      <style>{`
        @keyframes medal-enter-down {
          from { transform: translateY(-60px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes medal-enter-up {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .medal-enter-down { animation: medal-enter-down 0.35s cubic-bezier(.22,.68,0,1.2) forwards; }
        .medal-enter-up   { animation: medal-enter-up   0.35s cubic-bezier(.22,.68,0,1.2) forwards; }
        .ov-slide {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          opacity: 0;
          transform: translateY(calc(16px * var(--ov-esc, 1))) scale(0.98);
          filter: blur(calc(8px * var(--ov-esc, 1)));
          pointer-events: none;
          transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.6s ease;
        }
        .ov-slide-ativa { opacity: 1; transform: none; filter: none; }
        .ov-slide-saindo {
          opacity: 0;
          transform: translateY(calc(-16px * var(--ov-esc, 1))) scale(0.98);
          filter: blur(calc(8px * var(--ov-esc, 1)));
        }
      `}</style>
      {grouped ? (
        <>
          <div
            id="groupContainer"
            className={`flex items-center${classesMoldura(layout?.groupContainer)}${classesBase}${marcaSelecionado('groupContainer')}`}
            style={estiloWrapper(layout?.groupContainer)}
            {...propsElemento('groupContainer')}
          >
            <ConteudoMedalha dados={dados} escala={esGrupo} preencher={false} />
            <ConteudoInfo dados={dados} escala={esGrupo} preencher={false} />
            <ChromeEdicao id="groupContainer" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
          </div>
          {/* O contador de subs (com a barra do LivePix) e o carrossel são
              sempre elementos independentes, mesmo com o grupo ligado (o
              Agrupar vale só para medalha + W/L). */}
          {mostrarSubs && (
            <div
              id="subCounter"
              className={`flex items-center justify-center${classesMoldura(layout?.subCounter)}${classesBase}${marcaSelecionado('subCounter')}`}
              style={estiloSub}
              {...propsElemento('subCounter')}
            >
              <ConteudoSubsLivepix dados={dados} escala={esSub} />
              <ChromeEdicao id="subCounter" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
            </div>
          )}
          {mostrarSlides && (
            <div
              id="slidesCounter"
              className={`flex items-center justify-center${classesMoldura(layout?.slidesCounter)}${classesBase}${marcaSelecionado('slidesCounter')}`}
              style={estiloWrapper(layout?.slidesCounter)}
              {...propsElemento('slidesCounter')}
            >
              <ConteudoSlides dados={dados} escala={esSlides} />
              <ChromeEdicao id="slidesCounter" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
            </div>
          )}
        </>
      ) : (
        <>
          <div
            id="medalWrapper"
            className={`flex flex-col items-center${classesMoldura(layout?.medalWrapper)}${classesBase}${marcaSelecionado('medalWrapper')}`}
            style={estiloWrapper(layout?.medalWrapper)}
            {...propsElemento('medalWrapper')}
          >
            <ConteudoMedalha dados={dados} escala={esMedalha} />
            <ChromeEdicao id="medalWrapper" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
          </div>
          <div
            id="infoBlock"
            className={`flex flex-col justify-start${classesMoldura(layout?.infoBlock)}${classesBase}${marcaSelecionado('infoBlock')}`}
            style={estiloWrapper(layout?.infoBlock)}
            {...propsElemento('infoBlock')}
          >
            <ConteudoInfo dados={dados} escala={esInfo} />
            <ChromeEdicao id="infoBlock" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
          </div>
          {mostrarSubs && (
            <div
              id="subCounter"
              className={`flex items-center justify-center${classesMoldura(layout?.subCounter)}${classesBase}${marcaSelecionado('subCounter')}`}
              style={estiloSub}
              {...propsElemento('subCounter')}
            >
              <ConteudoSubsLivepix dados={dados} escala={esSub} />
              <ChromeEdicao id="subCounter" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
            </div>
          )}
          {mostrarSlides && (
            <div
              id="slidesCounter"
              className={`flex items-center justify-center${classesMoldura(layout?.slidesCounter)}${classesBase}${marcaSelecionado('slidesCounter')}`}
              style={estiloWrapper(layout?.slidesCounter)}
              {...propsElemento('slidesCounter')}
            >
              <ConteudoSlides dados={dados} escala={esSlides} />
              <ChromeEdicao id="slidesCounter" visivel={editavel} onPointerDownHandle={onPointerDownHandle} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
