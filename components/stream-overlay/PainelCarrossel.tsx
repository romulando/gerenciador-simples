'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ImagePlus, Save, Trash2 } from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { btnPrimary, btnSecondary, enviarJson, inputCls, labelCls } from '@/components/pedidos/common';
import {
  SLIDE_DURACAO_MAX_MS,
  SLIDE_DURACAO_MIN_MS,
  SLIDE_DURACAO_PADRAO_PATROCINADOR,
  SLIDE_PAUSA_MAX_MS,
  SLIDES_MAX_PATROCINADORES,
  type PatrocinadorOverlay,
  type SlidesOverlayConfig,
  type TipoSlide,
  urlImagemPatrocinador,
} from './common';

const ROTULO_TIPO: Record<TipoSlide, string> = {
  cupom: 'Cupom',
  patrocinador: 'Patrocinadores',
  anuncie: 'Anuncie aqui',
};

const btnIcone =
  'rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30';

function formatarSegundos(ms: number): string {
  const s = ms / 1000;
  return Number.isInteger(s) ? String(s) : s.toFixed(1).replace('.', ',');
}

function parseSegundos(txt: string): number | null {
  const n = Number(txt.replace(',', '.').trim());
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

// Campo de segundos que só aplica o valor ao sair do campo/Enter, permitindo
// digitar valores como "2,5" sem os cliques intermediários resetarem.
function CampoSegundos({
  inicialMs,
  minMs,
  maxMs,
  onCommit,
}: {
  inicialMs: number;
  minMs: number;
  maxMs: number;
  onCommit: (ms: number) => void;
}) {
  const [txt, setTxt] = useState(formatarSegundos(inicialMs));

  function aplicar() {
    const ms = parseSegundos(txt);
    if (ms == null) {
      setTxt(formatarSegundos(inicialMs));
      return;
    }
    const limitado = Math.min(maxMs, Math.max(minMs, ms));
    onCommit(limitado);
    setTxt(formatarSegundos(limitado));
  }

  return (
    <input
      inputMode="decimal"
      value={txt}
      onChange={(e) => setTxt(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
      onBlur={aplicar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          aplicar();
        }
      }}
      className="w-20 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white transition-all duration-300 focus:border-white/30 focus:bg-white/10 focus:outline-none"
    />
  );
}

function lerArquivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result ?? ''));
    leitor.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    leitor.readAsDataURL(file);
  });
}

// Reduz imagens grandes (máx. 1400px no maior lado) antes de enviar.
async function arquivoParaImagem(file: File): Promise<string> {
  const dataUrl = await lerArquivoComoDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Imagem inválida.'));
    el.src = dataUrl;
  });
  const MAX_LADO = 1400;
  const maior = Math.max(img.width, img.height);
  if (maior <= MAX_LADO || maior === 0) return dataUrl;
  const fator = MAX_LADO / maior;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * fator);
  canvas.height = Math.round(img.height * fator);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const tipo = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(tipo, 0.88);
}

