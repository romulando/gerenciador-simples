export default function Progresso({
  pct,
  className = '',
}: {
  pct: number;
  className?: string;
}) {
  const valor = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e8a020] to-[#f3c46a] transition-all duration-500"
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums text-gray-300">
        {valor.toFixed(0)}%
      </span>
    </div>
  );
}
