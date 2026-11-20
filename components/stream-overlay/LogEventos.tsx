'use client';

import {
  Clapperboard,
  Gamepad2,
  Link2,
  RadioTower,
  ScrollText,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react';
import type { EventoOverlay } from './common';

function formatarHoraEvento(valor: string): string {
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}:${m[6]}` : valor;
}

const ESTILO_POR_TIPO: Record<
  string,
  { Icone: typeof RadioTower; rotulo: string; cor: string; fundo: string; borda: string }
> = {
  gsi_conectado: {
    Icone: RadioTower,
    rotulo: 'GSI',
    cor: 'text-sky-300',
    fundo: 'bg-sky-500/10',
    borda: 'border-sky-500/30',
  },
  gsi_erro_partida: {
    Icone: TriangleAlert,
    rotulo: 'GSI',
    cor: 'text-red-300',
    fundo: 'bg-red-500/10',
    borda: 'border-red-500/30',
  },
  conta_detectada: {
    Icone: UserRoundCheck,
    rotulo: 'Conta',
    cor: 'text-[#e8a020]',
    fundo: 'bg-[#e8a020]/10',
    borda: 'border-[#e8a020]/30',
  },
  jogo_salvo: {
    Icone: Gamepad2,
    rotulo: 'Jogo',
    cor: 'text-green-300',
    fundo: 'bg-green-500/10',
    borda: 'border-green-500/30',
  },
  vinculo_auto: {
    Icone: Link2,
    rotulo: 'Vínculo',
    cor: 'text-indigo-300',
    fundo: 'bg-indigo-500/10',
    borda: 'border-indigo-500/30',
  },
  cena_trocada: {
    Icone: Clapperboard,
    rotulo: 'Cena',
    cor: 'text-purple-300',
    fundo: 'bg-purple-500/10',
    borda: 'border-purple-500/30',
  },
};

export default function LogEventos({ eventos }: { eventos: EventoOverlay[] }) {
  return (
    <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
          <ScrollText className="h-5 w-5 text-amber-500" />
          Log de Eventos
        </h2>
        <span className="text-[11px] uppercase tracking-wide text-gray-500">
          conta detectada · jogos salvos
        </span>
      </div>

      {eventos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-gray-500">
          Nenhum evento ainda. Abra o Dota 2 com o GSI configurado para acompanhar.
        </p>
      ) : (
        <ul className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
          {eventos.map((evento) => {
            const estilo = ESTILO_POR_TIPO[evento.tipo] ?? {
              Icone: RadioTower,
              rotulo: evento.tipo || 'Evento',
              cor: 'text-gray-300',
              fundo: 'bg-white/5',
              borda: 'border-white/10',
            };
            const { Icone } = estilo;
            return (
              <li
                key={evento.id}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${estilo.borda} ${estilo.fundo} ${estilo.cor}`}
                >
                  <Icone className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-200">{evento.mensagem}</p>
                  <p className="text-[11px] text-gray-500">
                    <span className={`mr-2 font-medium uppercase tracking-wide ${estilo.cor}`}>
                      {estilo.rotulo}
                    </span>
                    {evento.clienteNome && <span className="mr-2">{evento.clienteNome}</span>}
                    {formatarHoraEvento(evento.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
