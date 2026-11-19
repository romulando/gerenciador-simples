'use client';

import { useState } from 'react';

// Contador global de camadas. Cada modal montado recebe um z-index maior que o
// anterior, garantindo que o último aberto fique sempre na frente,
// independentemente da ordem em que os modais aparecem no JSX.
let contador = 50;

export function useCamadaModal(): number {
  const [z] = useState(() => ++contador);
  return z;
}
