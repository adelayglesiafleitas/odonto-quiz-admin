import { useEffect, useMemo, useState } from 'react'
import { Inbox, Loader2, Send, CheckCheck } from 'lucide-react'
import {
  obtenerMensajes,
  enviarMensaje,
  marcarLeidoAdmin,
  actualizarEstadoTicket,
  suscribirseAMensajesTicket,
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

const selectBase =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// Bandeja de tickets (reemplaza la cola de triage por teclado sobre
// `feedback`, que queda sin usar). Ver claude/atencion-cliente-diseno.md.
export function AtencionCliente({ tickets, cargando, correosPorId, adminId, onRecargar }: Props) {
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoTicket>('todos')
  const [filtroOrigen, setFiltroOrigen] = useState<'todos' | OrigenTicket>('todos')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)

  const filtrados = useMemo(
    () =>
      tickets
        .filter((t) => filtroEstado === 'todos' || t.estado === filtroEstado)
        .filter((t) => filtroOrigen === 'todos' || t.origen === filtroOrigen),
    [tickets, filtroEstado, filtroOrigen],
  )

  // Selecciona el primero de la bandeja al entrar, para no dejar el panel
  // derecho vacío — pero solo mientras no haya nada elegido todavía, no en
  // cada cambio de filtro o de actividad.
  useEffect(() => {
    if (seleccionadoId === null && tickets.length > 0) setSeleccionadoId(tickets[0].id)
  }, [tickets, seleccionadoId])

  const seleccionado = tickets.find((t) => t.id === seleccionadoId) ?? null

  useEffect(() => {
    if (!seleccionadoId) {
      setMensajes([])
      return
    }
    let cancelado = false
    setCargandoMensajes(true)
    obtenerMensajes(seleccionadoId).then((m) => {
      if (cancelado) return
      setMensajes(m)
      setCargandoMensajes(false)
    })
    marcarLeidoAdmin(seleccionadoId).then(onRecargar)
    const desuscribir = suscribirseAMensajesTicket(
      seleccionadoId,
      (m) => setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      onRecargar,
    )
    return () => {
      cancelado = true
      desuscribir()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId])

  async function enviarRespuesta() {
    if (!seleccionadoId || !respuesta.trim() || enviando) return
    setEnviando(true)
    const { ok } = await enviarMensaje(seleccionadoId, adminId, respuesta.trim())
    if (ok) setRespuesta('')
    setEnviando(false)
  }

  async function cambiarEstado(estado: EstadoTicket) {
    if (!seleccionadoId) return
    await actualizarEstadoTicket(seleccionadoId, estado)
    onRecargar()
  }

  return (
    <section className="flex h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] gap-5 md:h-[calc(100vh-4.5rem)] md:max-h-[calc(100vh-4.5rem)]">
      {/* Columna: lista de tickets */}
      <div className="flex w-full max-w-[360px] shrink-0 flex-col">
        <div className="mb-4">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Atención al cliente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bandeja de tickets</p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className={selectBase}>
            <option value="todos">Estado: todos</option>
            <option value="abierto">Abierto</option>
            <option value="en_progreso">En progreso</option>
            <option value="resuelto">Resuelto</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value as typeof filtroOrigen)} className={selectBase}>
            <option value="todos">Origen: todos</option>
            <option value="pregunta">Pregunta</option>
            <option value="cuenta">Cuenta</option>
            <option value="pagos">Pagos</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card">
          {cargando ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm">
                {tickets.length === 0 ? 'Todavía no llegó ningún ticket.' : 'Ningún ticket coincide con estos filtros.'}
              </p>
            </div>
          ) : (
            filtrados.map((t) => {
              const activo = t.id === seleccionadoId
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSeleccionadoId(t.id)}
                  className={`block w-full border-b border-border/70 px-4 py-3 text-left transition-colors last:border-b-0 ${
                    activo ? 'bg-accent/8' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {correosPorId.get(t.usuarioId) ?? 'usuario desconocido'}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatoRelativo(t.ultimaActividadEn)}</span>
                  </div>
                  {t.origen === 'pregunta' && t.preguntaNumero != null && (
                    <span className="mb-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                      Pregunta N.º {t.preguntaNumero}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    {t.noLeidoAdmin && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                    <p className="truncate text-sm font-bold text-foreground">{t.asunto}</p>
                  </div>
                  <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTILO_ESTADO[t.estado]}`}>
                    <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
                    {ETIQUETA_ESTADO[t.estado]}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Columna: hilo del ticket seleccionado */}
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card">
        {!seleccionado ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <CheckCheck className="h-9 w-9 text-muted-foreground/60" />
            <p className="text-sm">Elegí un ticket de la lista para ver la conversación.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">{seleccionado.asunto}</h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${ESTILO_ESTADO[seleccionado.estado]}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {ETIQUETA_ESTADO[seleccionado.estado]}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {ETIQUETA_ORIGEN[seleccionado.origen]}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {correosPorId.get(seleccionado.usuarioId) ?? 'usuario desconocido'} · abierto {formatoRelativo(seleccionado.creadoEn)}
                </p>
                {seleccionado.origen === 'pregunta' && seleccionado.preguntaNumero != null && (
                  <p className="mt-2 max-w-[52ch] rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs text-foreground/80">
                    <span className="font-bold text-accent">
                      Pregunta N.º {seleccionado.preguntaNumero}
                      {seleccionado.preguntaCapitulo ? ` · ${seleccionado.preguntaCapitulo}` : ''}
                    </span>
                    {seleccionado.preguntaTexto ? ` — ${seleccionado.preguntaTexto}` : ''}
                  </p>
                )}
              </div>
              <select value={seleccionado.estado} onChange={(e) => cambiarEstado(e.target.value as EstadoTicket)} className={selectBase}>
                <option value="abierto">Marcar abierto</option>
                <option value="en_progreso">Marcar en progreso</option>
                <option value="resuelto">Marcar resuelto</option>
                <option value="cerrado">Marcar cerrado</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cargandoMensajes ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="flex max-w-[640px] flex-col gap-3">
                  {mensajes.map((m) => {
                    const esAdmin = m.autorId !== seleccionado.usuarioId
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

            <div className="border-t border-border p-4">
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
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
          </>
        )}
      </div>
    </section>
  )
}
