// Localiza a pasta do Dota 2 no Windows e instala o arquivo GSI do Acompanhamento.
// Somente servidor (usa fs/path).
import fs from 'fs';
import path from 'path';

export const GSI_ARQUIVO = 'gamestate_integration_acompanhamento.cfg';

// Caminho relativo dentro de uma raiz Steam/biblioteca até a pasta cfg do Dota 2.
const CFG_REL = path.join('steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg');
const GSI_SUB = 'gamestate_integration';

// Locais comuns de instalação do Steam (fornecidos pelo usuário).
const STEAM_COMUNS = [
  'C:\\Program Files (x86)\\Steam',
  'D:\\Program Files (x86)\\Steam',
  'E:\\Program Files (x86)\\Steam',
  'C:\\Steam',
  'D:\\Steam',
  'E:\\Steam',
  'F:\\Steam',
  'C:\\Program Files\\Steam',
  'D:\\Program Files\\Steam',
];

export interface DotaLocalizacao {
  encontrado: boolean;
  steamPath: string | null;
  cfgDir: string | null;
  gsiDir: string | null;
  arquivoPath: string | null;
  arquivoInstalado: boolean;
  caminhosTestados: string[];
}

export interface ResultadoInstalacao {
  ok: boolean;
  arquivoPath?: string;
  steamPath?: string;
  error?: string;
  localizacao: DotaLocalizacao;
}

// Situação do .cfg encontrado na pasta do Dota 2. O nome do arquivo é o mesmo
// usado por outros gerenciadores, então só o conteúdo (uri + token) diz se ele
// é deste painel.
export type StatusGsiInstalado = 'ok' | 'ausente' | 'outro_app' | 'ilegivel' | 'desatualizado';

export interface VerificacaoGsi {
  status: StatusGsiInstalado;
  arquivoDoApp: boolean;
  uriInstalada: string | null;
}

// Cache curto da detecção (evita varrer drives a cada poll da aba).
const CACHE_MS = 15_000;
let cache: { valor: DotaLocalizacao; expiraEm: number } | null = null;

// Desfaz o escape \\ dos caminhos dentro do VDF do Steam.
function normalizarVdfPath(valor: string): string {
  return valor.replace(/\\\\/g, '\\');
}

// Lê as bibliotecas adicionais do Steam (libraryfolders.vdf).
function lerBibliotecas(steamPath: string): string[] {
  const candidatos = [
    path.join(steamPath, 'steamapps', 'libraryfolders.vdf'),
    path.join(steamPath, 'config', 'libraryfolders.vdf'),
  ];
  const bibliotecas: string[] = [];
  for (const arquivo of candidatos) {
    if (!fs.existsSync(arquivo)) continue;
    try {
      const texto = fs.readFileSync(arquivo, 'utf8');
      const re = /"path"\s+"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(texto))) {
        const p = normalizarVdfPath(m[1]);
        if (p) bibliotecas.push(p);
      }
    } catch {
      // ignora VDF ilegível
    }
  }
  return bibliotecas;
}

