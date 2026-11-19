// Utilidades puras de conta do Dota 2 (sem dependências de servidor).
// Aceitam o account_id de 32 bits usado pelo GSI ou um SteamID64 (17 dígitos).

// Converte steamid64 no account_id de 32 bits usado pelo Dota 2.
export function accountIdDeSteamId(steamId: unknown): string {
  const bruto = String(steamId ?? '').trim();
  if (!/^\d+$/.test(bruto)) return '';
  try {
    const base = BigInt('76561197960265728');
    const id = BigInt(bruto) - base;
    return id > BigInt(0) ? id.toString() : '';
  } catch {
    return '';
  }
}

// Normaliza o que o usuário digitou: remove máscara e, quando vier um
// SteamID64, converte para o account_id de 32 bits.
export function normalizarIdDota(valor: unknown): string {
  const bruto = String(valor ?? '').replace(/\D/g, '');
  if (!bruto) return '';
  // Acima de 15 dígitos é SteamID64: converte ou descarta (não é account_id).
  if (bruto.length > 15) return accountIdDeSteamId(bruto);
  return bruto;
}

// Validação usada pelo formulário: account_id de até 10 dígitos (32 bits) ou
// um SteamID64 de 17 dígitos, que é convertido antes de validar.
export function contaDotaValida(valor: unknown): boolean {
  return /^\d{4,10}$/.test(normalizarIdDota(valor));
}
