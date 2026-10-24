import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, UserResponse } from '@supabase/supabase-js';

// Cuánto se reutiliza la respuesta de getUser(). El middleware ya valida la
// sesión en cada navegación y RLS protege los datos; esto solo evita repetir
// la misma pregunta al servidor de auth desde cada componente.
const USER_TTL_MS = 5 * 60 * 1000;

const shared = new WeakSet<object>();

// Cada pantalla y sus hooks llaman a auth.getUser() por su cuenta (decenas de
// lugares). supabase-js hace cada llamada en la red sosteniendo su candado de
// auth, así que se ejecutan en fila y todas las consultas a la base (que
// también pasan por ese candado para leer el token) esperan detrás. Al cambiar
// de menú eso sumaba segundos. Aquí todas comparten una sola llamada.
function shareGetUser(client: SupabaseClient) {
  if (shared.has(client)) return;
  shared.add(client);

  const auth = client.auth;
  const original = auth.getUser.bind(auth);
  let pending: Promise<UserResponse> | null = null;
  let startedAt = 0;

  auth.getUser = (jwt?: string) => {
    if (jwt) return original(jwt);
    if (pending && Date.now() - startedAt < USER_TTL_MS) return pending;
    startedAt = Date.now();
    const request = original().then(
      (res) => {
        // Sin usuario o con error no se guarda: la siguiente llamada pregunta otra vez.
        if (res.error || !res.data.user) {
          if (pending === request) pending = null;
        }
        return res;
      },
      (err) => {
        if (pending === request) pending = null;
        throw err;
      }
    );
    pending = request;
    return request;
  };

  // Entrar, salir o cambiar datos del usuario invalida la respuesta guardada.
  // Refrescar el token no cambia quién es el usuario.
  auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
    pending = null;
  });
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // During build time, return a dummy client that won't be used
    // Client components only execute in the browser at runtime
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }

  // En el navegador createBrowserClient devuelve siempre el mismo cliente.
  const client = createBrowserClient(url, key);
  if (typeof window !== 'undefined') shareGetUser(client);
  return client;
}
