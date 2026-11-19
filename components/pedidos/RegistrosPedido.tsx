'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { MEDALHAS, formatarData, isBoost, rotuloQuantidade } from '@/lib/helpers';
import { enviarJson } from './common';
import Alerta from '@/components/ui/Alerta';
import type { PedidoTheone, RegistroTheone, RespostaRecalculo } from '@/lib/types';

function agoraInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function dataInput(valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim().replace('T', ' ');
  const m = texto.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return '';
  return `${m[1]}T${m[2] ?? '00'}:${m[3] ?? '00'}`;
}

function inteiroOuVazio(valor: unknown): string {
  return valor == null || valor === '' ? '' : String(valor);
}

export default function RegistrosPedido({
  pedido,
  registros,
}: {
  pedido: PedidoTheone;
  registros: RegistroTheone[];
}) {
  const router = useRouter();
  const boost = isBoost(pedido.tipo_servico);
  const [tipo, setTipo] = useState<'mmr' | 'partidas'>(boost ? 'mmr' : 'partidas');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [data, setData] = useState('');
  const [mmrInicial, setMmrInicial] = useState(
    inteiroOuVazio(pedido.mmr_atual ?? pedido.mmr_inicial)
  );
  const [mmrFinal, setMmrFinal] = useState(
    inteiroOuVazio(pedido.mmr_atual ?? pedido.mmr_inicial)
  );
  const [quantidade, setQuantidade] = useState('1');
  const [medalha, setMedalha] = useState(pedido.medalha ?? '');
  const [hero, setHero] = useState('');
  const [resultado, setResultado] = useState('');
  const [kills, setKills] = useState('');
  const [deaths, setDeaths] = useState('');
  const [assists, setAssists] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [novoMmr, setNovoMmr] = useState(inteiroOuVazio(pedido.mmr_atual));
  const [motivo, setMotivo] = useState<'inicial' | 'partidas_cliente' | 'outro'>(
    'partidas_cliente'
  );
  const [motivoOutro, setMotivoOutro] = useState('');
  const [dataAjuste, setDataAjuste] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  function limparForm() {
    setEditandoId(null);
    setData('');
    setQuantidade('1');
    setHero('');
    setResultado('');
    setKills('');
    setDeaths('');
    setAssists('');
    setObservacoes('');
    setMmrInicial(inteiroOuVazio(pedido.mmr_atual ?? pedido.mmr_inicial));
    setMmrFinal(inteiroOuVazio(pedido.mmr_atual ?? pedido.mmr_inicial));
  }

  function aplicarResultado(res: { recalculo?: RespostaRecalculo; aviso?: string }) {
    if (res.recalculo) {
      setMensagem(
        `Site recalculou: MMR final ${res.recalculo.calculo.mmr_final_calculado} · saldo R$ ${res.recalculo.calculo.saldo_restante.toFixed(
          2
        )} · progresso ${res.recalculo.calculo.progresso_pct.toFixed(2)}%`
      );
    } else {
      setMensagem(res.aviso ? `Registro salvo. Recálculo pendente: ${res.aviso}` : 'Registro salvo.');
    }
    router.refresh();
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      const corpo = {
        tipo,
        data,
        mmrInicial,
        mmrFinal,
        quantidade,
        medalha,
        hero,
        resultado,
        kills,
        deaths,
        assists,
        observacoes,
      };
      if (editandoId) {
        const res = await enviarJson<{ recalculo?: RespostaRecalculo; aviso?: string }>(
          `/api/orders/${pedido.id}/records`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registroId: editandoId, ...corpo }),
          }
        );
        aplicarResultado(res);
      } else {
        const res = await enviarJson<{ recalculo?: RespostaRecalculo; aviso?: string }>(
          `/api/orders/${pedido.id}/records`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          }
        );
        aplicarResultado(res);
      }
      limparForm();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarAjuste(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      const res = await enviarJson<{ recalculo?: RespostaRecalculo; aviso?: string }>(
        `/api/orders/${pedido.id}/records`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'ajuste_mmr',
            novoMmr,
            motivo,
            motivoOutro,
            data: dataAjuste,
          }),
        }
      );
      aplicarResultado(res);
      setAjusteAberto(false);
      setNovoMmr(inteiroOuVazio(pedido.mmr_atual));
      setMotivoOutro('');
      setDataAjuste('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function editar(r: RegistroTheone) {
    setEditandoId(r.id);
    setTipo(r.tipo);
    setData(dataInput(r.data));
    setMmrInicial(inteiroOuVazio(r.mmr_inicial));
    setMmrFinal(inteiroOuVazio(r.mmr_final));
    setQuantidade(inteiroOuVazio(r.quantidade) || '1');
    setMedalha(r.medalha ?? '');
    setHero(r.hero ?? '');
    setResultado(r.resultado ?? '');
    setKills(inteiroOuVazio(r.kills));
    setDeaths(inteiroOuVazio(r.deaths));
    setAssists(inteiroOuVazio(r.assists));
    setObservacoes(r.observacoes ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function excluir(r: RegistroTheone) {
    if (!window.confirm('Excluir este registro?')) return;
    setSalvando(true);
    setErro('');
    try {
      const res = await enviarJson<{ recalculo?: RespostaRecalculo; aviso?: string }>(
        `/api/orders/${pedido.id}/records?registroId=${encodeURIComponent(r.id)}`,
        { method: 'DELETE' }
      );
      aplicarResultado(res);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const lista = [...registros].sort((a, b) => {
    const oa = Number(a.ordem ?? 0);
    const ob = Number(b.ordem ?? 0);
    if (oa !== ob) return oa - ob;
    return String(a.created_at).localeCompare(String(b.created_at));
  });

  return (
    <div id="acompanhamento" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Acompanhamento
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Ao salvar, o sistema pergunta ao site o novo MMR final e o saldo restante.
          </p>
        </div>
        {boost && (
          <button
            type="button"
            onClick={() => setAjusteAberto((v) => !v)}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white transition-colors hover:bg-white/10"
          >
            {ajusteAberto ? 'Fechar ajuste' : 'Ajuste manual de MMR'}
          </button>
        )}
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {mensagem && <Alerta tipo="sucesso">{mensagem}</Alerta>}

      {ajusteAberto && boost && (
        <form
          onSubmit={salvarAjuste}
          className="space-y-3 rounded-xl border border-[#e8a020]/25 bg-[#e8a020]/5 p-4"
        >
          <p className="text-sm font-medium text-[#f3c46a]">Ajuste manual de MMR</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Novo MMR</label>
              <input
                type="number"
                min={0}
                required
                value={novoMmr}
                onChange={(e) => setNovoMmr(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Motivo</label>
              <select
                value={motivo}
                onChange={(e) =>
                  setMotivo(e.target.value as 'inicial' | 'partidas_cliente' | 'outro')
                }
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="partidas_cliente">Partidas do cliente</option>
                <option value="inicial">Corrigir MMR inicial</option>
                <option value="outro">Outro motivo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Data (opcional)</label>
              <input
                type="datetime-local"
                value={dataAjuste}
                onChange={(e) => setDataAjuste(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
            {motivo === 'outro' && (
              <div>
                <label className="mb-1 block text-xs text-gray-400">Descreva o motivo</label>
                <input
                  value={motivoOutro}
                  onChange={(e) => setMotivoOutro(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-full bg-[#e8a020] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            Aplicar ajuste
          </button>
        </form>
      )}

      <form
        onSubmit={salvar}
        className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTipo('mmr')}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              tipo === 'mmr'
                ? 'bg-[#e8a020] font-semibold text-black'
                : 'border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            MMR
          </button>
          <button
            type="button"
            onClick={() => setTipo('partidas')}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              tipo === 'partidas'
                ? 'bg-[#e8a020] font-semibold text-black'
                : 'border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            {rotuloQuantidade(pedido.tipo_servico)}
          </button>
          {editandoId && (
            <span className="ml-auto flex items-center gap-2 text-xs text-amber-300">
              Editando registro
              <button type="button" onClick={limparForm} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Data/hora</label>
            <input
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          {tipo === 'mmr' ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-gray-400">MMR inicial</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={mmrInicial}
                  onChange={(e) => setMmrInicial(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">MMR final</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={mmrFinal}
                  onChange={(e) => setMmrFinal(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Medalha</label>
                <select
                  value={medalha}
                  onChange={(e) => setMedalha(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">—</option>
                  {MEDALHAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs text-gray-400">Herói</label>
            <input
              value={hero}
              onChange={(e) => setHero(e.target.value)}
              placeholder="ex.: axe"
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Resultado</label>
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="">—</option>
              <option value="W">Vitória</option>
              <option value="L">Derrota</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:col-span-1">
            {[
              ['K', kills, setKills],
              ['D', deaths, setDeaths],
              ['A', assists, setAssists],
            ].map(([label, valor, setter]) => (
              <div key={String(label)}>
                <label className="mb-1 block text-xs text-gray-400">{String(label)}</label>
                <input
                  type="number"
                  min={0}
                  value={String(valor)}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">Observação</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {editandoId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {salvando ? 'Salvando…' : editandoId ? 'Salvar edição' : 'Adicionar registro'}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={limparForm}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Histórico ({lista.length})
        </h3>
        {lista.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-500">
            Nenhum registro lançado.
          </p>
        ) : (
          lista
            .slice()
            .reverse()
            .map((r) => {
              const delta =
                r.tipo === 'mmr' && r.mmr_inicial != null && r.mmr_final != null
                  ? Number(r.mmr_final) - Number(r.mmr_inicial)
                  : null;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <span
                    className={`h-8 w-1 rounded-full ${
                      r.tipo === 'mmr' ? 'bg-sky-500' : 'bg-[#e8a020]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {r.tipo === 'mmr'
                          ? `MMR ${r.mmr_inicial ?? '—'} → ${r.mmr_final ?? '—'}`
                          : `+${r.quantidade ?? 0} ${rotuloQuantidade(pedido.tipo_servico)}`}
                      </span>
                      {delta != null && delta !== 0 && (
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            delta > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                      {r.motivo_ajuste && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                          ajuste {r.motivo_ajuste === 'partidas_cliente' ? 'partidas do cliente' : r.motivo_ajuste}
                        </span>
                      )}
                      {r.resultado && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            r.resultado === 'W'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {r.resultado === 'W' ? 'Vitória' : 'Derrota'}
                        </span>
                      )}
                      {r.medalha && (
                        <span className="text-[10px] text-gray-400">{r.medalha}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>{formatarData(r.data)}</span>
                      {r.hero && <span>{r.hero}</span>}
                      {(r.kills != null || r.deaths != null || r.assists != null) && (
                        <span>
                          K/D/A {r.kills ?? 0}/{r.deaths ?? 0}/{r.assists ?? 0}
                        </span>
                      )}
                      {r.observacoes && <span className="text-gray-400">{r.observacoes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => editar(r)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(r)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
