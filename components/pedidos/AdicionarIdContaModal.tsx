'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import Alerta from '@/components/ui/Alerta';
import { btnPrimary, btnSecondary, enviarJson } from '@/components/pedidos/common';
import { contaDotaValida } from '@/lib/contaDota';

export default function AdicionarIdContaModal({
  trackingId,
  contaAtual,
  onFechar,
  onSalvo,
}: {
  trackingId: string;
  contaAtual?: string | null;
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
}) {
  const [id, setId] = useState(contaAtual ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(accountId: string) {
    setErro('');
    setSalvando(true);
    try {
      await enviarJson('/api/pedidos/contas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingId, accountId }),
      });
      await onSalvo();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!contaDotaValida(id)) {
      setErro('Informe um ID numérico válido (mínimo 4 dígitos).');
      return;
    }
    await salvar(id);
  }

  return (
    <Modal
      titulo={`ID do Dota 2 — ${trackingId}`}
      descricao="Usado para vincular automaticamente as partidas do GSI a este pedido."
      largura="max-w-md"
      onClose={onFechar}
    >
      <form onSubmit={submeter} className="space-y-4">
        <div className="relative">
          <input
            autoFocus
            inputMode="numeric"
            placeholder="Ex: 123456789"
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D/g, ''))}
            className="h-12 w-full rounded-xl border border-[#e8a020]/40 bg-white/5 text-center text-2xl font-semibold tracking-tight text-white placeholder-gray-600 transition-all duration-300 focus:border-[#e8a020]/70 focus:bg-white/10 focus:outline-none"
          />
          <div className="pointer-events-none absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-transparent via-[#e8a020]/60 to-transparent" />
        </div>

        <p className="text-xs leading-relaxed text-gray-400">
          Informe o <span className="text-gray-200">account_id</span> da conta Dota 2 (mínimo 4
          dígitos) ou o <span className="text-gray-200">SteamID64</span> de 17 dígitos — convertemos
          automaticamente para o ID usado pelo GSI.
        </p>

        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          {contaAtual ? (
            <button
              type="button"
              className={btnSecondary}
              disabled={salvando}
              onClick={() => void salvar('')}
            >
              Remover vínculo
            </button>
          ) : (
            <span />
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className={btnSecondary} onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className={btnPrimary} disabled={salvando || !id}>
              {salvando ? 'Salvando...' : 'Salvar ID'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
