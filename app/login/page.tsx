'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alerta from '@/components/ui/Alerta';

export default function LoginPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduzir =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzir) {
      v.pause();
    } else {
      void v.play().catch(() => {
        /* autoplay bloqueado: mantém o quadro atual */
      });
    }
    const sync = () => setPausado(v.paused);
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    const raf = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('play', sync);
      v.removeEventListener('pause', sync);
    };
  }, []);

  function alternarVideo() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPausado(false);
    } else {
      v.pause();
      setPausado(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', login, senha }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error || 'Usuário ou senha incorretos. Confira os dados e tente de novo.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setErro('Não foi possível conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05060a] text-white">
      {/* Fundo: vídeo → camada escura → luzes ambiente */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src="/dota-bg-video.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 100% 90% at 50% 45%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.9) 100%)',
          }}
        />
        <div className="absolute -top-[12%] left-[8%] h-[40rem] w-[40rem] rounded-full bg-[#e8a020]/10 blur-[160px]" />
        <div className="absolute -bottom-[12%] right-[4%] h-[35rem] w-[35rem] rounded-full bg-indigo-700/10 blur-[150px]" />
      </div>

      {/* Conteúdo */}
      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,456px)] lg:gap-16">
        {/* Marca */}
        <section className="rise flex flex-col items-center text-center">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e8a020]">
              Área do booster
            </span>
          </span>
          <h1 className="mt-6 max-w-[14ch] bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold leading-[1.05] tracking-tight text-transparent sm:text-5xl md:text-6xl">
            Seus pedidos de boost
          </h1>
          <p className="mt-4 max-w-[36ch] text-lg font-light text-gray-300 [text-shadow:0_1px_14px_rgba(0,0,0,0.7)]">
            Acompanhe o MMR, as partidas e o progresso de cada pedido.
          </p>
        </section>

        {/* Card de vidro */}
        <section className="rise rise-d2">
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-9">
            <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />

            <h2 className="text-2xl font-bold tracking-tight text-white">Entrar no painel</h2>
            <p className="mb-7 mt-1.5 font-light text-gray-300">
              Entre com sua conta para acessar os pedidos atribuídos a você.
            </p>

            {erro && (
              <Alerta tipo="erro" className="mb-4">
                {erro}
              </Alerta>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <label
                  htmlFor="usuario"
                  className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-gray-300"
                >
                  Usuário
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#e8a020]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c1.2-3.6 4.2-5.5 8-5.5s6.8 1.9 8 5.5" />
                  </svg>
                  <input
                    id="usuario"
                    type="text"
                    value={login}
                    onChange={(e) => {
                      setLogin(e.target.value);
                      if (erro) setErro('');
                    }}
                    required
                    autoFocus
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Theone"
                    className="h-[52px] w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-[17px] text-white placeholder-[#6b7385] transition-all duration-300 hover:bg-white/[0.07] focus:border-white/30 focus:bg-white/10 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(232,160,32,0.25)]"
                  />
                </div>
              </div>

              <div className="mb-5">
                <label
                  htmlFor="senha"
                  className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-gray-300"
                >
                  Senha
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#e8a020]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
                    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                  </svg>
                  <input
                    id="senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value);
                      if (erro) setErro('');
                    }}
                    required
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    className="h-[52px] w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-24 text-[17px] text-white placeholder-[#6b7385] transition-all duration-300 hover:bg-white/[0.07] focus:border-white/30 focus:bg-white/10 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(232,160,32,0.25)]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((s) => !s)}
                    aria-pressed={mostrarSenha}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-all duration-300 hover:bg-white/10 hover:text-white"
                  >
                    {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.06em] text-black transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.98] disabled:cursor-progress disabled:bg-white/10 disabled:text-white/50 disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                {loading && (
                  <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/25 border-t-white" />
                )}
                {loading ? 'Entrando…' : 'Entrar no painel'}
              </button>
            </form>
          </div>
          <p className="mt-5 text-center text-sm text-gray-300 [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]">
            Acesso restrito ao booster autorizado.
          </p>
        </section>
      </main>

      {/* Controle do vídeo de fundo */}
      <button
        type="button"
        onClick={alternarVideo}
        aria-label={pausado ? 'Reproduzir vídeo de fundo' : 'Pausar vídeo de fundo'}
        className="fixed bottom-5 right-5 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:bg-white/20 sm:bottom-6 sm:right-6"
      >
        {pausado ? (
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        ) : (
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" />
          </svg>
        )}
      </button>
    </div>
  );
}
