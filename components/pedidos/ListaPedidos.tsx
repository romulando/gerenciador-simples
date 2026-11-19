'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ESTADOS, TIPOS_SERVICO } from '@/lib/helpers';
import { percentual, textoQuantidade, valorPedido } from '@/lib/resumo';
import { BadgeEstado, TrackingBadge, ValorBadge } from './common';
import Progresso from './Progresso';
import type { PedidoTheone } from '@/lib/types';

export default function ListaPedidos({ pedidos }: { pedidos: PedidoTheone[] }) {
  const [busca, setBusca] = useState('');
  const [estado, setEstado] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (estado && p.estado !== estado) return false;
      if (!termo) return true;
      return (
        p.tracking_id.toLowerCase().includes(termo) ||
        (TIPOS_SERVICO[p.tipo_servico] ?? p.tipo_servico).toLowerCase().includes(termo)
      );
    });
  }, [pedidos, busca, estado]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por tracking ou serviço"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-white/30 focus:bg-white/10"
          />
        </div>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
        >
          <option value="">Todos os estados</option>
          {Object.entries(ESTADOS).map(([valor, info]) => (
            <option key={valor} value={valor}>
              {info.label}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-400">
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 font-medium">Tracking</th>
                  <th className="px-4 py-3 font-medium">Serviço</th>
                  <th className="px-4 py-3 font-medium">MMR / Quantidade</th>
                  <th className="px-4 py-3 font-medium">Medalha</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Progresso</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/pedidos/${p.id}`} className="block">
                        <TrackingBadge trackingId={p.tracking_id} />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/pedidos/${p.id}`} className="text-gray-200 hover:text-white">
                        {TIPOS_SERVICO[p.tipo_servico] ?? p.tipo_servico}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-300">
                      {textoQuantidade(p)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.medalha || '—'}</td>
                    <td className="px-4 py-3">
                      <ValorBadge valor={valorPedido(p)} />
                    </td>
                    <td className="w-44 px-4 py-3">
                      <Progresso pct={percentual(p)} />
                    </td>
                    <td className="px-4 py-3">
                      <BadgeEstado estado={p.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
