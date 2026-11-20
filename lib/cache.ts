// Cache em memória das leituras do Supabase.
//
// O app roda em um único processo local (painel + OBS + prévia), então o cache
// é compartilhado por todas as requisições. Nada é persistido: ao reiniciar, a
// primeira leitura busca os dados novamente.
//
// Regras:
// - `comCache` devolve o valor guardado enquanto o TTL não vence e deduplica
//   leituras simultâneas da mesma chave.
// - Erros não são guardados; a próxima chamada tenta de novo.
// - `invalidarCache` deve ser chamado depois de qualquer escrita. Ele também
//   descarta leituras em andamento da chave, para uma resposta antiga não
//   repovoar o cache com dados de antes da escrita.
interface EntradaCache {
  valor: unknown;
  expiraEm: number;
}

interface EstadoCache {
  entradas: Map<string, EntradaCache>;
  emAndamento: Map<string, Promise<unknown>>;
  geracao: number;
}

const globalCache = globalThis as unknown as {
  _cacheTheone?: EstadoCache;
};

function estado(): EstadoCache {
  if (!globalCache._cacheTheone) {
    globalCache._cacheTheone = {
      entradas: new Map(),
      emAndamento: new Map(),
      geracao: 0,
    };
  }
  return globalCache._cacheTheone;
}

export async function comCache<T>(
  chave: string,
  ttlMs: number,
  carregar: () => Promise<T>
): Promise<T> {
  const cache = estado();
  const agora = Date.now();
  const entrada = cache.entradas.get(chave);
  if (entrada && entrada.expiraEm > agora) {
    return entrada.valor as T;
  }

  const pendente = cache.emAndamento.get(chave);
  if (pendente) return pendente as Promise<T>;

  const geracao = cache.geracao;
  const promessa: Promise<T> = carregar()
    .then((valor) => {
      // Uma escrita invalidou o cache enquanto esta leitura acontecia: não
      // guarda o resultado antigo.
      if (cache.geracao === geracao) {
        cache.entradas.set(chave, { valor, expiraEm: Date.now() + ttlMs });
      }
      return valor;
    })
    .finally(() => {
      if (cache.emAndamento.get(chave) === promessa) {
        cache.emAndamento.delete(chave);
      }
    });

  cache.emAndamento.set(chave, promessa);
  return promessa;
}

// Sem prefixo, limpa tudo. Com prefixo, limpa apenas as chaves que começam
// com ele (ex.: "cache:pedido-publico").
export function invalidarCache(prefixo?: string): void {
  const cache = estado();
  cache.geracao += 1;

  if (!prefixo) {
    cache.entradas.clear();
    cache.emAndamento.clear();
    return;
  }

  for (const mapa of [cache.entradas, cache.emAndamento]) {
    for (const chave of [...mapa.keys()]) {
      if (chave.startsWith(prefixo)) mapa.delete(chave);
    }
  }
}

export const CACHE_PEDIDOS = 'cache:pedidos';
export const CACHE_PEDIDO_PUBLICO = 'cache:pedido-publico';

export function chavePedidoPublico(trackingId: string): string {
  return `${CACHE_PEDIDO_PUBLICO}:${trackingId}`;
}
