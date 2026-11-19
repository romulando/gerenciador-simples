export interface MedalhaInfo {
  nome: string;
  nivel: number;
  imagem: string;
  cor: string;
}

interface FaixaMedalha {
  nome: string;
  imagemBase: string;
  min: number;
  max: number;
  levels: number;
  cor: string;
}

const FAIXAS: FaixaMedalha[] = [
  { nome: 'Arauto', imagemBase: 'Arauto', min: 0, max: 770, levels: 5, cor: '#AAB25A' },
  { nome: 'Guardião', imagemBase: 'Guardiao', min: 770, max: 1540, levels: 5, cor: '#A67356' },
  { nome: 'Cruzado', imagemBase: 'Cruzado', min: 1540, max: 2310, levels: 5, cor: '#00C2BD' },
  { nome: 'Arconte', imagemBase: 'Arconte', min: 2310, max: 3080, levels: 5, cor: '#12C4AD' },
  { nome: 'Lenda', imagemBase: 'Lenda', min: 3080, max: 3850, levels: 5, cor: '#D4A03C' },
  { nome: 'Ancião', imagemBase: 'Anciao', min: 3850, max: 4620, levels: 5, cor: '#5682D1' },
  { nome: 'Divino', imagemBase: 'Divino', min: 4620, max: 5620, levels: 5, cor: '#FFC75F' },
  { nome: 'Imortal', imagemBase: 'Imortal', min: 5620, max: 8000, levels: 1, cor: '#E67E42' },
];

export function medalhaDoMmr(mmr: number | null | undefined): MedalhaInfo | null {
  if (mmr == null) return null;
  const valor = Number(mmr);
  if (!Number.isFinite(valor)) return null;
  const faixa =
    FAIXAS.find((m) => valor >= m.min && valor < m.max) ??
    (valor >= 8000 ? FAIXAS[FAIXAS.length - 1] : null);
  if (!faixa) return null;
  const passo = (faixa.max - faixa.min) / faixa.levels;
  const nivel = Math.min(faixa.levels, Math.max(1, Math.floor((valor - faixa.min) / passo) + 1));
  const arquivo = faixa.levels === 1 ? `${faixa.imagemBase}.png` : `${faixa.imagemBase}-${nivel}.png`;
  return { nome: faixa.nome, nivel, imagem: `/images/medals/${arquivo}`, cor: faixa.cor };
}

export function medalhaDoNome(nome: string | null | undefined): string {
  const alvo = String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const faixa = FAIXAS.find(
    (m) =>
      m.nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() === alvo
  );
  return faixa ? `/images/medals/${faixa.imagemBase}.png` : '/images/medals/Arauto.png';
}
