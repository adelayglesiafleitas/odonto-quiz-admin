import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { obtenerRolAdmin, type RolAdmin } from '@/lib/admin'
import { Login } from '@/screens/Login'
import { NoAutorizado } from '@/screens/NoAutorizado'
import { Panel } from '@/screens/Panel'

type EstadoAdmin = 'verificando' | RolAdmin | 'no-admin'
//cambio  kk
function Cargando() {
  return (
    <div className="app-shell flex items-center justify-center bg-background">
      <span
        role="status"
        aria-label="Cargando"
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sesionLista, setSesionLista] = useState(false)
  const [estadoAdmin, setEstadoAdmin] = useState<EstadoAdmin>('verificando')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSesionLista(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const correo = session?.user.email ?? ''

  useEffect(() => {
    if (!userId) {
      setEstadoAdmin('verificando')
      return
    }
    let cancelado = false
    setEstadoAdmin('verificando')
    obtenerRolAdmin(userId).then((rol) => {
      if (!cancelado) setEstadoAdmin(rol ?? 'no-admin')
    })
    return () => {
      cancelado = true
    }
  }, [userId])

  if (!sesionLista) return <Cargando />
  if (!session) return <Login />
  if (estadoAdmin === 'verificando') return <Cargando />
  if (estadoAdmin === 'no-admin') return <NoAutorizado />
  return <Panel correo={correo} userId={session.user.id} rol={estadoAdmin} />
}

export default App
