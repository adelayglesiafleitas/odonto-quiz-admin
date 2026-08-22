import { supabase } from './supabase'

// Gate de acceso a toda la app: cualquiera con una cuenta en el proyecto
// Supabase compartido puede autenticarse acá (mismo pool de auth.users que
// odonto-quiz-proyecto-react), pero solo quien tenga una fila en `admins`
// puede ver algo. RLS ya bloquea la lectura de datos ajenos igual, pero este
// chequeo evita que alguien no-admin quede "adentro" de la UI viendo un
// panel vacío sin explicación.
export async function esAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('Error al verificar si es admin:', error.message)
    return false
  }
  return data !== null
}