function existe(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// Reúne possíveis raízes de bibliotecas: caminhos comuns + libraryfolders.vdf + drives.
function reunirBases(): string[] {
  const bases = new Set<string>();

  for (const steamPath of STEAM_COMUNS) {
    if (!existe(steamPath)) continue;
    bases.add(steamPath);
    for (const lib of lerBibliotecas(steamPath)) bases.add(lib);
  }

  if (process.platform === 'win32') {
    for (const letra of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      for (const p of [
        `${letra}:\\SteamLibrary`,
        `${letra}:\\Steam`,
        `${letra}:\\Games\\SteamLibrary`,
        `${letra}:\\Jogos\\SteamLibrary`,
      ]) {
        if (existe(p)) bases.add(p);
      }
    }
  }

  return Array.from(bases);
}

export function localizarDota(): DotaLocalizacao {
  if (cache && Date.now() < cache.expiraEm) return cache.valor;
  const valor = detectarDota();
  cache = { valor, expiraEm: Date.now() + CACHE_MS };
  return valor;
}

// Força uma nova varredura (usado após instalar).
function detectarDota(): DotaLocalizacao {
  const testados: string[] = [];
  for (const base of reunirBases()) {
    const cfgDir = path.join(base, CFG_REL);
    testados.push(cfgDir);
    if (existe(cfgDir)) {
      const gsiDir = path.join(cfgDir, GSI_SUB);
      const arquivoPath = path.join(gsiDir, GSI_ARQUIVO);
      return {
        encontrado: true,
        steamPath: base,
        cfgDir,
        gsiDir,
        arquivoPath,
        arquivoInstalado: existe(arquivoPath),
        caminhosTestados: testados,
      };
    }
  }
  return {
    encontrado: false,
    steamPath: null,
    cfgDir: null,
    gsiDir: null,
    arquivoPath: null,
    arquivoInstalado: false,
    caminhosTestados: testados,
  };
}

export function montarConteudoGsi(uri: string, token: string): string {
  return `"Dota 2 Integration Configuration"
{
    "uri"           "${uri}"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "1.0"
    "heartbeat"     "30.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "1"
        "items"         "1"
        "draft"         "1"
        "wearables"     "0"
    }
    "auth"
    {
        "token"         "${token}"
    }
}
`;
}

// Extrai o valor de uma chave do .cfg do GSI (formato "chave" "valor").
function extrairValorGsi(conteudo: string, chave: string): string | null {
  const re = new RegExp(`"${chave}"\\s+"([^"]*)"`, 'i');
  const m = re.exec(conteudo);
  return m ? m[1] : null;
}

// A uri só precisa apontar para a mesma porta/rota; o host pode variar entre
// localhost/127.0.0.1 e continua funcionando.
function uriCompativel(instalada: string | null, esperada: string): boolean {
  if (!instalada) return false;
  if (instalada === esperada) return true;
  try {
    const a = new URL(instalada);
    const b = new URL(esperada);
    return a.port === b.port && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

// Ignora espaços/quebras de linha: o que importa são os valores do .cfg
// (uri, token, buffer, throttle, heartbeat e blocos de dados).
function normalizarConteudoGsi(conteudo: string): string {
  return conteudo.replace(/\s+/g, '');
}

// Confere se o .cfg instalado é realmente deste painel. Um arquivo de outro
// gerenciador (mesmo nome de arquivo) ou com token antigo faz o Dota enviar os
// dados para a instalação errada; nesse caso o GSI fica mudo mesmo com o
// arquivo "instalado".
export function verificarGsiInstalado(
  localizacao: DotaLocalizacao,
  uriEsperada: string,
  tokenEsperado: string
): VerificacaoGsi {
  if (!localizacao.arquivoPath || !existe(localizacao.arquivoPath)) {
    return { status: 'ausente', arquivoDoApp: false, uriInstalada: null };
  }

  let conteudo: string;
  try {
    conteudo = fs.readFileSync(localizacao.arquivoPath, 'utf8');
  } catch {
    return { status: 'ilegivel', arquivoDoApp: false, uriInstalada: null };
  }

  const uriInstalada = extrairValorGsi(conteudo, 'uri');
  const tokenInstalado = extrairValorGsi(conteudo, 'token');
  const doApp =
    tokenInstalado === tokenEsperado && uriCompativel(uriInstalada, uriEsperada);

  if (!doApp) {
    return {
      status: 'outro_app',
      arquivoDoApp: false,
      uriInstalada,
    };
  }

  // O arquivo é deste painel, mas pode ter sido gerado por uma versão antiga
  // (ex.: throttle 0.5). Nesse caso o card precisa reaparecer para atualizar.
  const esperado = montarConteudoGsi(uriEsperada, tokenEsperado);
  const atualizado =
    normalizarConteudoGsi(conteudo) === normalizarConteudoGsi(esperado);

  return {
    status: atualizado ? 'ok' : 'desatualizado',
    arquivoDoApp: true,
    uriInstalada,
  };
}

export function instalarGsi(conteudo: string): ResultadoInstalacao {
  const localizacao = localizarDota();
  if (!localizacao.encontrado || !localizacao.gsiDir || !localizacao.arquivoPath) {
    return {
      ok: false,
      error:
        'Pasta do Dota 2 não encontrada automaticamente. Use "Copiar arquivo" ou "Baixar .cfg" e cole manualmente.',
      localizacao,
    };
  }
  try {
    fs.mkdirSync(localizacao.gsiDir, { recursive: true });
    fs.writeFileSync(localizacao.arquivoPath, conteudo, 'utf8');
    const atualizada: DotaLocalizacao = { ...localizacao, arquivoInstalado: true };
    cache = { valor: atualizada, expiraEm: Date.now() + CACHE_MS };
    return {
      ok: true,
      arquivoPath: localizacao.arquivoPath,
      steamPath: localizacao.steamPath ?? undefined,
      localizacao: atualizada,
    };
  } catch (e) {
    const msg = (e as Error).message;
    const dica = /EPERM|EACCES/i.test(msg)
      ? ' (execute o gerenciador como administrador ou use "Baixar .cfg")'
      : '';
    return { ok: false, error: msg + dica, localizacao };
  }
}
