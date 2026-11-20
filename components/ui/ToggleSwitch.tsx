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
  compact = false,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  label: string;
  icon?: ReactNode;
  badge?: string;
  title?: string;
  disabled?: boolean;
  compact?: boolean;
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
      className={`group flex w-full items-center text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50 ${
        compact ? 'gap-2 rounded-lg border px-2 py-1.5' : 'gap-3 rounded-xl border px-3 py-2.5'
      } ${
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
        className={`min-w-0 flex-1 truncate font-medium transition-colors ${
          compact ? 'text-xs' : 'text-sm'
        } ${checked ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}
      >
        {label}
      </span>

      {badge && (
        <span
          className={`shrink-0 rounded-md border border-[#e8a020]/50 bg-[#e8a020]/15 font-semibold uppercase tracking-wide text-[#e8a020] ${
            compact ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'
          }`}
        >
          {badge}
        </span>
      )}

      <span
        className={`relative inline-flex shrink-0 rounded-full border transition-colors duration-200 ${
          compact ? 'h-5 w-9' : 'h-6 w-11'
        } ${checked ? 'border-[#e8a020] bg-[#e8a020]' : 'border-white/15 bg-white/15'}`}
      >
        <span
          className={`absolute left-[2px] top-[2px] rounded-full bg-white shadow transition-transform duration-200 ${
            compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'
          } ${checked ? (compact ? 'translate-x-4' : 'translate-x-[20px]') : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}
