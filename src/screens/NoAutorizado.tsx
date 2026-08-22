import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { ShieldAlert } from 'lucide-react'

// Se ve cuando alguien inicia sesión con una cuenta válida de Supabase (el
// mismo pool de auth.users que la app de examen) pero esa cuenta no tiene
// fila en `admins`. RLS ya le bloquearía la lectura de datos ajenos, pero
// sin esta pantalla vería un panel vacío sin explicación.
export function NoAutorizado() {
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-lg font-bold text-foreground">Esta cuenta no es admin</h1>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Iniciaste sesión correctamente, pero esta cuenta no tiene acceso al panel de revisión.
        </p>
      </div>
      <Button variant="outline" className="mt-2 h-10 rounded-xl" onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </Button>
    </div>
  )
}
