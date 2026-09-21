import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// '/' is the exact-match public marketing landing (see app/page.tsx) — the
// admin dashboard itself lives at '/admin'. Exact-match it separately below
// since `pathname.startsWith('/')` would otherwise match every route.
const PUBLIC_EXACT_PATHS = ['/'];
const PUBLIC_PREFIX_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/privacidad', '/terminos', '/eliminar-cuenta'];
// A password-recovery link logs the visitor in via a short-lived recovery
// session before they've set a new password — unlike /login or /signup,
// being authenticated here is the expected state, not a reason to bounce
// them away. Same for the public marketing/legal pages — a logged-in admin
// browsing them isn't a reason to redirect either.
const SKIP_LOGGED_IN_REDIRECT = ['/reset-password', '/', '/privacidad', '/terminos', '/eliminar-cuenta'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    PUBLIC_EXACT_PATHS.includes(pathname) || PUBLIC_PREFIX_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const skipLoggedInRedirect = SKIP_LOGGED_IN_REDIRECT.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(p)),
  );

  if (user && isPublicPath && !skipLoggedInRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
