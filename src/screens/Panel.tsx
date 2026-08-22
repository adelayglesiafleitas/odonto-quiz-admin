import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AdminSidebar, type Vista } from '@/components/AdminSidebar'
import { listarUsuarios, type Usuario } from '@/lib/usuarios'
import { listarFeedback, type FeedbackItem } from '@/lib/feedbackAdmin'
import { Usuarios } from './Usuarios'
import { AtencionCliente } from './AtencionCliente'

export function Panel({ correo, userId }: { correo: string; userId: string }) {
  const [vista, setVista] = useState<Vista>('usuarios')

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)
  const recargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true)
    setUsuarios(await listarUsuarios())
    setCargandoUsuarios(false)
  }, [])

  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [cargandoFeedback, setCargandoFeedback] = useState(true)
  const recargarFeedback = useCallback(async () => {
    setFeedback(await listarFeedback())
    setCargandoFeedback(false)
  }, [])

  useEffect(() => {
    recargarUsuarios()
    recargarFeedback()

    // La tabla `feedback` ya tiene Realtime habilitado (migración
    // add_feedback_table) — se aprovecha acá para que la cola y el badge
    // del sidebar se actualicen solos si otro admin resuelve un caso, o si
    // llega un reporte nuevo, sin tener que refrescar la página.
    const canal = supabase
      .channel('admin-feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
        recargarFeedback()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [recargarUsuarios, recargarFeedback])

  const pendientes = feedback.filter((f) => f.estado === 'pendiente' || f.estado === 'en_revision').length
  const correosPorId = new Map(usuarios.map((u) => [u.id, u.email] as const))

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <AdminSidebar vista={vista} onCambiarVista={setVista} correo={correo} pendientes={pendientes} />
      <main className="min-w-0 flex-1 px-5 py-6 md:px-9 md:py-9">
        {vista === 'usuarios' ? (
          <Usuarios usuarios={usuarios} cargando={cargandoUsuarios} />
        ) : (
          <AtencionCliente
            feedback={feedback}
            cargando={cargandoFeedback}
            correosPorId={correosPorId}
            adminId={userId}
            onRecargar={recargarFeedback}
          />
        )}
      </main>
    </div>
  )
}
