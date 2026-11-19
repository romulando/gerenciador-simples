'use client';

import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, TriangleAlert, Info, type LucideIcon } from 'lucide-react';

export type AlertaTipo = 'erro' | 'sucesso' | 'aviso' | 'info';

const ESTILOS: Record<AlertaTipo, { box: string; icon: string; Icon: LucideIcon }> = {
  erro: {
    box: 'border-red-500/30 bg-red-500/10 text-red-200',
    icon: 'text-red-400',
    Icon: CircleAlert,
  },
  sucesso: {
    box: 'border-green-500/30 bg-green-500/10 text-green-200',
    icon: 'text-green-400',
    Icon: CircleCheck,
  },
  aviso: {
    box: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    icon: 'text-amber-400',
    Icon: TriangleAlert,
  },
  info: {
    box: 'border-white/15 bg-white/5 text-gray-200',
    icon: 'text-[#e8a020]',
    Icon: Info,
  },
};

export default function Alerta({
  tipo = 'erro',
  children,
  className = '',
  boxClassName,
}: {
  tipo?: AlertaTipo;
  children: ReactNode;
  className?: string;
  boxClassName?: string;
}) {
  const { box, icon, Icon } = ESTILOS[tipo];
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm backdrop-blur-xl ${boxClassName ?? box} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
