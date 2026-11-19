import type { LogTheone } from '@/lib/types';

function dataHoraIso(valor: string): string {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CORES: Record<string, string> = {
  criacao: 'bg-sky-500',
  mmr: 'bg-emerald-500',
  partidas: 'bg-[#e8a020]',
  ajuste_mmr: 'bg-amber-500',
  estado: 'bg-blue-500',
  observacao: 'bg-gray-400',
  recalculo: 'bg-violet-500',
  erro: 'bg-red-500',
};

export default function LogPedido({ logs }: { logs: LogTheone[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Log do pedido</h2>
      {logs.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Nenhuma alteração registrada ainda.</p>
      ) : (
        <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {logs.map((log) => (
            <li key={log.id} className="flex gap-3 rounded-xl border border-white/5 bg-black/20 p-2.5">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CORES[log.tipo] ?? 'bg-gray-500'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-gray-200">{log.mensagem}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{dataHoraIso(log.criado_em)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
