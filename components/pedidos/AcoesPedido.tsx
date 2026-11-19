'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, RefreshCw, Save } from 'lucide-react';
import { ESTADOS } from '@/lib/helpers';
import { enviarJson } from './common';
import Alerta from '@/components/ui/Alerta';
import type { PedidoTheone, RespostaRecalculo } from '@/lib/types';

const SITE_URL = 'https://boostmmr.com.br';

export default function AcoesPedido({ pedido }: { pedido: PedidoTheone }) {
  const router = useRouter();
  const [estado, setEstado] = useState(pedido.estado);
  const [salvando, setSalvando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [resultado, setResultado] = useState<RespostaRecalculo | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro('');
    setAviso('');
    try {
      const res = await enviarJson<{ ok: boolean; aviso?: string }>(
        `/api/orders/${pedido.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado }),
        }
      );
      if (res.aviso) setAviso(res.aviso);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function recalcular() {
    setRecalculando(true);
    setErro('');
    setAviso('');
    try {
      const res = await enviarJson<RespostaRecalculo & { ok: boolean }>(
        `/api/orders/${pedido.id}/recalcular`,
        { method: 'POST' }
      );
      setResultado(res);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Ações</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${SITE_URL}/acompanhamento/?id=${encodeURIComponent(pedido.tracking_id)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white transition-colors hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver no site
          </a>
          <button
            type="button"
            onClick={recalcular}
            disabled={recalculando}
            className="inline-flex items-center gap-2 rounded-full border border-[#e8a020]/30 bg-[#e8a020]/10 px-4 py-2 text-xs font-medium text-[#f3c46a] transition-colors hover:bg-[#e8a020]/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recalculando ? 'animate-spin' : ''}`} />
            {recalculando ? 'Recalculando…' : 'Recalcular no site'}
          </button>
        </div>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {aviso && <Alerta tipo="aviso">Registro salvo, mas o recálculo falhou: {aviso}</Alerta>}
      {resultado && (
        <Alerta tipo="sucesso">
          Site recalculou: MMR final <strong>{resultado.calculo.mmr_final_calculado}</strong> ·
          saldo restante <strong>R$ {resultado.calculo.saldo_restante.toFixed(2)}</strong> ·
          progresso <strong>{resultado.calculo.progresso_pct.toFixed(2)}%</strong>
        </Alerta>
      )}

      <div className="sm:max-w-[260px]">
        <label className="mb-1 block text-xs font-medium text-gray-400">Estado do pedido</label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
        >
          {Object.entries(ESTADOS).map(([valor, info]) => (
            <option key={valor} value={valor}>
              {info.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:scale-[1.02] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {salvando ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </div>
  );
}
