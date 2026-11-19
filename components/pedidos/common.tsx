'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copiarTexto } from '@/lib/clipboard';
import { ESTADOS, formatarMoeda } from '@/lib/helpers';

export const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 transition-all duration-300 focus:border-white/30 focus:bg-white/10 focus:outline-none';
export const labelCls = 'block text-xs font-medium text-gray-400 mb-1';
export const btnPrimary =
  'rounded-full bg-white text-black font-semibold px-5 py-2.5 text-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(255,255,255,0.18)] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none';
export const btnSecondary =
  'rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm text-white backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:bg-white/10';
export const btnDanger =
  'rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/20';

export async function buscarJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Falha na requisição (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

export async function enviarJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Falha na requisição (HTTP ${res.status})`);
  return json;
}

export function TrackingBadge({ trackingId }: { trackingId: string | null | undefined }) {
  const [copiado, setCopiado] = useState(false);
  if (!trackingId) return <span className="text-gray-600">—</span>;
  return (
    <button
      type="button"
      title="Clique para copiar"
      onClick={async (e) => {
        e.stopPropagation();
        if (!(await copiarTexto(trackingId))) return;
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded border border-sky-700/60 bg-sky-900/60 px-2 py-0.5 font-mono text-xs text-sky-300 transition-colors hover:bg-sky-800/60"
    >
      {trackingId}
      {copiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function BadgeEstado({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? {
    label: estado,
    classe: 'bg-gray-600/20 text-gray-300 border-gray-500/40',
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${e.classe}`}
    >
      {e.label}
    </span>
  );
}

export function ValorBadge({ valor }: { valor: number | null | undefined }) {
  return (
    <span className="whitespace-nowrap font-medium tabular-nums text-emerald-300">
      {formatarMoeda(valor)}
    </span>
  );
}

// Tipos usados pelos componentes da overlay (formato interno do painel).
export interface Pedido {
  id: number | string;
  trackingId: string | null;
  tipoServico: string;
  adicional?: string | null;
  estado?: string;
  mmrInicial: number | null;
  mmrAtual: number | null;
  mmrDesejado: number | null;
  mmrFinalCalculado?: number | null;
  progressoPct?: number | null;
  partidas?: number | null;
  partidasJogadas?: number;
  medalha?: string | null;
  valor?: number;
  clienteNome?: string | null;
  booster1Nome?: string | null;
  booster2Nome?: string | null;
  observacoes?: string | null;
  [k: string]: unknown;
}

export interface RegistroMmr {
  id: number | string;
  data: string;
  mmrInicial: number;
  mmrFinal: number;
  observacoes?: string | null;
  hero?: string | null;
  resultado?: string | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  motivoAjuste?: string | null;
  [k: string]: unknown;
}

export interface RegistroPartidas {
  id: number | string;
  data: string;
  quantidade: number;
  medalha?: string | null;
  observacoes?: string | null;
  hero?: string | null;
  resultado?: string | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  [k: string]: unknown;
}
