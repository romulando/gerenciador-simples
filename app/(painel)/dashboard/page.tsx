import Link from 'next/link';
import { Activity, CheckCircle2, Clock3, Wallet } from 'lucide-react';
import { listarPedidos } from '@/lib/data';
import { formatarMoeda, TIPOS_SERVICO } from '@/lib/helpers';
import { percentual, textoQuantidade, valorPedido } from '@/lib/resumo';
import ListaPedidos from '@/components/pedidos/ListaPedidos';
import Alerta from '@/components/ui/Alerta';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let pedidos = [] as Awaited<ReturnType<typeof listarPedidos>>;
  let erro = '';
  try {
    pedidos = await listarPedidos();
  } catch (e) {
    erro = (e as Error).message;
  }

  const ativos = pedidos.filter((p) => p.estado === 'em_andamento');
  const concluidos = pedidos.filter((p) => p.estado === 'concluido');
  const pausados = pedidos.filter((p) => p.estado === 'pausado');
  const valorAtivo = ativos.reduce((acc, p) => acc + valorPedido(p), 0);
  const progressoMedio = ativos.length
    ? ativos.reduce((acc, p) => acc + percentual(p), 0) / ativos.length
    : 0;

  const cards = [
    {
      label: 'Em andamento',
      valor: String(ativos.length),
      detalhe: `${pausados.length} pausado(s)`,
      Icon: Activity,
      cor: 'text-blue-300',
    },
    {
      label: 'Concluídos',
      valor: String(concluidos.length),
      detalhe: `${pedidos.length} pedido(s) no total`,
      Icon: CheckCircle2,
      cor: 'text-green-300',
    },
    {
      label: 'Valor em andamento',
      valor: formatarMoeda(valorAtivo),
      detalhe: 'Soma dos pedidos ativos',
      Icon: Wallet,
      cor: 'text-emerald-300',
    },
    {
      label: 'Progresso médio',
      valor: `${progressoMedio.toFixed(0)}%`,
      detalhe: 'Somente pedidos ativos',
      Icon: Clock3,
      cor: 'text-[#e8a020]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e8a020]">
            Painel do booster
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Visão dos pedidos atribuídos ao Theone.
          </p>
        </div>
        <Link
          href="/pedidos"
          className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/10"
        >
          Ver todos os pedidos
        </Link>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.Icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {card.label}
                </p>
                <Icon className={`h-4 w-4 ${card.cor}`} />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">{card.valor}</p>
              <p className="mt-1 text-xs text-gray-500">{card.detalhe}</p>
            </div>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Pedidos em andamento</h2>
          <span className="text-xs text-gray-500">
            {ativos.length} pedido(s)
          </span>
        </div>

        {ativos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-400">
            Nenhum pedido em andamento no momento.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {ativos.map((p) => (
              <Link
                key={p.id}
                href={`/pedidos/${p.id}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:border-[#e8a020]/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-sky-300">{p.tracking_id}</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {TIPOS_SERVICO[p.tipo_servico] ?? p.tipo_servico}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-gray-300">
                    {p.medalha || '—'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="tabular-nums text-gray-300">{textoQuantidade(p)}</span>
                  <span className="font-medium text-emerald-300">
                    {formatarMoeda(valorPedido(p))}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#e8a020] to-[#f3c46a]"
                      style={{ width: `${percentual(p)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-gray-500">
                    <span>Progresso</span>
                    <span>{percentual(p).toFixed(0)}%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Todos os pedidos</h2>
        <ListaPedidos pedidos={pedidos} />
      </section>
    </div>
  );
}
