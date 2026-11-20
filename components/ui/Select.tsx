'use client';

import { ChevronDown } from 'lucide-react';
import {
  Children,
  isValidElement,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface OptionItem {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
}

// Extrai texto puro de um ReactNode (strings/números, inclusive dentro de arrays),
// usado para filtrar opções cujo label mistura texto e expressões
function extrairTexto(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extrairTexto).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extrairTexto(props.children);
  }
  return '';
}

// Coleta os <option> filhos (mesma API do <select> nativo) para montar o dropdown customizado
function parseOptions(children: ReactNode): OptionItem[] {
  const out: OptionItem[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const p = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (p.value === undefined) return;
    out.push({
      value: String(p.value),
      label: p.children,
      text: extrairTexto(p.children),
      disabled: p.disabled ?? false,
    });
  });
  return out;
}

// Compara ignorando maiúsculas/minúsculas e acentos
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface SelectProps {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  // Quando true, o gatilho vira um input de texto que filtra as opções
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}

// Dropdown customizado no padrão glass: abre com bg amarelo escurecido,
// hover das opções com contorno dourado e opção marcada em âmbar escuro
export default function Select({
  value,
  onChange,
  children,
  className = '',
  disabled,
  id,
  name,
  searchable = false,
  searchPlaceholder,
  emptyText = 'Nenhum resultado',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const options = parseOptions(children);
  const valueStr = String(value);
  const selectedIndex = options.findIndex((o) => o.value === valueStr);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : '';
  const selectedText = selectedIndex >= 0 ? options[selectedIndex].text : '';

  // Opções exibidas: sem busca mostra todas, com busca filtra pelo texto digitado
  const visiveis =
    searchable && query.trim()
      ? options.filter((o) => o.text && normalizar(o.text).includes(normalizar(query.trim())))
      : options;

  // posição do dropdown em coordenadas de viewport (portal no body,
  // para nunca ficar atrás de cards com backdrop-blur/stacking context)
  const updatePos = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  function abrir() {
    setQuery('');
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    updatePos();
    setOpen(true);
  }

  function selecionar(v: string) {
    onChange({ target: { value: v } });
    setOpen(false);
    setQuery('');
    // A lista fica num portal no body, então o evento não borbulha sozinho até
    // o formulário que envolve o Select. Disparamos um `input` a partir do wrapper
    // para que <div onChange/onInput> (ex.: PedidoForm) marque o form como alterado.
    rootRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // recalcula posição em scroll/resize enquanto aberto
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  // fecha ao clicar fora (considera botão e lista, que está em portal)
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (disabled) return;
    if (!open) {
      if (
        e.key === 'Enter' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        (!searchable && e.key === ' ')
      ) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (visiveis.length) setHighlight((h) => Math.min(visiveis.length - 1, h + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (visiveis.length) setHighlight((h) => Math.max(0, h - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (visiveis[highlight] && !visiveis[highlight].disabled) selecionar(visiveis[highlight].value);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  const chevron = (
    <ChevronDown
      className={`pointer-events-none h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    />
  );

  return (
    <div ref={rootRef} className="relative w-full">
      {searchable ? (
        <div className="relative w-full">
          <input
            id={id}
            name={name}
            type="text"
            disabled={disabled}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={open ? query : selectedText}
            placeholder={searchPlaceholder || selectedText}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
              updatePos();
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              if (!open) abrir();
            }}
            onClick={() => {
              if (!open) abrir();
            }}
            onKeyDown={onKeyDown}
            style={{ paddingRight: '2.25rem' }}
            className={`${className} transition-all duration-300 disabled:opacity-40 ${
              open
                ? 'border-amber-500/60 bg-[rgba(232,160,32,0.14)] shadow-[0_0_0_3px_rgba(232,160,32,0.18)]'
                : ''
            }`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{chevron}</span>
        </div>
      ) : (
        <button
          id={id}
          name={name}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : abrir())}
          onKeyDown={onKeyDown}
          className={`${className} flex items-center justify-between gap-2 text-left transition-all duration-300 disabled:opacity-40 ${
            open
              ? 'border-amber-500/60 bg-[rgba(232,160,32,0.14)] shadow-[0_0_0_3px_rgba(232,160,32,0.18)]'
              : ''
          }`}
        >
          <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
          {chevron}
        </button>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            id={listId}
            ref={listRef}
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[9999] max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0e14]/95 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            {visiveis.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">{emptyText}</div>
            )}
            {visiveis.map((o, i) => {
              const selecionado = o.value === valueStr;
              const destacado = i === highlight;
              return (
                <button
                  key={`${o.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  disabled={o.disabled}
                  onClick={() => selecionar(o.value)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    selecionado
                      ? 'bg-[#2a2008] text-[#f0c060]'
                      : destacado
                        ? 'text-white ring-1 ring-inset ring-amber-500/70'
                        : 'text-gray-200'
                  } ${o.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
