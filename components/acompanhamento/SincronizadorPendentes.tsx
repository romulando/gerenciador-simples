'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Processa a fila local de partidas (registros_pendentes) em qualquer página
// autenticada do painel. Antes, só o Acompanhamento e a Stream Overlay faziam
// isso; se o booster ficasse no Dashboard com o painel aberto, a partida ficava
// esperando. A rota POST usa a sessão do navegador (RLS do Theone).
export default function SincronizadorPendentes() {
  const router = useRouter();
  const processando = useRef(false);

  useEffect(() => {
    let ativo = true;

    async function rodar() {
      if (processando.current) return;
      processando.current = true;
      try {
        const resumo = await fetch('/api/acompanhamento/pendentes', {
          cache: 'no-store',
        });
        if (!resumo.ok) return;
        const dados = (await resumo.json()) as { pendentes?: number };
        if (!ativo || !Number(dados.pendentes)) return;

        const resposta = await fetch('/api/acompanhamento/pendentes', {
          method: 'POST',
        });
        if (!resposta.ok) return;
        const resultado = (await resposta.json()) as {
          registrados?: number;
          recalculados?: number;
        };
        if (
          ativo &&
          (Number(resultado.registrados) > 0 || Number(resultado.recalculados) > 0)
        ) {
          router.refresh();
        }
      } catch {
        // Sincronização é acessória: uma falha não pode atrapalhar o painel.
      } finally {
        processando.current = false;
      }
    }

    void rodar();
    const timer = setInterval(() => void rodar(), 30_000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
