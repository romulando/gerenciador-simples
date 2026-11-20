'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ClipboardCopy, Download, RefreshCw } from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { copiarTexto } from '@/lib/clipboard';
import { buscarJson, btnSecondary, enviarJson } from '@/components/pedidos/common';

type StatusGsiInstalado = 'ok' | 'ausente' | 'outro_app' | 'ilegivel' | 'desatualizado';

interface GsiVerificacao {
  status: StatusGsiInstalado;
  arquivoDoApp: boolean;
  uriInstalada: string | null;
  portaInstalada: string | null;
  portaEsperada: string | null;
  hostInstalado: string | null;
  outrosArquivos: string[];
}

interface GsiDiagnosticoResposta {
  ultimoPayload: {
    em: number;
    gameState: string;
    matchId: string | null;
    accountId: string;
    hero: string;
    host: string;
    bytes: number;
    teste: boolean;
  } | null;
  ultimaRejeicao: {
    em: number;
    motivo: string;
    host: string;
    bytes: number;
    tokenPrefixo: string;
    tokenTamanho: number;
  } | null;
  aceitos: number;
  rejeitados: number;
  ultimoTesteEm: number | null;
}

interface GsiConfigResposta {
  uri: string;
  token: string;
  nomeArquivo: string;
  conteudo: string;
  localizacao: {
    encontrado: boolean;
    steamPath: string | null;
    cfgDir: string | null;
    gsiDir: string | null;
    arquivoPath: string | null;
    arquivoInstalado: boolean;
    caminhosTestados: string[];
    pastasIgnoradas?: string[];
    detectadoPor?: 'appmanifest' | 'executavel' | null;
  };
  verificacao?: GsiVerificacao;
}

interface GsiStatusResposta {
  gsi: {
    online: boolean;
    ultimoContatoEm: number | null;
    ultimoErroPartida?: string;
  };
  gsiDiagnostico?: GsiDiagnosticoResposta | null;
  autoVinculo?: {
    vinculado: boolean;
  } | null;
}

function formatarContato(ms: number | null): string {
  if (!ms) return 'nunca';
  const segundos = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (segundos < 60) return `há ${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos}min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas}h`;
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
      <p className="text-gray-500">{rotulo}</p>
      <p className="mt-0.5 break-all font-mono text-gray-200">{valor}</p>
    </div>
  );
}

function rotuloToken(verificacao?: GsiVerificacao): string {
  switch (verificacao?.status) {
    case 'ok':
      return 'Confere';
    case 'desatualizado':
      return 'Confere (versão antiga)';
    case 'outro_app':
      return 'Não confere';
    case 'ilegivel':
      return 'Não foi possível ler';
    case 'ausente':
      return 'Arquivo ausente';
    default:
      return '—';
  }
}

