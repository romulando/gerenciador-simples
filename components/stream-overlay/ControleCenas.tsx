'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Clapperboard,
  Coffee,
  Gamepad2,
  Home,
  List,
  Loader2,
  PlugZap,
  Save,
  type LucideIcon,
} from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { btnSecondary, buscarJson, inputCls, labelCls } from '@/components/pedidos/common';
import type { EstadoCena, NomesCenas, RespostaCenasObs } from './common';

const BOTOES: { estado: EstadoCena; rotulo: string; Icone: LucideIcon }[] = [
  { estado: 'menu', rotulo: 'Menu', Icone: Home },
  { estado: 'draft', rotulo: 'Draft', Icone: List },
  { estado: 'game', rotulo: 'Jogando', Icone: Gamepad2 },
  { estado: 'descanso', rotulo: 'Descanso', Icone: Coffee },
];

interface RespostaConexao {
  ok: boolean;
  nomes: NomesCenas;
  conexao: { host: string; port: number; senhaDefinida: boolean };
}

export default function ControleCenas() {
  const [dados, setDados] = useState<RespostaCenasObs | null>(null);
  const [nomes, setNomes] = useState<NomesCenas | null>(null);
  const [erro, setErro] = useState('');
  const [forcando, setForcando] = useState<EstadoCena | null>(null);
  const [salvandoNomes, setSalvandoNomes] = useState(false);
  const [salvoNomes, setSalvoNomes] = useState(false);
  const [mostrarConexao, setMostrarConexao] = useState(false);
  const [host, setHost] = useState('');
  const [porta, setPorta] = useState('');
  const [senha, setSenha] = useState('');
  const [salvandoConexao, setSalvandoConexao] = useState(false);
  const [salvoConexao, setSalvoConexao] = useState(false);
  const iniciadoRef = useRef(false);

  const carregar = useCallback(async () => {
    const data = await buscarJson<RespostaCenasObs>('/api/overlay/cenas');
    setDados(data);
    if (!iniciadoRef.current) {
      iniciadoRef.current = true;
      setNomes(data.nomes);
      setHost(data.conexao.host);
      setPorta(String(data.conexao.port));
    }
    return data;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await carregar();
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
    const t = setInterval(() => {
      carregar().catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [carregar]);

  // Ao voltar do OBS para o navegador, atualiza na hora em vez de esperar o
  // próximo intervalo (que o navegador costuma estrangular em segundo plano).
  useEffect(() => {
    const atualizar = () => {
      carregar().catch(() => {});
    };
    const aoVisibilidade = () => {
      if (document.visibilityState === 'visible') atualizar();
    };
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', aoVisibilidade);
    return () => {
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', aoVisibilidade);
    };
  }, [carregar]);

  async function forcar(estado: EstadoCena) {
    setErro('');
    setForcando(estado);
    try {
      await buscarJson('/api/overlay/cenas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setForcando(null);
    }
  }

  async function salvarNomes() {
    if (!nomes) return;
    setErro('');
    setSalvandoNomes(true);
    try {
      const resp = await buscarJson<RespostaConexao>('/api/overlay/cenas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomes }),
      });
      setNomes(resp.nomes);
      setSalvoNomes(true);
      setTimeout(() => setSalvoNomes(false), 2000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoNomes(false);
    }
  }

  async function salvarConexao() {
    setErro('');
    setSalvandoConexao(true);
    try {
      const resp = await buscarJson<RespostaConexao>('/api/overlay/cenas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conexao: {
            host,
            port: Number(porta) || undefined,
            senha: senha || undefined,
          },
        }),
      });
      setHost(resp.conexao.host);
      setPorta(String(resp.conexao.port));
      setSenha('');
      setSalvoConexao(true);
      setTimeout(() => setSalvoConexao(false), 2000);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoConexao(false);
    }
  }

  const ativo = dados?.ultimoEstado ?? null;

  return (
    <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
          <Clapperboard className="h-5 w-5 text-amber-500" />
          Controle de Cenas
        </h2>
        <div className="flex items-center gap-2">
          {dados?.modoDescanso && (
            <span
              className="flex items-center gap-1.5 rounded-full border border-[#e8a020]/40 bg-[#e8a020]/10 px-2.5 py-1 text-xs font-medium text-[#e8a020]"
              title="O GSI não troca automaticamente para a cena de Menu enquanto o modo Descanso estiver ativo"
            >
              <Coffee className="h-3.5 w-3.5" />
              Descanso ativo
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              dados?.conectado
                ? 'border-green-500/40 bg-green-500/10 text-green-300'
                : 'border-white/15 bg-white/5 text-gray-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${dados?.conectado ? 'bg-green-400' : 'bg-gray-500'}`}
            />
            {dados?.conectado
              ? `OBS: conectado${dados.cenaAtual ? ` · ${dados.cenaAtual}` : ''}`
              : 'OBS: desconectado'}
          </span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => setMostrarConexao((v) => !v)}
            title="Conexão OBS"
            aria-label="Conexão OBS"
          >
            <PlugZap className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BOTOES.map(({ estado, rotulo, Icone }) => {
          const ativado = ativo === estado;
          return (
            <button
              key={estado}
              type="button"
              onClick={() => void forcar(estado)}
              disabled={forcando !== null}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-300 disabled:opacity-60 ${
                ativado
                  ? 'border-[#e8a020]/60 bg-[#e8a020]/15 text-white shadow-[0_0_16px_rgba(232,160,32,0.25)]'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {forcando === estado ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icone className={`h-4 w-4 ${ativado ? 'text-[#e8a020]' : ''}`} />
              )}
              {rotulo}
            </button>
          );
        })}
      </div>

      {nomes && (
        <div className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {BOTOES.map(({ estado, rotulo }) => (
              <div key={estado}>
                <label className={labelCls} htmlFor={`cena-${estado}`}>
                  Nome da Cena - {rotulo}
                </label>
                <input
                  id={`cena-${estado}`}
                  list="cenas-obs"
                  value={nomes[estado]}
                  onChange={(e) => setNomes({ ...nomes, [estado]: e.target.value })}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <datalist id="cenas-obs">
            {(dados?.cenas ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button
            type="button"
            className={`${btnSecondary} mt-3 w-full`}
            onClick={() => void salvarNomes()}
            disabled={salvandoNomes}
          >
            <span className="flex items-center justify-center gap-1.5">
              {salvoNomes ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {salvandoNomes ? 'Salvando...' : salvoNomes ? 'Nomes salvos!' : 'Salvar Nomes das Cenas'}
            </span>
          </button>
        </div>
      )}

      {mostrarConexao && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs font-medium text-gray-300">Conexão OBS (WebSocket)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="obs-host">
                Host
              </label>
              <input
                id="obs-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className={inputCls}
                placeholder="127.0.0.1"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="obs-porta">
                Porta
              </label>
              <input
                id="obs-porta"
                inputMode="numeric"
                value={porta}
                onChange={(e) => setPorta(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className={inputCls}
                placeholder="4455"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="obs-senha">
                Senha
              </label>
              <input
                id="obs-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={inputCls}
                placeholder={dados?.conexao.senhaDefinida ? '•••• (definida)' : 'sem senha'}
              />
            </div>
          </div>
          <button
            type="button"
            className={`${btnSecondary} mt-3 w-full`}
            onClick={() => void salvarConexao()}
            disabled={salvandoConexao}
          >
            <span className="flex items-center justify-center gap-1.5">
              {salvoConexao ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
              {salvandoConexao ? 'Salvando...' : salvoConexao ? 'Conexão salva!' : 'Salvar conexão'}
            </span>
          </button>
        </div>
      )}

      {dados && !dados.conectado && dados.erro && (
        <p className="mt-2 text-[11px] text-gray-500">OBS indisponível: {dados.erro}</p>
      )}

      {erro && (
        <div className="mt-3">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      )}
    </section>
  );
}