// Painel do carrossel de slides do contador de subs (configuração global, vale
// para todas as cenas). Salvo pelo botão próprio “Salvar carrossel”.
export default function PainelCarrossel({
  slidesIniciais,
  onSalvo,
}: {
  slidesIniciais: SlidesOverlayConfig;
  onSalvo?: (slides: SlidesOverlayConfig) => void;
}) {
  const [config, setConfig] = useState<SlidesOverlayConfig>(() => ({
    ...slidesIniciais,
    ordem: [...slidesIniciais.ordem],
    cupom: { ...slidesIniciais.cupom },
    anuncie: { ...slidesIniciais.anuncie },
    patrocinadores: slidesIniciais.patrocinadores.map((p) => ({ ...p })),
  }));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  function atualizar(patch: Partial<SlidesOverlayConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  function moverTipo(indice: number, direcao: -1 | 1) {
    setConfig((c) => {
      const alvo = indice + direcao;
      if (alvo < 0 || alvo >= c.ordem.length) return c;
      const ordem = [...c.ordem];
      [ordem[indice], ordem[alvo]] = [ordem[alvo], ordem[indice]];
      return { ...c, ordem };
    });
  }

  function moverPatrocinador(indice: number, direcao: -1 | 1) {
    setConfig((c) => {
      const alvo = indice + direcao;
      if (alvo < 0 || alvo >= c.patrocinadores.length) return c;
      const patrocinadores = [...c.patrocinadores];
      [patrocinadores[indice], patrocinadores[alvo]] = [
        patrocinadores[alvo],
        patrocinadores[indice],
      ];
      return { ...c, patrocinadores };
    });
  }

  function alterarPatrocinador(id: string, patch: Partial<PatrocinadorOverlay>) {
    setConfig((c) => ({
      ...c,
      patrocinadores: c.patrocinadores.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function removerPatrocinador(id: string) {
    setConfig((c) => ({
      ...c,
      patrocinadores: c.patrocinadores.filter((p) => p.id !== id),
    }));
  }

  async function adicionarPatrocinador(file: File) {
    setErro('');
    if (!file.type.startsWith('image/')) {
      setErro('Envie um arquivo de imagem.');
      return;
    }
    try {
      const imagem = await arquivoParaImagem(file);
      const id = `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setConfig((c) => ({
        ...c,
        patrocinadores: [
          ...c.patrocinadores,
          {
            id,
            nome: '',
            imagem,
            duracaoMs: SLIDE_DURACAO_PADRAO_PATROCINADOR,
            esticar: false,
            ativo: true,
          },
        ],
      }));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      const resp = await enviarJson<{ ok: boolean; slides: SlidesOverlayConfig }>(
        '/api/overlay/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slides: config }),
        }
      );
      const salvoCfg = resp.slides;
      setConfig({
        ...salvoCfg,
        ordem: [...salvoCfg.ordem],
        cupom: { ...salvoCfg.cupom },
        anuncie: { ...salvoCfg.anuncie },
        patrocinadores: salvoCfg.patrocinadores.map((p) => ({ ...p })),
      });
      onSalvo?.(salvoCfg);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function descricaoTipo(tipo: TipoSlide): string {
    if (tipo === 'cupom') return config.cupom.ativo ? 'ativo' : 'desligado';
    if (tipo === 'patrocinador') {
      const visiveis = config.patrocinadores.filter((p) => p.ativo && p.imagem).length;
      return `${visiveis}/${config.patrocinadores.length} visíveis`;
    }
    return config.anuncie.ativo ? 'ativo' : 'desligado';
  }

  return (
    <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Carrossel de slides</h2>
          <p className="text-xs text-gray-500">
            Cupom, patrocinadores e “anuncie aqui” com tempos próprios, além do contador de
            subs/barra do LivePix (alternando ou juntos) — vale para todas as cenas
          </p>
        </div>
        <button className={btnPrimary} onClick={() => void salvar()} disabled={salvando}>
          <span className="flex items-center gap-1.5">
            {salvo ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {salvando ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar carrossel'}
          </span>
        </button>
      </div>

      {erro && <Alerta tipo="erro" className="mb-3">{erro}</Alerta>}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-medium text-gray-300">Rotação</p>
          <ToggleSwitch
            checked={config.rotacao}
            onChange={(v) => atualizar({ rotacao: v })}
            label="Rotacionar os slides"
            badge={config.rotacao ? 'ativa' : 'parada'}
          />
          <div className="mt-3">
            <ToggleSwitch
              checked={config.modo === 'intervalo'}
              onChange={(v) => atualizar({ modo: v ? 'intervalo' : 'seguido' })}
              label="Pausa entre slides (o card some)"
              badge={
                config.modo === 'intervalo'
                  ? `${formatarSegundos(config.intervaloMs)}s`
                  : 'sem pausa'
              }
            />
            {config.modo === 'intervalo' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-300">O card some por</span>
                <CampoSegundos
                  inicialMs={config.intervaloMs}
                  minMs={0}
                  maxMs={SLIDE_PAUSA_MAX_MS}
                  onCommit={(ms) => atualizar({ intervaloMs: ms })}
                />
                <span className="text-sm text-gray-300">segundos</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-medium text-gray-300">Ordem dos slides</p>
          <div className="space-y-2">
            {config.ordem.map((tipo, i) => (
              <div
                key={tipo}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span className="flex-1 text-sm text-gray-200">{ROTULO_TIPO[tipo]}</span>
                <span className="text-[11px] text-gray-500">{descricaoTipo(tipo)}</span>
                <button
                  type="button"
                  className={btnIcone}
                  onClick={() => moverTipo(i, -1)}
                  disabled={i === 0}
                  title="Subir"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={btnIcone}
                  onClick={() => moverTipo(i, 1)}
                  disabled={i === config.ordem.length - 1}
                  title="Descer"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-medium text-gray-300">Contador de subs + LivePix</p>
          <ToggleSwitch
            checked={config.subsLivepixJuntos}
            onChange={(v) => atualizar({ subsLivepixJuntos: v })}
            label="Mostrar os dois juntos"
            badge={config.subsLivepixJuntos ? 'juntos' : 'alternando'}
            title="Ligado: contador de subs em cima e barra do LivePix embaixo, no mesmo card, sem alternar. Desligado: alterna os dois com as durações abaixo."
          />
          {!config.subsLivepixJuntos && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-300">Duração do contador</span>
                <CampoSegundos
                  inicialMs={config.subsMs}
                  minMs={SLIDE_DURACAO_MIN_MS}
                  maxMs={SLIDE_DURACAO_MAX_MS}
                  onCommit={(ms) => atualizar({ subsMs: ms })}
                />
                <span className="text-sm text-gray-300">segundos</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-300">Duração da barra LivePix</span>
                <CampoSegundos
                  inicialMs={config.livepixMs}
                  minMs={SLIDE_DURACAO_MIN_MS}
                  maxMs={SLIDE_DURACAO_MAX_MS}
                  onCommit={(ms) => atualizar({ livepixMs: ms })}
                />
                <span className="text-sm text-gray-300">segundos</span>
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            {config.subsLivepixJuntos
              ? 'O contador de subs fica em cima e a barra do LivePix embaixo, no mesmo card, sem alternar. As durações não se aplicam nesse modo. O contador só mostra número quando a Twitch está conectada; sem nenhum dos dois ligado, o card não aparece.'
              : 'O card do contador alterna com a barra de progresso do LivePix (ligada na Configuração da Overlay), cada um com sua duração. Para exibir os dois juntos, ligue a opção acima. O contador só mostra número quando a Twitch está conectada; sem nenhum dos dois ligado, o card não aparece.'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-medium text-gray-300">Cupom</p>
          <ToggleSwitch
            checked={config.cupom.ativo}
            onChange={(v) => atualizar({ cupom: { ...config.cupom, ativo: v } })}
            label="Exibir slide do cupom"
            badge={config.cupom.ativo ? 'ativo' : 'desligado'}
          />
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelCls}>Linha de cima</label>
              <input
                className={inputCls}
                value={config.cupom.pre}
                onChange={(e) =>
                  atualizar({ cupom: { ...config.cupom, pre: e.target.value.slice(0, 80) } })
                }
                placeholder="Utilize o cupom"
              />
            </div>
            <div>
              <label className={labelCls}>Código (sem código o slide não aparece)</label>
              <input
                className={inputCls}
                value={config.cupom.codigo}
                onChange={(e) =>
                  atualizar({ cupom: { ...config.cupom, codigo: e.target.value.slice(0, 32) } })
                }
                placeholder="DOTALIVE"
              />
            </div>
            <div>
              <label className={labelCls}>Linha de baixo</label>
              <input
                className={inputCls}
                value={config.cupom.pos}
                onChange={(e) =>
                  atualizar({ cupom: { ...config.cupom, pos: e.target.value.slice(0, 80) } })
                }
                placeholder="e jogue comigo!"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Duração</span>
              <CampoSegundos
                inicialMs={config.cupomMs}
                minMs={SLIDE_DURACAO_MIN_MS}
                maxMs={SLIDE_DURACAO_MAX_MS}
                onCommit={(ms) => atualizar({ cupomMs: ms })}
              />
              <span className="text-sm text-gray-300">segundos</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-300">
              Patrocinadores ({config.patrocinadores.length})
            </p>
            <input
              ref={inputArquivoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void adicionarPatrocinador(file);
              }}
            />
            <button
              type="button"
              className={btnSecondary}
              onClick={() => inputArquivoRef.current?.click()}
              disabled={config.patrocinadores.length >= SLIDES_MAX_PATROCINADORES}
            >
              <span className="flex items-center gap-1.5">
                <ImagePlus className="h-4 w-4" />
                Adicionar patrocinador
              </span>
            </button>
          </div>
          <p className="mb-3 text-[11px] text-gray-500">
            Tamanho ideal: <span className="font-semibold text-gray-400">760×400 px</span>{' '}
            (proporção do card · 1,9:1). Fora da proporção a imagem preenche o card cortando o
            excedente; use o switch “Esticar” do card para esticar em vez de cortar.
          </p>
          {config.patrocinadores.length === 0 ? (
            <p className="text-xs text-gray-500">
              Nenhum patrocinador ainda. Envie as imagens pelo botão acima; cada uma tem nome,
              duração, ordem e seus próprios switches.
            </p>
          ) : (
            <div className="space-y-2">
              {config.patrocinadores.map((p, i) => (
                <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <img
                      src={urlImagemPatrocinador(p.imagem)}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded-lg border border-white/10 bg-black/30 object-contain"
                    />
                    <input
                      value={p.nome}
                      onChange={(e) =>
                        alterarPatrocinador(p.id, { nome: e.target.value.slice(0, 60) })
                      }
                      placeholder={`Patrocinador ${i + 1}`}
                      className="min-w-40 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 transition-all duration-300 focus:border-white/30 focus:bg-white/10 focus:outline-none"
                    />
                    <CampoSegundos
                      inicialMs={p.duracaoMs}
                      minMs={SLIDE_DURACAO_MIN_MS}
                      maxMs={SLIDE_DURACAO_MAX_MS}
                      onCommit={(ms) => alterarPatrocinador(p.id, { duracaoMs: ms })}
                    />
                    <span className="text-[11px] text-gray-500">s</span>
                    <button
                      type="button"
                      className={btnIcone}
                      onClick={() => moverPatrocinador(i, -1)}
                      disabled={i === 0}
                      title="Subir"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={btnIcone}
                      onClick={() => moverPatrocinador(i, 1)}
                      disabled={i === config.patrocinadores.length - 1}
                      title="Descer"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={`${btnIcone} text-red-300`}
                      onClick={() => removerPatrocinador(p.id)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="w-44 shrink-0">
                      <ToggleSwitch
                        checked={p.ativo}
                        onChange={(v) => alterarPatrocinador(p.id, { ativo: v })}
                        label="Mostrar"
                        badge={p.ativo ? 'ativo' : 'oculto'}
                        title="Desligado: esta imagem não entra na rotação"
                      />
                    </div>
                    <div className="w-52 shrink-0">
                      <ToggleSwitch
                        checked={p.esticar}
                        onChange={(v) => alterarPatrocinador(p.id, { esticar: v })}
                        label="Esticar imagem"
                        badge={p.esticar ? 'ligado' : 'desligado'}
                        title="Ligado: estica para preencher o card (pode distorcer). Desligado: preenche cortando o excedente."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-medium text-gray-300">Anuncie aqui</p>
          <ToggleSwitch
            checked={config.anuncie.ativo}
            onChange={(v) => atualizar({ anuncie: { ...config.anuncie, ativo: v } })}
            label="Exibir slide “anuncie aqui”"
            badge={config.anuncie.ativo ? 'ativo' : 'desligado'}
          />
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelCls}>Título</label>
              <input
                className={inputCls}
                value={config.anuncie.titulo}
                onChange={(e) =>
                  atualizar({ anuncie: { ...config.anuncie, titulo: e.target.value.slice(0, 60) } })
                }
                placeholder="ANUNCIE AQUI"
              />
            </div>
            <div>
              <label className={labelCls}>Texto</label>
              <input
                className={inputCls}
                value={config.anuncie.texto}
                onChange={(e) =>
                  atualizar({ anuncie: { ...config.anuncie, texto: e.target.value.slice(0, 120) } })
                }
                placeholder="Divulgue sua marca na live"
              />
            </div>
            <div>
              <label className={labelCls}>Contato</label>
              <input
                className={inputCls}
                value={config.anuncie.contato}
                onChange={(e) =>
                  atualizar({ anuncie: { ...config.anuncie, contato: e.target.value.slice(0, 60) } })
                }
                placeholder="ex.: @seucanal · contato@email.com"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Duração</span>
              <CampoSegundos
                inicialMs={config.anuncieMs}
                minMs={SLIDE_DURACAO_MIN_MS}
                maxMs={SLIDE_DURACAO_MAX_MS}
                onCommit={(ms) => atualizar({ anuncieMs: ms })}
              />
              <span className="text-sm text-gray-300">segundos</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
