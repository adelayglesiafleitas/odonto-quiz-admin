import { useCallback, useEffect, useState } from 'react'
import { AdminSidebar, type Vista } from '@/components/AdminSidebar'
import { listarUsuarios, type Usuario } from '@/lib/usuarios'
import { listarTodosTickets, contarNoLeidos, suscribirseATickets, type Ticket } from '@/lib/tickets'
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

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [cargandoTickets, setCargandoTickets] = useState(true)
  const recargarTickets = useCallback(async () => {
    setTickets(await listarTodosTickets())
    setCargandoTickets(false)
  }, [])

  useEffect(() => {
    recargarUsuarios()
    recargarTickets()

    // `tickets` ya tiene Realtime habilitado (migración
    // crear_tickets_mensajes) — el trigger de la base actualiza la fila del
    // ticket cada vez que llega un mensaje nuevo, así que suscribirse solo
    // a esta tabla alcanza para que la bandeja y el badge del sidebar se
    // refresquen solos, sin recargar la página.
    return suscribirseATickets(recargarTickets)
  }, [recargarUsuarios, recargarTickets])

  const pendientes = contarNoLeidos(tickets)
  const correosPorId = new Map(usuarios.map((u) => [u.id, u.email] as const))

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <AdminSidebar vista={vista} onCambiarVista={setVista} correo={correo} pendientes={pendientes} />
      <main className="min-w-0 flex-1 px-5 py-6 md:px-9 md:py-9">
        {vista === 'usuarios' ? (
          <Usuarios usuarios={usuarios} cargando={cargandoUsuarios} miPropioId={userId} onRecargar={recargarUsuarios} />
        ) : (
          <AtencionCliente
            tickets={tickets}
            cargando={cargandoTickets}
            correosPorId={correosPorId}
            adminId={userId}
            onRecargar={recargarTickets}
          />
        )}
      </main>
    </div>
  )
}
