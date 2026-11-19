import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { listarLogs, listarRegistros, obterPedido } from '@/lib/data';
import {
  formatarDataIso,
  formatarMoeda,
  isBoost,
  rotuloQuantidade,
  TIPOS_SERVICO,
} from '@/lib/helpers';
import { medalhaDoMmr, medalhaDoNome } from '@/lib/medals';
import { percentual, textoMmr, textoQuantidade, valorPedido } from '@/lib/resumo';
import { BadgeEstado, TrackingBadge } from '@/components/pedidos/common';
import Progresso from '@/components/pedidos/Progresso';
import AcoesPedido from '@/components/pedidos/AcoesPedido';
import RegistrosPedido from '@/components/pedidos/RegistrosPedido';
import LogPedido from '@/components/pedidos/LogPedido';
import Alerta from '@/components/ui/Alerta';

export const dynamic = 'force-dynamic';

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let pedido = null;
  let registros = [] as Awaited<ReturnType<typeof listarRegistros>>;
  let logs = [] as Awaited<ReturnType<typeof listarLogs>>;
  let erro = '';

  try {
    pedido = await obterPedido(id);
    if (pedido) {
      [registros, logs] = await Promise.all([listarRegistros(id), listarLogs(id)]);
    }
  } catch (e) {
    erro = (e as Error).message;
  }

  if (!pedido && !erro) notFound();

  if (!pedido) {
    return (
      <div className="space-y-4">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para pedidos
        </Link>
        <Alerta tipo="erro">{erro || 'Pedido não encontrado.'}</Alerta>
      </div>
    );
  }

  const medalha =
    medalhaDoMmr(pedido.mmr_atual) ??
    (pedido.medalha ? { nome: pedido.medalha, imagem: medalhaDoNome(pedido.medalha), cor: '#e8a020', nivel: 0 } : null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para pedidos
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {TIPOS_SERVICO[pedido.tipo_servico] ?? pedido.tipo_servico}
            </h1>
            <BadgeEstado estado={pedido.estado} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <TrackingBadge trackingId={pedido.tracking_id} />
            <span>Pedido recebido em {formatarDataIso(pedido.created_at)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-gray-500">Valor do pedido</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {formatarMoeda(valorPedido(pedido))}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Dados do serviço
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">
                  {isBoost(pedido.tipo_servico) ? 'MMR inicial → atual → final' : 'Quantidade'}
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-white">
                  {textoQuantidade(pedido)}
                </p>
                {isBoost(pedido.tipo_servico) && (
                  <p className="mt-1 text-xs text-gray-500">Contratado: {textoMmr(pedido)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Medalha</p>
                <div className="mt-1 flex items-center gap-2">
                  {medalha && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={medalha.imagem} alt={medalha.nome} className="h-8 w-8 object-contain" />
                  )}
                  <span className="text-base font-semibold text-white">
                    {medalha?.nome ?? pedido.medalha ?? '—'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Adicional</p>
                <p className="mt-1 text-base font-semibold text-white">{pedido.adicional || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cupom</p>
                <p className="mt-1 text-base font-semibold text-white">{pedido.cupom || '—'}</p>
              </div>
            </div>

            {pedido.observacoes && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-gray-500">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-200">{pedido.observacoes}</p>
              </div>
            )}
          </div>

          <AcoesPedido pedido={pedido} />
          <RegistrosPedido pedido={pedido} registros={registros} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Progresso
            </h2>
            <div className="mt-4">
              <Progresso pct={percentual(pedido)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">MMR final</p>
                <p className="mt-1 text-xl font-bold text-white">
                  {pedido.mmr_final_calculado ?? pedido.mmr_desejado ?? '—'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">MMR atual</p>
                <p className="mt-1 text-xl font-bold text-white">{pedido.mmr_atual ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Saldo restante</p>
                <p className="mt-1 text-lg font-bold text-emerald-300">
                  {pedido.saldo_restante != null ? formatarMoeda(pedido.saldo_restante) : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Consumido</p>
                <p className="mt-1 text-lg font-bold text-amber-300">
                  {pedido.consumido != null ? formatarMoeda(pedido.consumido) : '—'}
                </p>
              </div>
            </div>
            {!isBoost(pedido.tipo_servico) && (
              <p className="mt-3 text-xs text-gray-500">
                {pedido.partidas_jogadas}/{pedido.partidas ?? '—'}{' '}
                {rotuloQuantidade(pedido.tipo_servico)}
              </p>
            )}
            <p className="mt-3 text-[11px] text-gray-500">
              {pedido.recalculado_em
                ? `Recalculado em ${new Date(pedido.recalculado_em).toLocaleString('pt-BR')}`
                : 'Ainda não recalculado no site.'}
            </p>
          </div>

          <LogPedido logs={logs} />
        </div>
      </div>
    </div>
  );
}
