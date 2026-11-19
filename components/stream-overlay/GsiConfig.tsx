'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, Download, RefreshCw } from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { copiarTexto } from '@/lib/clipboard';
import { buscarJson, btnSecondary, enviarJson } from '@/components/pedidos/common';

type StatusGsiInstalado = 'ok' | 'ausente' | 'outro_app' | 'ilegivel';

interface GsiVerificacao {
  status: StatusGsiInstalado;
  arquivoDoApp: boolean;
  uriInstalada: string | null;
}

interface GsiConfigResposta {
  uri: string;
  token: string;
  nomeArquivo: string;
  conteudo: string;
  localizacao: {
    encontrado: boolean;
    cfgDir: string | null;
    arquivoInstalado: boolean;
    caminhosTestados: string[];
  };
  verificacao?: GsiVerificacao;
}

export default function GsiConfig() {
  const [config, setConfig] = useState<GsiConfigResposta | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [instalando, setInstalando] = useState(false);
  // Mantém o card no ar por alguns segundos depois de instalar, para o aviso
  // de sucesso não desaparecer junto (instalado = card escondido).
  const [mostrandoAviso, setMostrandoAviso] = useState(false);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setConfig(await buscarJson<GsiConfigResposta>('/api/acompanhamento/gsi-config'));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(
    () => () => {
      if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    },
    []
  );

  async function copiar() {
    if (!config) return;
    if (!(await copiarTexto(config.conteudo))) {
      setErro('Não foi possível copiar o conteúdo.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  async function instalar() {
    setInstalando(true);
    setErro('');
    setAviso('');
    try {
      const res = await enviarJson<{ ok: boolean; arquivoPath?: string; error?: string }>(
        '/api/acompanhamento/instalar-gsi',
        { method: 'POST' }
      );
      if (res.ok) {
        setAviso(`GSI instalado em ${res.arquivoPath ?? 'pasta do Dota 2'}. Reinicie o Dota 2.`);
        setMostrandoAviso(true);
        await carregar();
        if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
        avisoTimerRef.current = setTimeout(() => {
          setAviso('');
          setMostrandoAviso(false);
        }, 4000);
      } else {
        setErro(res.error || 'Não foi possível instalar automaticamente.');
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setInstalando(false);
    }
  }

  // Card só aparece enquanto o GSI deste painel não estiver instalado. O nome
  // do .cfg é o mesmo usado por outros gerenciadores, então além de existir o
  // conteúdo precisa ser o nosso (uri + token). Durante o carregamento inicial
  // também não renderiza, para não piscar na tela; o aviso pós-instalação
  // segura o card por alguns segundos.
  const verificacao = config?.verificacao;
  // A verificação lê o arquivo na hora; ela manda mais que o `arquivoInstalado`
  // (que vem do cache de detecção da pasta).
  const arquivoExiste = verificacao
    ? verificacao.status !== 'ausente'
    : Boolean(config?.localizacao.arquivoInstalado);
  const instalado = Boolean(arquivoExiste && (verificacao?.arquivoDoApp ?? true));
  const precisaSubstituir = Boolean(
    arquivoExiste && verificacao && !verificacao.arquivoDoApp
  );
  if (!config && !erro) return null;
  if (instalado && !mostrandoAviso) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-100">GSI do Dota 2</h2>
        <button
          type="button"
          onClick={() => void carregar()}
          className="rounded-full border border-white/20 bg-white/5 p-2 text-gray-300 hover:bg-white/10"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Instala o arquivo que o Dota 2 usa para enviar o estado da partida (herói, KDA, cenas).
      </p>

      {erro && <Alerta tipo="erro" className="mt-3">{erro}</Alerta>}
      {aviso && <Alerta tipo="sucesso" className="mt-3">{aviso}</Alerta>}

      {verificacao?.status === 'outro_app' && (
        <Alerta tipo="aviso" className="mt-3">
          Existe um <code className="text-gray-100">{config?.nomeArquivo}</code> na pasta do
          Dota 2 que não foi gerado por este painel (provavelmente outro gerenciador ou uma
          instalação antiga).
          {verificacao.uriInstalada && (
            <>
              {' '}
              Ele envia os dados para{' '}
              <code className="break-all text-gray-100">{verificacao.uriInstalada}</code>.
            </>
          )}{' '}
          O GSI deste painel não recebe nada até o arquivo ser substituído — depois reinicie o
          Dota 2.
        </Alerta>
      )}
      {verificacao?.status === 'ilegivel' && (
        <Alerta tipo="aviso" className="mt-3">
          Encontrei o arquivo do GSI, mas não consegui lê-lo para confirmar que é deste painel
          (permissão de acesso). Se o GSI não conectar, substitua o arquivo pelo botão abaixo.
        </Alerta>
      )}

      {config && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <p className="text-gray-500">Arquivo</p>
              <p className="mt-0.5 font-mono text-gray-200">{config.nomeArquivo}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <p className="text-gray-500">Destino</p>
              <p className="mt-0.5 break-all font-mono text-gray-200">
                {config.localizacao.cfgDir ?? 'Dota 2 não localizado automaticamente'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={instalar} disabled={instalando} className={btnSecondary}>
              <span className="flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                {instalando
                  ? 'Instalando…'
                  : precisaSubstituir
                    ? 'Substituir GSI instalado'
                    : 'Instalar na pasta do Dota 2'}
              </span>
            </button>
            <button type="button" onClick={() => void copiar()} className={btnSecondary}>
              <span className="flex items-center gap-1.5">
                {copiado ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
                {copiado ? 'Copiado!' : 'Copiar .cfg'}
              </span>
            </button>
          </div>

          <details className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <summary className="cursor-pointer text-xs text-gray-400">
              Ver conteúdo do {config.nomeArquivo}
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] text-gray-400">
              {config.conteudo}
            </pre>
          </details>

          <p className="text-[11px] leading-relaxed text-gray-500">
            Se a instalação automática falhar, copie o conteúdo e salve em{' '}
            <code className="text-gray-300">...\dota 2 beta\game\dota\cfg\gamestate_integration\</code>.
            Depois reinicie o Dota 2.
          </p>

          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
            O arquivo tem o mesmo nome usado pelo gerenciador-pedidos. O último painel que
            instalar o GSI é o que recebe os dados do Dota 2 — para registrar os pedidos do
            Theone, instale por aqui.
          </p>
        </div>
      )}
    </div>
  );
}
