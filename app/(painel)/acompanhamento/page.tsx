import Link from 'next/link';
import { Activity, ArrowRight, CheckCircle2, PauseCircle } from 'lucide-react';
import { listarPedidos } from '@/lib/data';
import { getDb } from '@/lib/db';
import { getEstadoGsi } from '@/lib/gsi';
import { listarContasPedidos } from '@/lib/pedidoContas';
import {
  getPedidoSelecionado,
  getPedidoSelecionadoTipo,
} from '@/lib/pedidoSelecionado';
import { resumoPendentes } from '@/lib/registrosPendentes';
import { ehServicoSolo, formatarMoeda, TIPOS_SERVICO } from '@/lib/helpers';
import { percentual, textoQuantidade, valorPedido } from '@/lib/resumo';
import Progresso from '@/components/pedidos/Progresso';
import AvisoSemConta from '@/components/pedidos/AvisoSemConta';
import GsiConfig from '@/components/stream-overlay/GsiConfig';
import StatusGsi from '@/components/acompanhamento/StatusGsi';
import Alerta from '@/components/ui/Alerta';

export const dynamic = 'force-dynamic';

export default async function AcompanhamentoPage() {
  let pedidos = [] as Awaited<ReturnType<typeof listarPedidos>>;
  let erro = '';
  try {
    pedidos = await listarPedidos();
  } catch (e) {
    erro = (e as Error).message;
  }

  const ativos = pedidos.filter((p) => p.estado === 'em_andamento');
  const pausados = pedidos.filter((p) => p.estado === 'pausado');
  const concluidos = pedidos.filter((p) => p.estado === 'concluido');

  const db = getDb();
  const gsi = getEstadoGsi();
  const contas = listarContasPedidos(db);
  const contasPorTracking = new Map(
    contas.map((conta) => [conta.trackingId, conta.accountId])
  );

  // O ID do cliente é usado no vínculo automático apenas nos serviços solo.
  // Duo/grupo é vinculado pelo pedido selecionado na overlay.
  const pedidosSemConta = ativos
    .filter((p) => ehServicoSolo(p.tipo_servico))
    .filter((p) => !contasPorTracking.get(String(p.tracking_id ?? '').toUpperCase()))
    .map((p) => ({ trackingId: p.tracking_id, tipoServico: p.tipo_servico }));

  const statusInicial = {
    gsi,
    pedidoSelecionado: getPedidoSelecionado(db),
    pedidoSelecionadoTipo: getPedidoSelecionadoTipo(db),
    contas,
    pendentes: resumoPendentes(db),
  };

  const pedidosStatus = pedidos.map((p) => ({
    id: p.id,
    tracking_id: p.tracking_id,
    tipo_servico: p.tipo_servico,
    estado: p.estado,
  }));

  const grupos = [
    { titulo: 'Em andamento', lista: ativos, Icon: Activity, cor: 'text-blue-300' },
    { titulo: 'Pausados', lista: pausados, Icon: PauseCircle, cor: 'text-orange-300' },
    { titulo: 'Concluídos', lista: concluidos, Icon: CheckCircle2, cor: 'text-green-300' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e8a020]">
          Acompanhamento
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Registrar progresso</h1>
        <p className="mt-1 text-sm text-gray-400">
          Abra o pedido para lançar MMR, partidas e ajustes. Cada alteração é recalculada pelo site.
        </p>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <StatusGsi statusInicial={statusInicial} pedidos={pedidosStatus} />

      <AvisoSemConta
        pedidos={pedidosSemConta}
        contaDetectada={gsi.online ? gsi.accountId : null}
      />

      <GsiConfig />

      {grupos.map((grupo) => {
        const Icon = grupo.Icon;
        return (
          <section key={grupo.titulo} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${grupo.cor}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                {grupo.titulo} ({grupo.lista.length})
              </h2>
            </div>

            {grupo.lista.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-gray-500">
                Nenhum pedido neste estado.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {grupo.lista.map((p) => {
                  const conta = contasPorTracking.get(
                    String(p.tracking_id ?? '').toUpperCase()
                  );
                  const logadaAgora = Boolean(
                    conta && gsi.online && gsi.accountId === conta
                  );
                  return (
                    <Link
                      key={p.id}
                      href={`/pedidos/${p.id}#acompanhamento`}
                      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-[#e8a020]/30 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-sky-300">{p.tracking_id}</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {TIPOS_SERVICO[p.tipo_servico] ?? p.tipo_servico}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">{textoQuantidade(p)}</p>
                          {conta && (
                            <p className="mt-1 text-[11px] text-emerald-300/80">
                              Conta Dota 2: {conta}
                              {logadaAgora && (
                                <span className="ml-1 rounded-full border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">
                                  logada agora
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-emerald-300">
                            {formatarMoeda(valorPedido(p))}
                          </p>
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#f3c46a]">
                            Registrar
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progresso pct={percentual(p)} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
