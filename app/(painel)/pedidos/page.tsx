import { listarPedidos } from '@/lib/data';
import ListaPedidos from '@/components/pedidos/ListaPedidos';
import Alerta from '@/components/ui/Alerta';

export const dynamic = 'force-dynamic';

export default async function PedidosPage() {
  let pedidos = [] as Awaited<ReturnType<typeof listarPedidos>>;
  let erro = '';
  try {
    pedidos = await listarPedidos();
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e8a020]">
          Pedidos
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Seus pedidos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Somente os pedidos atribuídos ao Theone, com tracking protegido por RLS.
        </p>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <ListaPedidos pedidos={pedidos} />
    </div>
  );
}
