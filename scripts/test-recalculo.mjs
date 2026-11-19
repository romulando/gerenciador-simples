// Testa a API de recálculo do site com um pedido real do gerenciador.
// Uso:
//   node scripts/test-recalculo.mjs --pedido 32 --url http://localhost:4000
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

function lerEnv(arquivo) {
  const valores = {};
  if (!fs.existsSync(arquivo)) return valores;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) valores[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return valores;
}

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : padrao;
};

const pedidoId = Number(arg('--pedido', '32'));
const url = arg('--url', 'http://localhost:4000').replace(/\/+$/, '');
const raiz = process.cwd();
const env = lerEnv(path.join(raiz, '.env.local'));
const secret = env.THEONE_API_SECRET || process.env.THEONE_API_SECRET;
if (!secret) {
  console.error('THEONE_API_SECRET não encontrado no .env.local.');
  process.exit(1);
}

const db = new Database(path.join(raiz, '..', 'gerenciador-pedidos', 'gerenciador.db'), {
  readonly: true,
});
const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
if (!p) {
  console.error(`Pedido ${pedidoId} não encontrado.`);
  process.exit(1);
}

const json = (valor) => {
  if (valor == null || valor === '') return null;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
};

const mmr = db
  .prepare('SELECT * FROM registros_mmr WHERE pedidoId = ? ORDER BY ordem, id')
  .all(pedidoId)
  .map((r) => ({
    id: r.id,
    data: r.data,
    mmr_inicial: r.mmrInicial,
    mmr_final: r.mmrFinal,
    observacoes: r.observacoes ?? '',
    hero: r.hero ?? '',
    resultado: r.resultado ?? '',
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    motivo_ajuste: r.motivoAjuste ?? null,
    ordem: r.ordem,
  }));
const partidas = db
  .prepare('SELECT * FROM registros_partidas WHERE pedidoId = ? ORDER BY ordem, id')
  .all(pedidoId)
  .map((r) => ({
    id: r.id,
    data: r.data,
    quantidade: r.quantidade,
    medalha: r.medalha ?? '',
    observacoes: r.observacoes ?? '',
    hero: r.hero ?? '',
    resultado: r.resultado ?? '',
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    ordem: r.ordem,
  }));

const payload = {
  pedido: {
    id: String(p.id),
    tracking_id: p.trackingId,
    tipo_servico: p.tipoServico,
    adicional: p.adicional,
    estado: p.estado,
    mmr_inicial: p.mmrInicial,
    mmr_atual: p.mmrAtual,
    mmr_desejado: p.mmrDesejado,
    partidas: p.partidas,
    partidas_jogadas: p.partidasJogadas,
    medalha: p.medalha,
    valor: Number(p.valor) || 0,
    saldo_manual: json(p.saldoManual),
    tabela_precos: json(p.tabelaPrecos),
    observacoes: p.observacoes ?? '',
  },
  registros: { mmr, partidas },
};

const res = await fetch(`${url}/api/tracking-theone/recalcular`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-theone-secret': secret },
  body: JSON.stringify(payload),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`HTTP ${res.status}`, data);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
if (pedidoId === 32) {
  const alvo = data?.calculo?.mmr_final_calculado;
  if (alvo !== 3866) {
    console.error(`Esperado 3866 para o 73BV, recebido ${alvo}.`);
    process.exit(2);
  }
  console.log('OK: 73BV-U7F7-GHBK recalculado em 3866.');
}
