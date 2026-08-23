import { useEffect, useMemo, useState } from 'react'
import { Search, Inbox, Loader2, Send, X, MessageCircleQuestion } from 'lucide-react'
import {
  obtenerMensajes,
  enviarMensaje,
  marcarLeidoAdmin,
  actualizarEstadoTicket,
  suscribirseAMensajesTicket,
  contarNoLeidos,
  formatoRelativo,
  type Ticket,
  type Mensaje,
  type EstadoTicket,
  type OrigenTicket,
} from '@/lib/tickets'

interface Props {
  tickets: Ticket[]
  cargando: boolean
  correosPorId: Map<string, string>
  adminId: string
  onRecargar: () => void
}

const ETIQUETA_ESTADO: Record<EstadoTicket, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
}

const ESTILO_ESTADO: Record<EstadoTicket, string> = {
  abierto: 'bg-info/12 text-info',
  en_progreso: 'bg-accent/12 text-accent',
  resuelto: 'bg-success/12 text-success',
  cerrado: 'bg-muted text-muted-foreground',
}

const ETIQUETA_ORIGEN: Record<OrigenTicket, string> = {
  pregunta: 'Pregunta',
  cuenta: 'Cuenta',
  pagos: 'Pagos',
  otro: 'Otro',
}

const inputBase =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// Bandeja de tickets: lista tipo tabla (mismo patrón que Usuarios.tsx) — un
// clic en una fila abre la conversación en una ventana de chat encima, en
// vez del panel fijo de dos columnas de la primera versión. Reemplaza la
// cola de triage por teclado sobre `feedback`, que queda sin usar. Ver
// claude/atencion-cliente-diseno.md.
export function AtencionCliente({ tickets, cargando, correosPorId, adminId, onRecargar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoTicket>('todos')
  const [filtroOrigen, setFiltroOrigen] = useState<'todos' | OrigenTicket>('todos')
  const [ticketAbiertoId, setTicketAbiertoId] = useState<string | null>(null)

  const stats = useMemo(
    () => ({
      total: tickets.length,
      abiertos: tickets.filter((t) => t.estado === 'abierto').length,
      sinLeer: contarNoLeidos(tickets),
      resueltos: tickets.filter((t) => t.estado === 'resuelto').length,
    }),
    [tickets],
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return tickets
      .filter((t) => !q || (correosPorId.get(t.usuarioId) ?? '').toLowerCase().includes(q) || t.asunto.toLowerCase().includes(q))
      .filter((t) => filtroEstado === 'todos' || t.estado === filtroEstado)
      .filter((t) => filtroOrigen === 'todos' || t.origen === filtroOrigen)
  }, [tickets, busqueda, filtroEstado, filtroOrigen, correosPorId])

  const hayFiltros = busqueda.trim() !== '' || filtroEstado !== 'todos' || filtroOrigen !== 'todos'

  // El ticket abierto en el modal se resuelve siempre desde `tickets` (no
  // una copia propia), para que un cambio de estado o de actividad por
  // Realtime se refleje sin tener que cerrar y volver a abrir el modal.
  const ticketAbierto = ticketAbiertoId ? tickets.find((t) => t.id === ticketAbiertoId) ?? null : null

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Atención al cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bandeja de tickets — datos en vivo desde Supabase.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard etiqueta="Total tickets" valor={stats.total} cargando={cargando} />
        <StatCard etiqueta="Abiertos" valor={stats.abiertos} cargando={cargando} tono="text-info" />
        <StatCard etiqueta="Sin leer" valor={stats.sinLeer} cargando={cargando} tono="text-accent" />
        <StatCard etiqueta="Resueltos" valor={stats.resueltos} cargando={cargando} tono="text-success" />
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por correo o asunto"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className={inputBase}>
          <option value="todos">Estado: todos</option>
          <option value="abierto">Abierto</option>
          <option value="en_progreso">En progreso</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value as typeof filtroOrigen)} className={inputBase}>
          <option value="todos">Origen: todos</option>
          <option value="pregunta">Pregunta</option>
          <option value="cuenta">Cuenta</option>
          <option value="pagos">Pagos</option>
          <option value="otro">Otro</option>
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('')
              setFiltroEstado('todos')
              setFiltroOrigen('todos')
            }}
            className="text-sm font-bold text-accent hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        {cargando ? 'Cargando…' : hayFiltros ? `${filtrados.length} de ${tickets.length} tickets` : `${tickets.length} tickets`}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">Usuario</th>
                <th className="whitespace-nowrap px-4 py-3">Asunto</th>
                <th className="whitespace-nowrap px-4 py-3">Origen</th>
                <th className="whitespace-nowrap px-4 py-3">Estado</th>
                <th className="whitespace-nowrap px-4 py-3">Actividad</th>
                <th className="whitespace-nowrap px-4 py-3">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {tickets.length === 0 ? (
                      <span className="flex flex-col items-center gap-2">
                        <Inbox className="h-6 w-6 text-muted-foreground/60" />
                        Todavía no llegó ningún ticket.
                      </span>
                    ) : (
                      'Ningún ticket coincide con estos filtros.'
                    )}
                  </td>
                </tr>
              ) : (
                filtrados.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setTicketAbiertoId(t.id)}
                    className={`cursor-pointer border-b border-border/70 text-sm last:border-b-0 hover:bg-muted/50 ${
                      t.noLeidoAdmin ? 'bg-accent/[0.04]' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">
                      {correosPorId.get(t.usuarioId) ?? 'usuario desconocido'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {t.noLeidoAdmin && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                        <span className="font-bold text-foreground">{t.asunto}</span>
                      </div>
                      {t.origen === 'pregunta' && t.preguntaNumero != null && (
                        <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                          Pregunta N.º {t.preguntaNumero}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                        {ETIQUETA_ORIGEN[t.origen]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${ESTILO_ESTADO[t.estado]}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                        {ETIQUETA_ESTADO[t.estado]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{formatoRelativo(t.ultimaActividadEn)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <MessageCircleQuestion className="ml-auto h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">Clic en cualquier fila para abrir la conversación.</p>

      {ticketAbierto && (
        <ModalChat
          ticket={ticketAbierto}
          correo={correosPorId.get(ticketAbierto.usuarioId) ?? 'usuario desconocido'}
          adminId={adminId}
          onClose={() => setTicketAbiertoId(null)}
          onRecargar={onRecargar}
        />
      )}
    </section>
  )
}

function StatCard({
  etiqueta,
  valor,
  cargando,
  tono,
}: {
  etiqueta: string
  valor: number
  cargando: boolean
  tono?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className={`font-mono text-2xl font-extrabold tabular-nums ${tono ?? 'text-foreground'}`}>{cargando ? '—' : valor}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{etiqueta}</div>
    </div>
  )
}

function ModalChat({
  ticket,
  correo,
  adminId,
  onClose,
  onRecargar,
}: {
  ticket: Ticket
  correo: string
  adminId: string
  onClose: () => void
  onRecargar: () => void
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(true)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCargandoMensajes(true)
    obtenerMensajes(ticket.id).then((m) => {
      if (cancelado) return
      setMensajes(m)
      setCargandoMensajes(false)
    })
    marcarLeidoAdmin(ticket.id).then(onRecargar)
    const desuscribir = suscribirseAMensajesTicket(
      ticket.id,
      (m) => setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      onRecargar,
    )
    return () => {
      cancelado = true
      desuscribir()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onClose])

  async function enviarRespuesta() {
    if (!respuesta.trim() || enviando) return
    setEnviando(true)
    const { ok } = await enviarMensaje(ticket.id, adminId, respuesta.trim())
    if (ok) setRespuesta('')
    setEnviando(false)
  }

  async function cambiarEstado(estado: EstadoTicket) {
    await actualizarEstadoTicket(ticket.id, estado)
    onRecargar()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-titulo"
        className="flex h-[80vh] max-h-[720px] w-full max-w-2xl animate-float-up flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="chat-titulo" className="text-[15.5px] font-extrabold text-foreground">
                {ticket.asunto}
              </h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${ESTILO_ESTADO[ticket.estado]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {ETIQUETA_ESTADO[ticket.estado]}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {ETIQUETA_ORIGEN[ticket.origen]}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">
              {correo} · abierto {formatoRelativo(ticket.creadoEn)}
            </p>
            {ticket.origen === 'pregunta' && ticket.preguntaNumero != null && (
              <p className="mt-2 max-w-[52ch] rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs text-foreground/80">
                <span className="font-bold text-accent">
                  Pregunta N.º {ticket.preguntaNumero}
                  {ticket.preguntaCapitulo ? ` · ${ticket.preguntaCapitulo}` : ''}
                </span>
                {ticket.preguntaTexto ? ` — ${ticket.preguntaTexto}` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select value={ticket.estado} onChange={(e) => cambiarEstado(e.target.value as EstadoTicket)} className={inputBase}>
              <option value="abierto">Marcar abierto</option>
              <option value="en_progreso">Marcar en progreso</option>
              <option value="resuelto">Marcar resuelto</option>
              <option value="cerrado">Marcar cerrado</option>
            </select>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cargandoMensajes ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {mensajes.map((m) => {
                const esAdmin = m.autorId !== ticket.usuarioId
                return (
                  <div key={m.id} className={esAdmin ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`max-w-[78%] ${esAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          esAdmin ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary text-foreground'
                        }`}
                      >
                        {m.cuerpo}
                      </div>
                      <p className="mt-1 px-0.5 font-mono text-[10.5px] text-muted-foreground">
                        {new Date(m.creadoEn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <textarea
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviarRespuesta()
              }
            }}
            placeholder="Escribí tu respuesta…"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={enviarRespuesta}
              disabled={!respuesta.trim() || enviando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
