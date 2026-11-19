// Cópia para a área de transferência com fallback para contextos não seguros.
// A Clipboard API (navigator.clipboard) só existe em HTTPS ou localhost; no
// celular acessando o painel por HTTP via IP ela fica indefinida.
export async function copiarTexto(texto: string): Promise<boolean> {
  if (typeof window === 'undefined' || !texto) return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Cai no fallback (ex.: permissão negada ou documento sem foco).
    }
  }

  return copiarComTextarea(texto);
}

function copiarComTextarea(texto: string): boolean {
  const anterior = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.fontSize = '16px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  const selecao = document.getSelection();
  const ranges = selecao
    ? Array.from({ length: selecao.rangeCount }, (_, i) => selecao.getRangeAt(i))
    : [];

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copiado = false;
  try {
    copiado = document.execCommand('copy');
  } catch {
    copiado = false;
  }

  textarea.remove();
  selecao?.removeAllRanges();
  ranges.forEach((range) => selecao?.addRange(range));
  anterior?.focus?.();

  return copiado;
}
