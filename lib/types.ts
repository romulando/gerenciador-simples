export interface PedidoTheone {
  id: string;
  tracking_id: string;
  tipo_servico: string;
  adicional: string;
  estado: string;
  mmr_inicial: number | null;
  mmr_atual: number | null;
  mmr_desejado: number | null;
  medalha: string | null;
  partidas: number | null;
  partidas_jogadas: number;
  cupom: string;
  valor: number;
  saldo_manual: { valor: number; dataAtualizacao?: string } | null;
  tabela_precos: unknown;
  observacoes: string;
  created_at: string;
  atualizado_em: string;
  saldo_restante: number | null;
  consumido: number | null;
  progresso_pct: number | null;
  mmr_final_calculado: number | null;
  recalculado_em: string | null;
}

export interface RegistroTheone {
  id: string;
  pedido_id: string;
  origem: string;
  origem_id: string | null;
  tipo: 'mmr' | 'partidas';
  data: string;
  mmr_inicial: number | null;
  mmr_final: number | null;
  quantidade: number | null;
  medalha: string;
  observacoes: string;
  hero: string;
  resultado: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  motivo_ajuste: string | null;
  ordem: number | null;
  created_at: string;
  atualizado_em: string;
}

export interface LogTheone {
  id: number;
  pedido_id: string | null;
  tipo: string;
  mensagem: string;
  detalhes: Record<string, unknown> | null;
  origem: string;
  criado_em: string;
}

export interface TrackingTheone {
  tracking_id: string;
  tipo_servico: string;
  servico_label: string;
  estado: string;
  mmr_inicial: number | null;
  mmr_atual: number | null;
  mmr_desejado: number | null;
  mmr_inicial_ajustado: number | null;
  mmr_final_ajustado: number | null;
  partidas: number | null;
  partidas_jogadas: number;
  progresso_pct: number | null;
  vitorias: number;
  derrotas: number;
  historico: unknown[];
  atualizado_em: string;
}

export interface CalculoPedido {
  saldo_restante: number;
  consumido: number;
  progresso_pct: number;
  mmr_atual: number;
  mmr_final_calculado: number;
}

export interface RespostaRecalculo {
  calculo: CalculoPedido;
  tracking: TrackingTheone;
}
