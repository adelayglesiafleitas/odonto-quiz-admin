import { supabase } from './supabase'

export type RolAdmin = 'admin' | 'subadmin'

// Gate de acceso a toda la app: cualquiera con una cuenta en el proyecto
// Supabase compartido puede autenticarse acá (mismo pool de auth.users que
// odonto-quiz-proyecto-react), pero solo quien tenga una fila en `admins`
// puede ver algo. Esa fila ahora también dice qué nivel tiene (columna
// `tipo`, migración agregar_rol_subadmin): 'admin' ve todo el panel,
// 'subadmin' solo Atención al cliente — devolvemos el tipo directo en vez de
// un booleano para que App.tsx no necesite una segunda consulta. RLS ya
// bloquea la lectura de datos ajenos igual, pero este chequeo evita que
// alguien sin fila quede "adentro" de la UI viendo un panel vacío sin
// explicación.
export async function obtenerRolAdmin(userId: string): Promise<RolAdmin | null> {
  const { data, error } = await supabase.from('admins').select('tipo').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('Error al verificar el rol de admin:', error.message)
    return null
  }
  return (data?.tipo as RolAdmin | undefined) ?? null
}
