'use client';

import type { ReactNode } from 'react';

// Cartão liga/desliga no estilo do painel: rótulo à esquerda, switch à direita.
// Quando ativo, o cartão ganha borda/fundo âmbar e o switch fica âmbar.
export default function ToggleSwitch({
  checked,
  onChange,
  label,
  icon,
  badge,
  title,
  disabled,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  label: string;
  icon?: ReactNode;
  badge?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50 ${
        checked
          ? 'border-[#e8a020]/70 bg-[#e8a020]/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/10'
      } ${disabled ? '' : 'cursor-pointer'}`}
    >
      {icon && (
        <span className={`shrink-0 transition-colors ${checked ? 'text-[#e8a020]' : 'text-gray-400'}`}>
          {icon}
        </span>
      )}

      <span
        className={`min-w-0 flex-1 truncate text-sm font-medium transition-colors ${
          checked ? 'text-white' : 'text-gray-300 group-hover:text-white'
        }`}
      >
        {label}
      </span>

      {badge && (
        <span className="shrink-0 rounded-md border border-[#e8a020]/50 bg-[#e8a020]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#e8a020]">
          {badge}
        </span>
      )}

      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ${
          checked ? 'border-[#e8a020] bg-[#e8a020]' : 'border-white/15 bg-white/15'
        }`}
      >
        <span
          className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-[20px]' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
