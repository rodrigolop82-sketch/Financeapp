import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth checks if Supabase is not configured (dev/preview mode)
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        // getAll/setAll: la sesión de Google viene partida en varias cookies
        // (sb-…-auth-token.0, .1). Con get/set/remove cada set recreaba la
        // respuesta y solo sobrevivía la última parte, así que al refrescar
        // el token se perdía la sesión y había que volver a iniciar sesión.
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const protectedRoutes = ['/dashboard', '/presupuesto', '/deudas', '/plan', '/transacciones', '/familia', '/cuenta', '/onboarding', '/chat', '/admin', '/notificacion', '/resumen', '/metas', '/score', '/mas', '/planes', '/unir'];
  const authRoutes = ['/login', '/registro'];
  const path = request.nextUrl.pathname;

  // Redirect unauthenticated users from protected routes to login
  if (!user && protectedRoutes.some((route) => path.startsWith(route))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return redirectWithCookies(url, response);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (user && authRoutes.some((route) => path.startsWith(route))) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return redirectWithCookies(url, response);
  }

  return response;
}

// Una redirección también debe llevar las cookies de sesión recién refrescadas.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
