'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Unplug, Wallet } from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { enviarJson, btnSecondary, inputCls, labelCls, buscarJson } from '@/components/pedidos/common';
import type { LivepixStatusOverlay } from './common';

type RespostaLivepix = LivepixStatusOverlay & { mensagem?: string };

// Seção da Configuração da Overlay: credenciais do app da LivePix (client
// credentials) para a barra de progresso das doações do mês.
export default function LivePixConfig() {
  const [status, setStatus] = useState<LivepixStatusOverlay | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [operando, setOperando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const iniciadoRef = useRef(false);

  const carregar = useCallback(async () => {
    const s = await buscarJson<LivepixStatusOverlay>('/api/overlay/livepix');
    setStatus(s);
    if (!iniciadoRef.current) {
      iniciadoRef.current = true;
      setClientId(s.clientId);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await carregar();
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
  }, [carregar]);

  async function salvarCredenciais() {
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      const s = await enviarJson<RespostaLivepix>('/api/overlay/livepix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      setStatus(s);
      setClientSecret('');
      setAviso(s.mensagem || 'Credenciais salvas.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function desconectar() {
    setErro('');
    setAviso('');
    setOperando(true);
    try {
      const s = await enviarJson<LivepixStatusOverlay>('/api/overlay/livepix', {
        method: 'DELETE',
      });
      setStatus(s);
      setAviso('LivePix desconectada.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOperando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-300">
        <Wallet className="h-3.5 w-3.5 text-[#e8a020]" />
        Barra do LivePix — API
      </p>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${status?.conectado ? 'bg-green-400' : 'bg-gray-500'}`}
        />
        <span className={status?.conectado ? 'text-green-300' : 'text-gray-400'}>
          {status?.conectado
            ? `Conectado${status.login ? ` como ${status.login}` : ''}`
            : 'Não conectado'}
        </span>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
        Crie uma aplicação nas configurações da sua conta na LivePix e cole o Client ID e o Client
        Secret. A conexão usa client credentials com os escopos{' '}
        <span className="font-mono text-gray-400">account:read</span>,{' '}
        <span className="font-mono text-gray-400">payments:read</span> e{' '}
        <span className="font-mono text-gray-400">messages:read</span> — sem URL de redirect.
      </p>

      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="livepix-client-id">
            Client ID
          </label>
          <input
            id="livepix-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value.trim().slice(0, 128))}
            placeholder="ex.: 61021c7bdabe5e001225b65b"
            className={inputCls}
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="livepix-client-secret">
            Client Secret {status?.secretDefinido && <span className="text-gray-600">(salvo)</span>}
          </label>
          <input
            id="livepix-client-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value.slice(0, 256))}
            placeholder={
              status?.secretDefinido ? '•••••••• (deixe vazio para manter)' : 'Client Secret da aplicação'
            }
            className={inputCls}
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void salvarCredenciais()}
            disabled={salvando || (!clientId.trim() && !clientSecret.trim())}
          >
            {salvando ? 'Salvando...' : 'Salvar credenciais e testar'}
          </button>
          {status?.conectado && (
            <button
              type="button"
              className={`${btnSecondary} text-red-300`}
              onClick={() => void desconectar()}
              disabled={operando}
            >
              <span className="flex items-center gap-1.5">
                <Unplug className="h-4 w-4" />
                Desconectar
              </span>
            </button>
          )}
        </div>
      </div>

      {status?.erro && <Alerta tipo="aviso" className="mt-3">{status.erro}</Alerta>}
      {aviso && <Alerta tipo="sucesso" className="mt-3">{aviso}</Alerta>}
      {erro && <Alerta tipo="erro" className="mt-3">{erro}</Alerta>}
    </div>
  );
}
