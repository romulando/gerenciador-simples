'use client';

import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { copiarTexto } from '@/lib/clipboard';
import Modal from '@/components/Modal';
import Alerta from '@/components/ui/Alerta';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { btnPrimary, btnSecondary } from '@/components/pedidos/common';
import {
  LIVEPIX_META_MAX,
  OVERLAY_SUB_META_MAX,
  OVERLAY_WINS_LIMITE_MAX,
  OVERLAY_WINS_LIMITE_MIN,
} from './common';
import LivePixConfig from './LivePixConfig';
import TwitchSubsConfig from './TwitchSubsConfig';

export default function ConfigOverlayModal({
  limiteWins,
  modoBoost,
  subAtivo,
  subMeta,
  livepixAtivo,
  livepixMeta,
  urlOverlay,
  onFechar,
  onSalvar,
}: {
  limiteWins: number;
  modoBoost: boolean;
  subAtivo: boolean;
  subMeta: number;
  livepixAtivo: boolean;
  livepixMeta: number;
  urlOverlay: string;
  onFechar: () => void;
  onSalvar: (cfg: {
    limiteWins: number;
    modoBoost: boolean;
    subAtivo: boolean;
    subMeta: number;
    livepixAtivo: boolean;
    livepixMeta: number;
  }) => Promise<void>;
}) {
  const [limite, setLimite] = useState(String(limiteWins));
  const [boost, setBoost] = useState(modoBoost);
  const [subs, setSubs] = useState(subAtivo);
  const [meta, setMeta] = useState(subMeta > 0 ? String(subMeta) : '');
  const [barraPix, setBarraPix] = useState(livepixAtivo);
  const [metaPix, setMetaPix] = useState(
    livepixMeta > 0 ? String(livepixMeta).replace('.', ',') : ''
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function copiarUrl() {
    if (!(await copiarTexto(urlOverlay))) {
      setErro('Não foi possível copiar a URL.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(limite);
    if (
      !Number.isFinite(valor) ||
      valor < OVERLAY_WINS_LIMITE_MIN ||
      valor > OVERLAY_WINS_LIMITE_MAX
    ) {
      setErro(
        `Informe um número entre ${OVERLAY_WINS_LIMITE_MIN} e ${OVERLAY_WINS_LIMITE_MAX}.`
      );
      return;
    }
    const metaValor = meta.trim() === '' ? 0 : Number(meta);
    if (!Number.isFinite(metaValor) || metaValor < 0 || metaValor > OVERLAY_SUB_META_MAX) {
      setErro(`A meta de subs deve ser um número entre 0 e ${OVERLAY_SUB_META_MAX}.`);
      return;
    }
    const metaPixValor = metaPix.trim() === '' ? 0 : Number(metaPix.replace(',', '.'));
    if (!Number.isFinite(metaPixValor) || metaPixValor < 0 || metaPixValor > LIVEPIX_META_MAX) {
      setErro(`A meta do LivePix deve ser um número entre 0 e ${LIVEPIX_META_MAX} (reais).`);
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSalvar({
        limiteWins: Math.round(valor),
        modoBoost: boost,
        subAtivo: subs,
        subMeta: Math.round(metaValor),
        livepixAtivo: barraPix,
        livepixMeta: Math.round(metaPixValor * 100) / 100,
      });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Configuração da Overlay" largura="max-w-2xl" onClose={onFechar}>
      <form onSubmit={submeter} className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <label className="block text-xs font-medium text-gray-400" htmlFor="overlay-limite-wins">
              Modo de contagem de Wins: banco local
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Últimas</span>
              <input
                id="overlay-limite-wins"
                autoFocus
                inputMode="numeric"
                value={limite}
                onChange={(e) => setLimite(e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="h-9 w-16 rounded-lg border border-[#e8a020]/40 bg-white/5 text-center text-sm font-semibold text-white transition-all duration-300 focus:border-[#e8a020]/70 focus:bg-white/10 focus:outline-none"
              />
              <span className="text-[11px] text-gray-400">partidas</span>
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            Usa as partidas salvas no banco local (GSI/manual) da conta logada no Dota 2; sem
            conta detectada, usa a conta do pedido em exibição.
          </p>
        </div>

        <ToggleSwitch
          compact
          checked={boost}
          onChange={setBoost}
          label="Modo Boost"
          badge={boost ? 'ativo' : 'inativo'}
          title="Mostra a linha com a medalha inicial → final e os MMRs na overlay"
        />

        <TwitchSubsConfig
          subAtivo={subs}
          subMeta={meta}
          onSubAtivoChange={setSubs}
          onSubMetaChange={setMeta}
        />

        <LivePixConfig
          barraAtiva={barraPix}
          barraMeta={metaPix}
          onBarraAtivaChange={setBarraPix}
          onBarraMetaChange={setMetaPix}
        />

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-300">
            <Link2 className="h-3.5 w-3.5 text-[#e8a020]" />
            URL da overlay para o OBS (Browser Source)
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={urlOverlay}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-gray-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void copiarUrl()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? 'Copiada!' : 'Copiar'}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            No OBS, adicione uma fonte de navegador 1920×1080 com esta URL. O token é o que
            libera os dados sem precisar de login.
          </p>
        </div>

        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" className={btnSecondary} onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className={btnPrimary} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
