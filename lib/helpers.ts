export const TIPOS_SERVICO: Record<string, string> = {
  boost_solo: 'Boost Solo',
  boost_duo: 'Boost Duo',
  calibracao_solo: 'Calibração Solo',
  calibracao_duo: 'Calibração Duo',
  match_group: 'Partidas em Grupo',
  low_priority_solo: 'Low Priority Solo',
  low_priority_duo: 'Low Priority Duo',
  behavior_boost: 'Behavior Boost',
  role_queue: 'Role Queue',
  aula_replay: 'Aula: Análise de Replay',
  aula_coach: 'Aula: Coach ao Vivo',
  aula_combo: 'Aula: Combo (Replay + Coach)',
};

export const ESTADOS: Record<string, { label: string; classe: string }> = {
  lead_aberto: { label: 'Lead Aberto', classe: 'bg-gray-600/20 text-gray-300 border-gray-500/40' },
  aguardando_pagamento: {
    label: 'Aguardando Pagamento',
    classe: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/40',
  },
  em_andamento: {
    label: 'Em Andamento',
    classe: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
  },
  pausado: {
    label: 'Pausado',
    classe: 'bg-orange-600/20 text-orange-300 border-orange-500/40',
  },
  concluido: {
    label: 'Concluído',
    classe: 'bg-green-600/20 text-green-300 border-green-500/40',
  },
  cancelado: { label: 'Cancelado', classe: 'bg-red-600/20 text-red-300 border-red-500/40' },
  ban: { label: 'Ban', classe: 'bg-purple-700/20 text-purple-300 border-purple-500/40' },
};

export const MEDALHAS = [
  'Arauto',
  'Guardião',
  'Cruzado',
  'Arconte',
  'Lenda',
  'Ancião',
  'Divino',
  'Imortal',
] as const;

// Serviços jogados na conta do cliente (vínculo automático pela conta do Dota).
export const SERVICOS_SOLO = [
  'boost_solo',
  'calibracao_solo',
  'low_priority_solo',
  'behavior_boost',
  'role_queue',
] as const;

// Serviços jogados junto com o cliente (vínculo pelo pedido selecionado).
export const SERVICOS_DUO = [
  'boost_duo',
  'calibracao_duo',
  'low_priority_duo',
  'match_group',
] as const;

export function ehServicoSolo(tipoServico: unknown): boolean {
  return (SERVICOS_SOLO as readonly string[]).includes(String(tipoServico ?? ''));
}

export function ehServicoDuo(tipoServico: unknown): boolean {
  return (SERVICOS_DUO as readonly string[]).includes(String(tipoServico ?? ''));
}

export function isBoost(tipoServico: string | null | undefined): boolean {
  return String(tipoServico ?? '').startsWith('boost');
}

export function usaMmr(tipoServico: string | null | undefined): boolean {
  return isBoost(tipoServico);
}

export function rotuloQuantidade(tipoServico: string): string {
  if (tipoServico === 'role_queue') return 'fichas';
  if (tipoServico === 'behavior_boost') return 'pontos';
  if (tipoServico.startsWith('aula_')) return 'aulas';
  return 'partidas';
}

export function formatarMoeda(valor: number | null | undefined): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataIso(valor: string | null | undefined): string {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return formatarData(valor);
  return d.toLocaleDateString('pt-BR');
}

export function formatarData(valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim().replace('T', ' ');
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return texto;
  const base = `${m[3]}/${m[2]}/${m[1]}`;
  return m[4] ? `${base} ${m[4]}:${m[5]}` : base;
}

export function formatarDataHora(valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim().replace('T', ' ');
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return texto;
  const base = `${m[3]}/${m[2]}/${m[1]}`;
  return m[4] ? `${base} ${m[4]}:${m[5]}:${m[6] ?? '00'}` : base;
}

export function agoraLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

export function chaveDataHora(valor: unknown): string {
  const texto = String(valor ?? '').trim().replace('T', ' ');
  const m = texto.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return texto;
  return `${m[1]} ${m[2] ?? '00'}:${m[3] ?? '00'}:${m[4] ?? '00'}`;
}

export function normalizarDataRegistro(valor: unknown): string {
  const chave = chaveDataHora(valor);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(chave) ? chave : agoraLocal();
}

// Data/hora local em que a partida começou, no formato do banco
// (YYYY-MM-DD HH:MM:SS). O GSI salva `iniciadaEm` em ISO/UTC (com Z), então
// converte para o fuso local; sem ela, usa `finalizadaEm` (que já é local).
export function dataHoraInicioPartida(
  iniciadaEm: unknown,
  finalizadaEm: unknown
): string | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  const inicio = String(iniciadaEm ?? '').trim();
  if (inicio) {
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(inicio)) {
      const d = new Date(inicio);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
          d.getHours()
        )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    }
    const m = inicio.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}`;
  }
  const fim = chaveDataHora(finalizadaEm);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fim) ? fim : null;
}

export function clampPct(valor: number): number {
  return Math.max(0, Math.min(100, Number(valor) || 0));
}
