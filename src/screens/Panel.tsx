import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminSidebar, NAV, type Vista } from '@/components/AdminSidebar'
import { NotificacionesCampana } from '@/components/NotificacionesCampana'
import type { RolAdmin } from '@/lib/admin'
import { listarUsuarios, type Usuario } from '@/lib/usuarios'
import { listarTodosTickets, contarNoLeidos, suscribirseATickets, type Ticket } from '@/lib/tickets'
import { Usuarios } from './Usuarios'
import { AtencionCliente } from './AtencionCliente'
import { Mensajes } from './Mensajes'
import { Estadisticas } from './Estadisticas'
import { Preguntas } from './Preguntas'
import { Chat } from './Chat'
import { UsoLimites } from './UsoLimites'
import { contarPendientesChat, suscribirseAPendientesChat } from '@/lib/chat'
import { obtenerUso, obtenerConfigUso, LIMITES, nivelDe } from '@/lib/uso'

export function Panel({ correo, userId, rol }: { correo: string; userId: string; rol: RolAdmin }) {
  const esSubadmin = rol === 'subadmin'
  const [vista, setVista] = useState<Vista>(esSubadmin ? 'atencion' : 'usuarios')
  // Un subadmin solo tiene una pantalla — esto no es solo "ocultar el botón":
  // aunque `vista` cambiara por algún otro medio, acá se vuelve a fijar en
  // 'atencion' antes de decidir qué se renderiza. La defensa real está en la
  // base (RLS por tipo de admin), esto es nomás para que la UI nunca muestre
  // algo que después la base le va a rechazar.
  const vistaEfectiva: Vista = esSubadmin ? 'atencion' : vista
  const navSidebar = useMemo(() => (esSubadmin ? NAV.filter((n) => n.target === 'atencion') : NAV), [esSubadmin])

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

  const [chatPend, setChatPend] = useState(0)
  const [usoAlerta, setUsoAlerta] = useState(0)
  const recargarChatPend = useCallback(async () => setChatPend(await contarPendientesChat()), [])

  useEffect(() => {
    if (esSubadmin) return
    recargarChatPend()
    ;(async () => {
      const [u, c] = await Promise.all([obtenerUso(), obtenerConfigUso()])
      if (!u) return
      const lim = LIMITES[c.plan]
      setUsoAlerta(nivelDe((u.dbBytes / lim.dbBytes) * 100, c) === 'ok' ? 0 : 1)
    })()
    return suscribirseAPendientesChat(recargarChatPend)
  }, [esSubadmin, recargarChatPend])

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

  // Aviso en la pestaña del navegador: mismo dato que la campana de la
  // topbar y el badge del sidebar (no_leido_admin) — mockup aprobado en
  // claude/atencion-cliente-diseno.md.
  useEffect(() => {
    document.title = pendientes > 0 ? `(${pendientes}) ExamPrep · Panel admin` : 'ExamPrep · Panel admin'
  }, [pendientes])

  const tituloVista = NAV.find((n) => n.target === vistaEfectiva)?.label ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <AdminSidebar
        vista={vistaEfectiva}
        onCambiarVista={setVista}
        correo={correo}
        pendientes={pendientes}
        insignias={{ chat: chatPend, uso: usoAlerta }}
        nav={navSidebar}
        rol={rol}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3.5 md:px-9">
          <p className="text-[0.95rem] font-extrabold text-foreground">{tituloVista}</p>
          <NotificacionesCampana tickets={tickets} correosPorId={correosPorId} onVerTodas={() => setVista('atencion')} />
        </header>
        <main className="min-w-0 flex-1 px-5 py-6 md:px-9 md:py-9">
          {vistaEfectiva === 'usuarios' ? (
            <Usuarios usuarios={usuarios} cargando={cargandoUsuarios} miPropioId={userId} onRecargar={recargarUsuarios} />
          ) : vistaEfectiva === 'atencion' ? (
            <AtencionCliente
              tickets={tickets}
              cargando={cargandoTickets}
              correosPorId={correosPorId}
              adminId={userId}
              onRecargar={recargarTickets}
            />
          ) : vistaEfectiva === 'preguntas' ? (
            <Preguntas />
          ) : vistaEfectiva === 'chat' ? (
            <Chat adminId={userId} onPendientes={recargarChatPend} />
          ) : vistaEfectiva === 'uso' ? (
            <UsoLimites />
          ) : vistaEfectiva === 'mensajes' ? (
            <Mensajes usuarios={usuarios} cargandoUsuarios={cargandoUsuarios} />
          ) : (
            <Estadisticas
              usuarios={usuarios}
              cargandoUsuarios={cargandoUsuarios}
              tickets={tickets}
              cargandoTickets={cargandoTickets}
            />
          )}
        </main>
      </div>
    </div>
  )
}
