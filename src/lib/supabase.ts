import { createClient } from '@supabase/supabase-js'

// Mismo proyecto Supabase que odonto-quiz-proyecto-react (misma anon key):
// la separación de qué puede hacer cada app no es por tener claves
// distintas, es por RLS — ver claude/panel-revision-admin.md en el proyecto
// de Claude. Esta app se distingue por autenticar como un usuario que además
// está en la tabla `admins` (ver src/lib/admin.ts).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y pon tus claves de Supabase.',
  )
}

// Workaround incidencia Supabase "401 errors due to JWT rejections" (sept 2026):
// PostgREST rechaza a veces tokens recién emitidos por una caché de hora desfasada.
// Solo reintentamos peticiones a la API REST (/rest/v1/), nunca las de auth,
// donde un 401 sí significa credenciales malas. Quitar cuando el proyecto
// esté actualizado a la versión que corrige el problema.
const REINTENTOS_401_MS = [1000, 2000]

const fetchConReintento: typeof fetch = async (input, init) => {
  const urlPeticion =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const esRest = urlPeticion.includes('/rest/v1/')
  const original = input instanceof Request ? input.clone() : input

  let res = await fetch(input, init)
  if (!esRest) return res

  for (const espera of REINTENTOS_401_MS) {
    if (res.status !== 401) return res
    await new Promise((r) => setTimeout(r, espera))
    res = await fetch(original instanceof Request ? original.clone() : original, init)
  }
  return res
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchConReintento },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