export default function GsiConfig() {
  const router = useRouter();
  const [config, setConfig] = useState<GsiConfigResposta | null>(null);
  const [gsiOnline, setGsiOnline] = useState(false);
  const [ultimoContatoEm, setUltimoContatoEm] = useState<number | null>(null);
  const [ultimoErroPartida, setUltimoErroPartida] = useState('');
  const [diagnostico, setDiagnostico] = useState<GsiDiagnosticoResposta | null>(null);
  const [statusPronto, setStatusPronto] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [copiouCaminho, setCopiouCaminho] = useState(false);
  const [copiouDiagnostico, setCopiouDiagnostico] = useState(false);
  const [testando, setTestando] = useState(false);
  const [instalando, setInstalando] = useState(false);
  // Mantém o card no ar por alguns segundos depois de instalar, para o aviso
  // de sucesso não desaparecer junto (instalado + conectado = card escondido).
  const [mostrandoAviso, setMostrandoAviso] = useState(false);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setErro('');
    try {
      const cfg = await buscarJson<GsiConfigResposta>('/api/acompanhamento/gsi-config');
      setConfig(cfg);
    } catch (e) {
      if (!silencioso) setErro((e as Error).message);
      return;
    }

    // O status é acessório: se falhar, o card ainda mostra a configuração.
    try {
      const status = await buscarJson<GsiStatusResposta>('/api/acompanhamento/status', {
        signal: AbortSignal.timeout(6_000),
      });
      setGsiOnline(Boolean(status.gsi.online));
      setUltimoContatoEm(status.gsi.ultimoContatoEm ?? null);
      setUltimoErroPartida(status.gsi.ultimoErroPartida ?? '');
      setDiagnostico(status.gsiDiagnostico ?? null);
      if (status.autoVinculo?.vinculado) router.refresh();
    } catch {
      // silencioso
    } finally {
      setStatusPronto(true);
    }
  }, [router]);

  useEffect(() => {
    void carregar();
    // Enquanto o card estiver visível, acompanha o GSI para sair de
    // "aguardando" sem precisar recarregar a página.
    const timer = setInterval(() => void carregar(true), 10_000);
    return () => clearInterval(timer);
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

  async function copiarCaminho() {
    const caminho = config?.localizacao.arquivoPath ?? config?.localizacao.cfgDir ?? '';
    if (!caminho) return;
    if (!(await copiarTexto(caminho))) {
      setErro('Não foi possível copiar o caminho.');
      return;
    }
    setCopiouCaminho(true);
    setTimeout(() => setCopiouCaminho(false), 1600);
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
        }, 5000);
      } else {
        setErro(res.error || 'Não foi possível instalar automaticamente.');
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setInstalando(false);
    }
  }

  async function testarRecebimento() {
    setTestando(true);
    setErro('');
    setAviso('');
    try {
      const res = await enviarJson<{
        ok: boolean;
        status?: number;
        url?: string;
        resposta?: string;
        error?: string;
      }>('/api/acompanhamento/testar-gsi', { method: 'POST' });
      if (res.ok) {
        setAviso(`Teste OK: o servidor respondeu em ${res.url ?? '/api/gsi'}.`);
        await carregar();
      } else {
        setErro(
          `O servidor respondeu HTTP ${res.status ?? '?'} em ${
            res.url ?? '/api/gsi'
          }. ${res.resposta ?? ''}`.trim()
        );
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setTestando(false);
    }
  }

  async function copiarDiagnostico() {
    if (!config) return;
    const v = config.verificacao;
    const linhas = [
      `Gerado em: ${new Date().toLocaleString()}`,
      `URI esperada: ${config.uri}`,
      `Arquivo: ${
        config.localizacao.arquivoPath ??
        config.localizacao.cfgDir ??
        'não encontrado'
      }`,
      `Detecção: ${
        config.localizacao.detectadoPor === 'appmanifest'
          ? 'appmanifest do Steam (570)'
          : config.localizacao.detectadoPor === 'executavel'
            ? 'dota2.exe'
            : 'não encontrada'
      }`,
      `Pastas ignoradas (sem jogo): ${
        pastasIgnoradas.length ? pastasIgnoradas.join(', ') : 'nenhuma'
      }`,
      `GSI online: ${gsiOnline ? 'sim' : 'não'}`,
      `Último contato: ${formatarContato(ultimoContatoEm)}`,
      `Token: ${rotuloToken(v)}`,
      `URI instalada: ${v?.uriInstalada ?? '—'}`,
      `Porta instalada: ${v?.portaInstalada ?? '—'} (esperada ${
        v?.portaEsperada ?? '—'
      })`,
      `Host instalado: ${v?.hostInstalado ?? '—'}`,
      `Outros .cfg: ${
        outrosArquivos.length ? outrosArquivos.join(', ') : 'nenhum'
      }`,
      `Recebidos/rejeitados: ${diagnostico?.aceitos ?? 0}/${
        diagnostico?.rejeitados ?? 0
      }`,
      `Último payload: ${
        diagnostico?.ultimoPayload
          ? `${new Date(diagnostico.ultimoPayload.em).toLocaleString()} · ${
              diagnostico.ultimoPayload.gameState
            } · match ${diagnostico.ultimoPayload.matchId ?? '—'} · ${
              diagnostico.ultimoPayload.host
            }`
          : 'nenhum'
      }`,
      `Última rejeição: ${
        diagnostico?.ultimaRejeicao
          ? `${new Date(diagnostico.ultimaRejeicao.em).toLocaleString()} · ${
              diagnostico.ultimaRejeicao.motivo
            } · token ${diagnostico.ultimaRejeicao.tokenPrefixo}… (${
              diagnostico.ultimaRejeicao.tokenTamanho
            })`
          : 'nenhuma'
      }`,
      `Último teste do painel: ${
        diagnostico?.ultimoTesteEm
          ? new Date(diagnostico.ultimoTesteEm).toLocaleString()
          : 'nunca'
      }`,
      `Erro da última partida: ${ultimoErroPartida || '—'}`,
    ];
    if (!(await copiarTexto(linhas.join('\n')))) {
      setErro('Não foi possível copiar o diagnóstico.');
      return;
    }
    setCopiouDiagnostico(true);
    setTimeout(() => setCopiouDiagnostico(false), 1600);
  }

  // O card só some quando o arquivo é deste painel E o Dota já enviou dados.
  // Arquivo instalado sem payload é justamente o caso em que o usuário precisa
  // do diagnóstico, então o card continua visível.
  const verificacao = config?.verificacao;
  const arquivoExiste = verificacao
    ? verificacao.status !== 'ausente'
    : Boolean(config?.localizacao.arquivoInstalado);
  const instalado = Boolean(arquivoExiste && verificacao?.status === 'ok');
  const precisaSubstituir = Boolean(
    arquivoExiste && verificacao && !verificacao.arquivoDoApp
  );
  const precisaAtualizar = verificacao?.status === 'desatualizado';
  const aguardando = !gsiOnline;
  const outrosArquivos = verificacao?.outrosArquivos ?? [];
  const pastasIgnoradas = config?.localizacao.pastasIgnoradas ?? [];
  const portaDiferente = Boolean(
    verificacao?.portaInstalada &&
      verificacao.portaEsperada &&
      verificacao.portaInstalada !== verificacao.portaEsperada
  );
  const hostNaoLocal = Boolean(
    verificacao?.hostInstalado &&
      !['localhost', '127.0.0.1', '::1', '[::1]'].includes(
        verificacao.hostInstalado
      )
  );
  const rejeicaoRecente = Boolean(
    diagnostico?.ultimaRejeicao &&
      Date.now() - diagnostico.ultimaRejeicao.em < 10 * 60_000 &&
      (!diagnostico.ultimoPayload ||
        diagnostico.ultimaRejeicao.em > diagnostico.ultimoPayload.em)
  );

  if (!config && !erro) return null;
  // Evita piscar o card enquanto o status do GSI ainda não chegou.
  if (config && !statusPronto) return null;
  if (instalado && !mostrandoAviso && !aguardando) return null;

  const caminhoArquivo =
    config?.localizacao.arquivoPath ??
    config?.localizacao.cfgDir ??
    'Dota 2 não localizado automaticamente';

  return (
    <div
      id="gsi-config"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
    >
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

      {pastasIgnoradas.length > 0 && (
        <Alerta tipo="aviso" className="mt-3">
          <p>
            {config?.localizacao.encontrado
              ? 'O GSI usa a instalação do Dota 2 que realmente tem o jogo. Ignorei esta(s) pasta(s) antiga(s), que só têm restos de outra biblioteca do Steam:'
              : 'Encontrei pasta(s) com restos do Dota 2, mas sem o jogo instalado. O GSI não será gravado nelas:'}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono text-[11px] leading-relaxed break-all">
            {pastasIgnoradas.map((pasta) => (
              <li key={pasta}>{pasta}</li>
            ))}
          </ul>
          {!config?.localizacao.encontrado && (
            <p className="mt-1">
              Localize a pasta do Dota que você abre (a que tem <code>dota2.exe</code>) e use
              “Copiar .cfg”.
            </p>
          )}
        </Alerta>
      )}

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
          {portaDiferente && (
            <p className="mt-1 text-amber-100">
              A porta do arquivo é <strong>{verificacao.portaInstalada}</strong>, mas este
              painel está na porta <strong>{verificacao.portaEsperada}</strong>. Reinstale por
              aqui para alinhar.
            </p>
          )}
          {hostNaoLocal && (
            <p className="mt-1 text-amber-100">
              O arquivo aponta para <strong>{verificacao.hostInstalado}</strong>. O Dota 2 só
              entrega os dados no próprio PC; reinstale por aqui para usar 127.0.0.1.
            </p>
          )}
        </Alerta>
      )}
      {verificacao?.status !== 'outro_app' && (portaDiferente || hostNaoLocal) && (
        <Alerta tipo="aviso" className="mt-3">
          {portaDiferente && (
            <p>
              A porta do arquivo é <strong>{verificacao?.portaInstalada}</strong>, mas este
              painel está na porta <strong>{verificacao?.portaEsperada}</strong>.
            </p>
          )}
          {hostNaoLocal && (
            <p>
              O arquivo aponta para <strong>{verificacao?.hostInstalado}</strong>. O Dota 2 só
              entrega os dados no próprio PC; use 127.0.0.1.
            </p>
          )}
          <p className="mt-1">
            Clique em “Atualizar/Reinstalar GSI” e reinicie o Dota 2.
          </p>
        </Alerta>
      )}
      {verificacao?.status === 'ilegivel' && (
        <Alerta tipo="aviso" className="mt-3">
          Encontrei o arquivo do GSI, mas não consegui lê-lo para confirmar que é deste painel
          (permissão de acesso). Se o GSI não conectar, substitua o arquivo pelo botão abaixo.
        </Alerta>
      )}
      {precisaAtualizar && (
        <Alerta tipo="aviso" className="mt-3">
          O arquivo do GSI é deste painel, mas está com uma configuração antiga. Clique em
          “Atualizar GSI” para aplicar a configuração atual e reinicie o Dota 2.
        </Alerta>
      )}
      {aguardando && rejeicaoRecente && diagnostico?.ultimaRejeicao && (
        <Alerta tipo="erro" className="mt-3">
          O Dota 2 está enviando dados para este painel, mas o token não confere (última
          tentativa {formatarContato(diagnostico.ultimaRejeicao.em)}, token recebido{' '}
          <code className="text-gray-100">
            {diagnostico.ultimaRejeicao.tokenPrefixo || 'vazio'}…
          </code>{' '}
          com {diagnostico.ultimaRejeicao.tokenTamanho} caracteres). O arquivo foi gerado por
          outra instalação. Clique em <strong>Substituir GSI instalado</strong> e reinicie o
          Dota 2.
        </Alerta>
      )}
      {instalado && aguardando && !diagnostico?.ultimaRejeicao && (
        <Alerta tipo="aviso" className="mt-3">
          O arquivo do GSI está instalado e é deste painel, mas o Dota 2 ainda não enviou
          nenhum dado. Se ele já estiver aberto, feche e abra de novo depois de instalar.
          Se nada chegar nem na partida, confira se outro painel (gerenciador-pedidos ou
          TestarSistemaTheone) não instalou o GSI por último e se a pasta acima é a do Dota
          que você abre. O diagnóstico abaixo mostra o caminho, a porta e o último contato.
        </Alerta>
      )}
      {ultimoErroPartida && (
        <Alerta tipo="erro" className="mt-3">
          {ultimoErroPartida}
        </Alerta>
      )}

      {config && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <Info
              rotulo="Status do GSI"
              valor={gsiOnline ? 'Conectado' : 'Aguardando dados do Dota'}
            />
            <Info rotulo="Último contato" valor={formatarContato(ultimoContatoEm)} />
            <Info rotulo="Arquivo" valor={caminhoArquivo} />
            <Info
              rotulo="Detecção do Dota"
              valor={
                config.localizacao.detectadoPor === 'appmanifest'
                  ? 'Confirmada pelo Steam (appmanifest 570)'
                  : config.localizacao.detectadoPor === 'executavel'
                    ? 'Confirmada pelo dota2.exe'
                    : 'Instalação não localizada'
              }
            />
            <Info rotulo="URI esperada" valor={config.uri} />
            <Info rotulo="Token" valor={rotuloToken(verificacao)} />
            <Info
              rotulo="Outros .cfg na pasta"
              valor={outrosArquivos.length > 0 ? outrosArquivos.join(', ') : 'Nenhum'}
            />
            <Info
              rotulo="Último payload recebido"
              valor={
                diagnostico?.ultimoPayload
                  ? `${formatarContato(diagnostico.ultimoPayload.em)} · ${
                      diagnostico.ultimoPayload.gameState || 'sem estado'
                    }${
                      diagnostico.ultimoPayload.matchId
                        ? ` · match ${diagnostico.ultimoPayload.matchId}`
                        : ''
                    }`
                  : 'Nenhum desde que o painel abriu'
              }
            />
            <Info
              rotulo="Última rejeição"
              valor={
                diagnostico?.ultimaRejeicao
                  ? `${formatarContato(diagnostico.ultimaRejeicao.em)} · ${
                      diagnostico.ultimaRejeicao.motivo === 'json'
                        ? 'JSON inválido'
                        : `token ${diagnostico.ultimaRejeicao.tokenPrefixo || 'vazio'}… (${
                            diagnostico.ultimaRejeicao.tokenTamanho
                          } chars)`
                    }`
                  : 'Nenhuma'
              }
            />
            <Info
              rotulo="Recebidos / rejeitados"
              valor={`${diagnostico?.aceitos ?? 0} / ${diagnostico?.rejeitados ?? 0}`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={instalar} disabled={instalando} className={btnSecondary}>
              <span className="flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                {instalando
                  ? 'Instalando…'
                  : precisaSubstituir
                    ? 'Substituir GSI instalado'
                    : precisaAtualizar
                      ? 'Atualizar GSI'
                      : instalado
                        ? 'Reinstalar GSI'
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
            <button
              type="button"
              onClick={() => void copiarCaminho()}
              className={btnSecondary}
              disabled={!config.localizacao.arquivoPath && !config.localizacao.cfgDir}
            >
              <span className="flex items-center gap-1.5">
                {copiouCaminho ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
                {copiouCaminho ? 'Caminho copiado!' : 'Copiar caminho'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void testarRecebimento()}
              disabled={testando}
              className={btnSecondary}
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw className={`h-4 w-4 ${testando ? 'animate-spin' : ''}`} />
                {testando ? 'Testando…' : 'Testar recebimento'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void copiarDiagnostico()}
              className={btnSecondary}
            >
              <span className="flex items-center gap-1.5">
                {copiouDiagnostico ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
                {copiouDiagnostico ? 'Diagnóstico copiado!' : 'Copiar diagnóstico'}
              </span>
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
            <p>
              Para conferir se o servidor está acessível neste PC, abra{' '}
              <a
                href={config.uri}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[#e8a020] underline underline-offset-2 hover:text-amber-200"
              >
                {config.uri}
              </a>{' '}
              no navegador. Deve aparecer uma resposta com <code>ok: true</code>.
            </p>
          </div>

          {aguardando && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
              <p className="font-semibold text-amber-200">
                Se continuar em “aguardando”, confira:
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>a janela preta do servidor precisa ficar aberta enquanto joga;</li>
                <li>o painel precisa estar no mesmo PC do Dota 2;</li>
                <li>feche o Dota completamente e abra de novo depois de instalar o GSI;</li>
                <li>confira se o caminho acima é a pasta do Dota que você abre;</li>
                <li>
                  se houver outro .cfg na pasta (inclusive do gerenciador-pedidos), clique em
                  “Reinstalar GSI” — o último painel que instala é o que recebe;
                </li>
                <li>libere o Node.js/porta 4000 no firewall ou antivírus se necessário;</li>
                <li>
                  acesse o painel por <code>http://127.0.0.1:4000</code> (ou localhost:4000),
                  não pelo IP da rede;
                </li>
                <li>
                  use “Testar recebimento” acima e confira o último payload/rejeição no
                  diagnóstico.
                </li>
              </ul>
            </div>
          )}

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
