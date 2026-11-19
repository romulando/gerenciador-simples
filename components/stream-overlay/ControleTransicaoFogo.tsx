'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Flame, Loader2, X } from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { buscarJson } from '@/components/pedidos/common';
import {
  FOGO_DURACAO_MAX_MS,
  FOGO_DURACAO_MIN_MS,
  fogoPadrao,
  type FogoOverlayConfig,
  type PaletaFogo,
} from './common';

// Card global da transição de fogo: a paleta escolhida vale para todas as
// cenas (por isso fica fora do Editar Overlay). O salvamento é automático.

interface PaletaUi {
  paleta: PaletaFogo;
  nome: string;
  descricao: string;
  swatch: string;
}

const PALETAS_UI: readonly PaletaUi[] = [
  {
    paleta: 'orange',
    nome: 'Laranja',
    descricao: 'O original: chamas diagonais com núcleo amarelo.',
    swatch:
      'radial-gradient(circle at 35% 72%, #ffff00 0 20%, #ff7a00 34%, #ff1100 58%, #7a0a00 100%)',
  },
  {
    paleta: 'blue',
    nome: 'Azul',
    descricao: 'Chama fria com núcleo ciano.',
    swatch:
      'radial-gradient(circle at 35% 72%, #d8ffff 0 20%, #12a8ff 34%, #0d33ff 58%, #04125c 100%)',
  },
  {
    paleta: 'purple',
    nome: 'Roxo',
    descricao: 'Núcleo lilás com borda roxa.',
    swatch:
      'radial-gradient(circle at 35% 72%, #ffd6ff 0 20%, #d933ff 34%, #8c0de6 58%, #2e0561 100%)',
  },
  {
    paleta: 'green',
    nome: 'Verde',
    descricao: 'Núcleo verde-limão com borda esmeralda.',
    swatch:
      'radial-gradient(circle at 35% 72%, #e6ff6b 0 20%, #5be61a 34%, #00a31a 58%, #034a10 100%)',
  },
  {
    paleta: 'dark',
    nome: 'Preto e cinza',
    descricao: 'Chama escura com núcleo cinza claro.',
    swatch:
      'radial-gradient(circle at 35% 72%, #c7ccd6 0 20%, #6a6e7a 34%, #2b2c35 58%, #0b0b0e 100%)',
  },
];

function formatarDuracao(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export default function ControleTransicaoFogo() {
  const [config, setConfig] = useState<FogoOverlayConfig | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const timerSalvarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerSalvoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqSalvarRef = useRef(0);
  // Última configuração escolhida localmente: evita que a resposta de um PUT
  // antigo (ainda em voo) sobrescreva uma escolha mais recente.
  const ultimaRef = useRef<FogoOverlayConfig | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resp = await buscarJson<{ fogo?: FogoOverlayConfig }>('/api/overlay/config');
        if (ativo) setConfig(resp.fogo ?? fogoPadrao());
      } catch (e) {
        if (ativo) setErro((e as Error).message);
      }
    })();
    return () => {
      ativo = false;
      if (timerSalvarRef.current) clearTimeout(timerSalvarRef.current);
      if (timerSalvoRef.current) clearTimeout(timerSalvoRef.current);
    };
  }, []);

  async function persistir(nova: FogoOverlayConfig) {
    const seq = ++seqSalvarRef.current;
    setSalvando(true);
    setErro('');
    try {
      const resp = await buscarJson<{ fogo?: FogoOverlayConfig }>('/api/overlay/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fogo: nova }),
      });
      if (seq !== seqSalvarRef.current) return;
      if (resp.fogo && ultimaRef.current === nova) setConfig(resp.fogo);
      setSalvo(true);
      if (timerSalvoRef.current) clearTimeout(timerSalvoRef.current);
      timerSalvoRef.current = setTimeout(() => setSalvo(false), 1800);
    } catch (e) {
      if (seq !== seqSalvarRef.current) return;
      setErro((e as Error).message);
    } finally {
      if (seq === seqSalvarRef.current) setSalvando(false);
    }
  }

  // Atualiza a prévia na hora e grava com um pequeno atraso (slider/sequência
  // de cliques não dispara um PUT por evento).
  function alterar(nova: FogoOverlayConfig) {
    ultimaRef.current = nova;
    setConfig(nova);
    if (timerSalvarRef.current) clearTimeout(timerSalvarRef.current);
    timerSalvarRef.current = setTimeout(() => void persistir(nova), 400);
  }

  const ativo = config?.ativo ?? false;

  return (
    <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
          <Flame className="h-5 w-5 text-amber-500" />
          Transição de Fogo
        </h2>
        <span className="flex min-h-4 items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500">
          {salvando ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              salvando
            </>
          ) : salvo ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              salvo
            </>
          ) : (
            'global'
          )}
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-gray-500">
        Vale para todas as cenas. Quando a cena ativa muda, o fogo cobre a tela e a cena
        nova aparece na revelação — igual ao demo, sem troca seca.
      </p>

      {erro && (
        <div className="mb-3">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      )}

      {!config ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-sm text-gray-500">
          Carregando...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => alterar({ ...config, ativo: false })}
              aria-pressed={!ativo}
              className={`col-span-2 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors ${
                !ativo
                  ? 'border-[#e8a020]/60 bg-[#e8a020]/15 text-white'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                  !ativo
                    ? 'border-[#e8a020]/40 bg-[#e8a020]/10 text-[#e8a020]'
                    : 'border-white/10 bg-black/20 text-gray-400'
                }`}
              >
                <X className="h-4 w-4" />
              </span>
              Desativado
            </button>

            {PALETAS_UI.map(({ paleta, nome, descricao, swatch }) => {
              const selecionada = ativo && config.paleta === paleta;
              return (
                <button
                  key={paleta}
                  type="button"
                  onClick={() => alterar({ ...config, ativo: true, paleta })}
                  aria-pressed={selecionada}
                  title={descricao}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                    selecionada
                      ? 'border-[#e8a020]/60 bg-[#e8a020]/15 text-white'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-7 w-7 shrink-0 rounded-md border border-white/15"
                    style={{ background: swatch }}
                  />
                  <span className="min-w-0 truncate">{nome}</span>
                </button>
              );
            })}
          </div>

          <div className={`mt-3 ${ativo ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-500">
              <label htmlFor="fogo-duracao">Duração</label>
              <output htmlFor="fogo-duracao" className="text-gray-200">
                {formatarDuracao(config.duracaoMs)}
              </output>
            </div>
            <input
              id="fogo-duracao"
              type="range"
              min={FOGO_DURACAO_MIN_MS}
              max={FOGO_DURACAO_MAX_MS}
              step={100}
              value={config.duracaoMs}
              onChange={(e) => alterar({ ...config, duracaoMs: Number(e.target.value) })}
              className="mt-1 w-full accent-[#e8a020]"
            />
          </div>
        </>
      )}
    </section>
  );
}
