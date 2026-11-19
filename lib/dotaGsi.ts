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
    "throttle"      "0.5"
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
