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

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
