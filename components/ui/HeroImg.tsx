'use client';

import { useState } from 'react';

// Imagem do herói servida localmente (/images/heroes/<interno>.png).
// Usada no Histórico de Partidas, no detalhe da partida e nos registros do pedido.
export default function HeroImg({
  interno,
  nome,
  className,
}: {
  interno: string;
  nome: string;
  className?: string;
}) {
  const [erro, setErro] = useState(false);
  if (erro || !interno) {
    return (
      <span
        title={nome}
        className={`${className ?? ''} flex items-center justify-center rounded bg-white/10 text-[10px] font-semibold text-gray-500`}
      >
        ?
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/heroes/${interno}.png`}
      alt={nome}
      title={nome}
      className={className}
      onError={() => setErro(true)}
    />
  );
}
