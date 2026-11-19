'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  X,
} from 'lucide-react';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/acompanhamento', label: 'Acompanhamento', icon: Activity },
  { href: '/stream-overlay', label: 'Stream Overlay', icon: MonitorPlay },
];

export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => {});
    router.push('/login');
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1.5">
      {LINKS.map((item) => {
        const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setAberto(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              ativo
                ? 'border border-[#e8a020]/30 bg-[#e8a020]/10 text-[#f3c46a]'
                : 'border border-transparent text-gray-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[10%] left-[10%] h-[40rem] w-[40rem] rounded-full bg-[#e8a020]/10 blur-[160px]" />
        <div className="absolute -bottom-[10%] right-[5%] h-[35rem] w-[35rem] rounded-full bg-indigo-700/10 blur-[150px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl md:flex">
          <div className="mb-8 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e8a020]">
              Boost MMR
            </p>
            <p className="mt-1 text-lg font-bold text-white">Theone</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">{email}</p>
          </div>
          {nav}
          <button
            type="button"
            onClick={sair}
            className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </aside>

        {/* Drawer mobile */}
        {aberto && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setAberto(false)}
            />
            <aside className="relative flex h-full w-72 flex-col border-r border-white/10 bg-[#090b12] p-4">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e8a020]">
                    Boost MMR
                  </p>
                  <p className="text-lg font-bold text-white">Theone</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-lg p-2 text-gray-300 hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <button
                type="button"
                onClick={sair}
                className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-gray-300"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#05060a]/80 px-4 py-3 backdrop-blur-xl md:hidden">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setAberto(true)}
              className="rounded-xl p-2 text-gray-200 transition-colors hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-[#e8a020]">Theone</span>
          </header>
          <main className="flex-1 overflow-x-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
