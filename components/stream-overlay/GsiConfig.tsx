'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCopy, Download, RefreshCw } from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { copiarTexto } from '@/lib/clipboard';
import { buscarJson, btnSecondary, enviarJson } from '@/components/pedidos/common';

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
}

export default function GsiConfig() {
  const [config, setConfig] = useState<GsiConfigResposta | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [instalando, setInstalando] = useState(false);

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
        await carregar();
      } else {
        setErro(res.error || 'Não foi possível instalar automaticamente.');
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setInstalando(false);
    }
  }

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
                {instalando ? 'Instalando…' : 'Instalar na pasta do Dota 2'}
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
        </div>
      )}
    </div>
  );
}
