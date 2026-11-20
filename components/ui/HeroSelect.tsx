'use client';

import Select from '@/components/ui/Select';
import HeroImg from '@/components/ui/HeroImg';
import { HEROES, acharHero, nomeHeroi } from '@/lib/heroes';

// Seletor de herói com busca e miniatura, no mesmo padrão do Select usado em
// /descobrir-medalha. O valor enviado/salvo continua sendo o nome interno.
export default function HeroSelect({
  value,
  onChange,
  className,
  id,
  disabled,
  placeholder = 'Digite o herói...',
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const atual = acharHero(value)?.interno ?? String(value ?? '').trim();
  const conhecido = HEROES.some((hero) => hero.interno === atual);

  return (
    <Select
      id={id}
      value={atual}
      onChange={onChange}
      className={className}
      disabled={disabled}
      searchable
      searchPlaceholder={placeholder}
      emptyText="Nenhum herói encontrado"
    >
      <option value="">Sem herói</option>
      {HEROES.map((hero) => (
        <option key={hero.interno} value={hero.interno}>
          <span className="flex items-center gap-2">
            <HeroImg
              interno={hero.interno}
              nome={hero.nome}
              className="h-5 w-9 shrink-0 rounded object-cover"
            />
            {hero.nome}
          </span>
        </option>
      ))}
      {atual && !conhecido && <option value={atual}>{nomeHeroi(atual)}</option>}
    </Select>
  );
}
