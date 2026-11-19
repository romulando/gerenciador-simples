import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16: "middleware" foi renomeado para "proxy".
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login';
  const isOverlayPublico =
    pathname === '/overlay' ||
    pathname === '/api/overlay/dados' ||
    pathname === '/api/overlay/estado' ||
    pathname === '/api/overlay/transicao' ||
    pathname === '/api/gsi';
  const isApiAuth = pathname.startsWith('/api/auth');
  const isApi = pathname.startsWith('/api');
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/dota-bg-video.mp4' ||
    pathname.startsWith('/images') ||
    /\.(mp4|webm|webp|png|jpe?g|svg|ico|gif|woff2?|ttf)$/i.test(pathname);

  if (isPublicAsset || isApiAuth || isOverlayPublico) return response;

  if (!user) {
    if (isApi) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!isLoginPage) return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
