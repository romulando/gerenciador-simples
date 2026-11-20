import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CircleCheck,
  ExternalLink,
  TriangleAlert,
  Tv,
  Wallet,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tutorial — Conectar Twitch e LivePix ao overlay',
  description:
    'Passo a passo para criar as credenciais da Twitch e da LivePix e conectá-las ao Stream Overlay.',
};

const BOTAO_PRIMARIO =
  'inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-all duration-300 hover:scale-105 hover:bg-gray-200 active:scale-[0.98]';
const BOTAO_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/10 active:scale-[0.98]';
const LINHA_DESTAQUE =
  'pointer-events-none absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent';

function Passo({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e8a020]/40 bg-[#e8a020]/10 text-xs font-bold text-[#e8a020]">
        {numero}
      </span>
      <div className="pt-1 text-sm font-light leading-relaxed text-gray-300">{children}</div>
    </li>
  );
}

function Codigo({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-gray-300">
      {children}
    </code>
  );
}

function ItemCheck({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm font-light leading-relaxed text-gray-300">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
      <span>{children}</span>
    </li>
  );
}

export default function TutorialOverlayPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
            <BookOpen className="h-3.5 w-3.5 text-[#e8a020]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e8a020]">
              Guia de configuração
            </span>
          </div>
          <Link href="/stream-overlay" className={BOTAO_SECUNDARIO}>
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Stream Overlay
          </Link>
        </div>

        <div className="space-y-3">
          <h1 className="max-w-3xl bg-gradient-to-b from-white to-gray-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl md:text-5xl">
            Conecte sua Twitch e LivePix ao overlay
          </h1>
          <p className="max-w-2xl text-sm font-light leading-relaxed text-gray-400 sm:text-base">
            Faça estas etapas no seu próprio computador e nas suas próprias contas. No final,
            volte ao painel do overlay e preencha os campos de cada integração.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="#twitch"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Tv className="h-3.5 w-3.5 text-[#c7a6ff]" />
            Twitch
          </a>
          <a
            href="#livepix"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-300" />
            LivePix
          </a>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3.5 backdrop-blur-xl">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm font-light leading-relaxed text-amber-100/90">
            <strong className="font-semibold text-amber-100">Importante:</strong> não compartilhe
            seu <em>Client Secret</em> com ninguém e não envie print mostrando esse código. Ele
            funciona como uma senha. O Client ID também deve ser inserido somente no overlay em
            que você confia.
          </p>
        </div>
      </header>

      <section
        id="twitch"
        className="relative scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
      >
        <div className={LINHA_DESTAQUE} />

        <div className="mb-5 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#9147ff]/30 bg-[#9147ff]/15 text-[#c7a6ff]">
            <Tv className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              1. Integração com a Twitch
            </h2>
            <p className="mt-1 text-sm font-light text-gray-400">
              Criar um aplicativo na Twitch e copiar duas credenciais.
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <a
            href="https://dev.twitch.tv/console/apps"
            target="_blank"
            rel="noopener noreferrer"
            className={BOTAO_PRIMARIO}
          >
            Abrir Twitch Developer Console
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <ol className="space-y-4">
          <Passo numero={1}>
            Entre no site com a{' '}
            <strong className="font-semibold text-white">
              conta Twitch que será usada no canal
            </strong>
            . Se for solicitado, confirme seu e-mail e ative a autenticação em duas etapas (2FA).
          </Passo>
          <Passo numero={2}>
            Na página de aplicações, clique em{' '}
            <strong className="font-semibold text-white">Register Your Application</strong>{' '}
            (Registrar seu aplicativo).
          </Passo>
          <Passo numero={3}>
            Em <strong className="font-semibold text-white">Name</strong>, coloque um nome para
            identificar o aplicativo, por exemplo <Codigo>Overlay da Stream</Codigo>. O nome
            precisa ser único.
          </Passo>
          <Passo numero={4}>
            Volte ao painel do overlay. Na <strong className="font-semibold text-white">Configuração da Overlay</strong>, seção{' '}
            <strong className="font-semibold text-white">Contador de subs — Twitch</strong>, clique
            em <strong className="font-semibold text-white">Copiar</strong> ao lado de “URL de
            redirect”.
          </Passo>
          <Passo numero={5}>
            Retorne ao formulário da Twitch e cole o endereço copiado no campo{' '}
            <strong className="font-semibold text-white">OAuth Redirect URLs</strong>. Clique em{' '}
            <strong className="font-semibold text-white">Add</strong> para adicionar.{' '}
            <strong className="font-semibold text-white">Não digite o endereço manualmente:</strong>{' '}
            copie o valor completo diretamente do overlay, pois ele pode aparecer cortado na tela.
          </Passo>
          <Passo numero={6}>
            Em <strong className="font-semibold text-white">Category</strong>, selecione a categoria
            mais próxima de integração/aplicativo disponível. Conclua o CAPTCHA e clique em{' '}
            <strong className="font-semibold text-white">Create</strong>.
          </Passo>
          <Passo numero={7}>
            Na lista de aplicativos, encontre o que acabou de criar e clique em{' '}
            <strong className="font-semibold text-white">Manage</strong>. Copie o{' '}
            <strong className="font-semibold text-white">Client ID</strong>.
          </Passo>
          <Passo numero={8}>
            Na mesma página, clique em{' '}
            <strong className="font-semibold text-white">New Secret</strong> para gerar o{' '}
            <strong className="font-semibold text-white">Client Secret</strong>. Copie-o e guarde
            em local privado. Se a Twitch mostrar o segredo apenas uma vez, não feche a tela antes
            de copiá-lo.
          </Passo>
          <Passo numero={9}>
            Volte ao overlay e cole cada valor no campo correspondente:{' '}
            <strong className="font-semibold text-white">Client ID</strong> no primeiro campo e{' '}
            <strong className="font-semibold text-white">Client Secret</strong> no segundo. Clique
            em <strong className="font-semibold text-white">Salvar credenciais</strong>.
          </Passo>
          <Passo numero={10}>
            Depois clique em{' '}
            <strong className="font-semibold text-white">Conectar com a Twitch</strong>. Entre na
            conta correta, confira as permissões solicitadas e autorize a conexão. O canal precisa
            ser afiliado/parceiro para liberar os subs.
          </Passo>
        </ol>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-green-500/25 bg-green-500/[0.07] px-4 py-3.5">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          <p className="text-sm font-light leading-relaxed text-green-100/90">
            <strong className="font-semibold text-green-200">Pronto quando:</strong> o painel da
            Twitch mostrar a conexão como ativa/conectada. Se der erro de redirect, confira se
            cadastrou exatamente a URL copiada pelo botão do overlay.
          </p>
        </div>
      </section>

      <section
        id="livepix"
        className="relative scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
      >
        <div className={LINHA_DESTAQUE} />

        <div className="mb-5 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              2. Integração com a LivePix
            </h2>
            <p className="mt-1 text-sm font-light text-gray-400">
              Criar uma aplicação na LivePix e inserir o ID e o segredo.
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <a
            href="https://dashboard.livepix.gg/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className={BOTAO_PRIMARIO}
          >
            Suas aplicações
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="https://livepix.gg/"
            target="_blank"
            rel="noopener noreferrer"
            className={BOTAO_SECUNDARIO}
          >
            Abrir LivePix
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <ol className="space-y-4">
          <Passo numero={1}>
            Acesse a LivePix e entre na{' '}
            <strong className="font-semibold text-white">
              conta que recebe os pagamentos da sua live
            </strong>
            .
          </Passo>
          <Passo numero={2}>
            Abra as configurações da conta e procure a área de{' '}
            <strong className="font-semibold text-white">API</strong>.
          </Passo>
          <Passo numero={3}>
            Na área de <strong className="font-semibold text-white">API</strong>, clique em{' '}
            <strong className="font-semibold text-white">Suas aplicações</strong> (botão acima) e
            crie uma nova aplicação. Use um nome fácil de reconhecer, como{' '}
            <Codigo>Overlay da Stream</Codigo>.
          </Passo>
          <Passo numero={4}>
            Após criar, localize e copie o{' '}
            <strong className="font-semibold text-white">Client ID</strong> e o{' '}
            <strong className="font-semibold text-white">Client Secret</strong> gerados pela
            LivePix.
          </Passo>
          <Passo numero={5}>
            Volte ao overlay, na{' '}
            <strong className="font-semibold text-white">Configuração da Overlay</strong>, seção{' '}
            <strong className="font-semibold text-white">Barra do LivePix — API</strong>. Cole o
            Client ID no primeiro campo e o Client Secret no segundo.
          </Passo>
          <Passo numero={6}>
            Clique em{' '}
            <strong className="font-semibold text-white">Salvar credenciais e testar</strong> e
            aguarde o resultado da conexão.
          </Passo>
        </ol>

        <p className="mt-5 text-xs font-light leading-relaxed text-gray-500">
          <strong className="font-semibold text-gray-400">Permissões usadas pelo overlay:</strong>{' '}
          <Codigo>account:read</Codigo>, <Codigo>payments:read</Codigo> e{' '}
          <Codigo>messages:read</Codigo>. A própria integração solicita essas permissões; não é
          necessário cadastrar URL de redirect para essa conexão por credenciais.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-green-500/25 bg-green-500/[0.07] px-4 py-3.5">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          <p className="text-sm font-light leading-relaxed text-green-100/90">
            <strong className="font-semibold text-green-200">Pronto quando:</strong> o painel
            indicar que a LivePix está conectada. Se o teste falhar, confira se copiou o Client ID
            e o Client Secret da aplicação correta, sem espaços extras.
          </p>
        </div>
      </section>

      <section className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
        <div className={LINHA_DESTAQUE} />

        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          3. Conferência final
        </h2>

        <ul className="mt-5 space-y-3">
          <ItemCheck>
            Twitch aparece como <strong className="font-semibold text-white">Conectado</strong>.
          </ItemCheck>
          <ItemCheck>
            LivePix aparece como <strong className="font-semibold text-white">Conectado</strong>.
          </ItemCheck>
          <ItemCheck>As credenciais foram salvas no computador que executa o overlay.</ItemCheck>
          <ItemCheck>
            Você não compartilhou o Client Secret em prints, mensagens ou transmissões.
          </ItemCheck>
        </ul>

        <p className="mt-5 text-xs font-light leading-relaxed text-gray-500">
          Se você trocar de computador ou apagar as configurações locais do overlay, talvez precise
          inserir as credenciais novamente e refazer a autorização da Twitch.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <Link href="/stream-overlay" className={BOTAO_PRIMARIO}>
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Stream Overlay
          </Link>
        </div>
      </section>

      <footer className="flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-600">
        <BookOpen className="h-3.5 w-3.5" />
        Guia de configuração do overlay · Links externos abrem em uma nova aba
      </footer>
    </div>
  );
}
