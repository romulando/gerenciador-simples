'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, Link2, PlugZap, Unplug } from 'lucide-react';
import { copiarTexto } from '@/lib/clipboard';
import Alerta from '@/components/ui/Alerta';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { buscarJson, btnSecondary, enviarJson, inputCls, labelCls } from '@/components/pedidos/common';
import type { TwitchStatusOverlay } from './common';

// Seção da Configuração da Overlay: credenciais do app da Twitch e conexão do
// canal (OAuth) para o contador de subs.
export default function TwitchSubsConfig({
  subAtivo,
  subMeta,
  onSubAtivoChange,
  onSubMetaChange,
}: {
  subAtivo: boolean;
  subMeta: string;
  onSubAtivoChange: (valor: boolean) => void;
  onSubMetaChange: (valor: string) => void;
}) {
  const [status, setStatus] = useState<TwitchStatusOverlay | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [operando, setOperando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const iniciadoRef = useRef(false);

  // O componente só é montado no cliente (modal condicional), então a origem
  // atual pode ser lida direto para montar a URL de redirect do app da Twitch.
  const redirectUri =
    typeof window !== 'undefined' ? `${window.location.origin}/api/overlay/twitch/callback` : '';

  const carregar = useCallback(async () => {
    const s = await buscarJson<TwitchStatusOverlay>('/api/overlay/twitch');
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

  async function copiarRedirect() {
    if (!(await copiarTexto(redirectUri))) {
      setErro('Não foi possível copiar a URL.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  async function salvarCredenciais() {
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      const s = await enviarJson<TwitchStatusOverlay>('/api/overlay/twitch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      setStatus(s);
      setClientSecret('');
      setAviso('Credenciais salvas. Agora clique em “Conectar com a Twitch”.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function conectar() {
    setErro('');
    setAviso('');
    setOperando(true);
    try {
      const { url } = await enviarJson<{ url: string }>('/api/overlay/twitch/autorizar');
      window.location.href = url;
    } catch (e) {
      setErro((e as Error).message);
      setOperando(false);
    }
  }

  async function desconectar() {
    setErro('');
    setAviso('');
    setOperando(true);
    try {
      const s = await enviarJson<TwitchStatusOverlay>('/api/overlay/twitch', {
        method: 'DELETE',
      });
      setStatus(s);
      setAviso('Twitch desconectada.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOperando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
          <PlugZap className="h-3.5 w-3.5 text-[#e8a020]" />
          Contador de subs — Twitch
        </p>
        <Link
          href="/stream-overlay/tutorial#twitch"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-[#e8a020]/30 bg-[#e8a020]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#e8a020] transition-colors hover:bg-[#e8a020]/20"
        >
          <BookOpen className="h-3 w-3" />
          Tutorial
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${
            status?.conectado ? 'bg-green-400' : 'bg-gray-500'
          }`}
        />
        <span className={status?.conectado ? 'text-green-300' : 'text-gray-400'}>
          {status?.conectado
            ? `Conectado${status.login ? ` como ${status.login}` : ''}`
            : 'Não conectado'}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <ToggleSwitch
          compact
          checked={subAtivo}
          onChange={onSubAtivoChange}
          label="Mostrar contador de subs"
          badge={subAtivo ? 'ativo' : 'inativo'}
          title="Exibe o card do contador de subs da Twitch na overlay"
        />
        <div className="flex items-center gap-1.5 sm:pl-1" title="0 = sem barra de progresso">
          <span className="text-[11px] text-gray-400">Meta</span>
          <input
            id="overlay-sub-meta"
            inputMode="numeric"
            value={subMeta}
            onChange={(e) => onSubMetaChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="0"
            aria-label="Meta de subs"
            className="h-8 w-16 rounded-lg border border-[#e8a020]/40 bg-white/5 text-center text-sm font-semibold text-white transition-all duration-300 placeholder:font-normal placeholder:text-gray-600 focus:border-[#e8a020]/70 focus:bg-white/10 focus:outline-none"
          />
          <span className="text-[11px] text-gray-400">subs</span>
        </div>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
        Crie um app em{' '}
        <span className="font-mono text-gray-400">dev.twitch.tv/console/apps</span>, cadastre a
        URL de redirect abaixo e informe as credenciais. O canal precisa ser afiliado/parceiro
        para liberar os subs.
      </p>

      <div className="space-y-2.5">
        <div>
          <label className={labelCls} htmlFor="twitch-client-id">
            Client ID
          </label>
          <input
            id="twitch-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value.trim().slice(0, 128))}
            placeholder="ex.: abcdefghijklmnopqrstuvwxyz123456"
            className={inputCls}
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="twitch-client-secret">
            Client Secret {status?.secretDefinido && <span className="text-gray-600">(salvo)</span>}
          </label>
          <input
            id="twitch-client-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value.slice(0, 256))}
            placeholder={status?.secretDefinido ? '•••••••• (deixe vazio para manter)' : 'Client Secret do app'}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className={labelCls}>URL de redirect (cadastre no app da Twitch)</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={redirectUri}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-gray-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void copiarRedirect()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiado ? 'Copiada!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void salvarCredenciais()}
            disabled={salvando || (!clientId.trim() && !clientSecret.trim())}
          >
            {salvando ? 'Salvando...' : 'Salvar credenciais'}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void conectar()}
            disabled={operando || !status?.secretDefinido}
            title={!status?.secretDefinido ? 'Salve o Client ID e o Client Secret antes' : undefined}
          >
            {status?.conectado ? 'Reconectar com a Twitch' : 'Conectar com a Twitch'}
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
