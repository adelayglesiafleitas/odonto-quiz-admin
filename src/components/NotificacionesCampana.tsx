import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { formatoRelativo, type Ticket, type OrigenTicket } from '@/lib/tickets'

const ETIQUETA_ORIGEN: Record<OrigenTicket, string> = {
  pregunta: 'Pregunta',
  cuenta: 'Cuenta',
  pagos: 'Pagos',
  otro: 'Otro',
}

interface Props {
  tickets: Ticket[]
  correosPorId: Map<string, string>
  onVerTodas: () => void
}

// Campana de avisos en la topbar del panel: mismo dato que ya usa el badge
// de "Atención al cliente" en el sidebar (no_leido_admin) y el título de la
// pestaña (ver Panel.tsx) — visible en cualquier vista del admin, no solo
// en Atención al cliente. Mockup aprobado en claude/atencion-cliente-diseno.md.
export function NotificacionesCampana({ tickets, correosPorId, onVerTodas }: Props) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onClickAfuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickAfuera)
    return () => document.removeEventListener('mousedown', onClickAfuera)
  }, [abierto])

  const sinLeer = [...tickets]
    .filter((t) => t.noLeidoAdmin)
    .sort((a, b) => new Date(b.ultimaActividadEn).getTime() - new Date(a.ultimaActividadEn).getTime())
  const primeros = sinLeer.slice(0, 5)

  function irATodas() {
    setAbierto(false)
    onVerTodas()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {sinLeer.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[1.15rem] rounded-full bg-accent px-1.5 py-0.5 text-center text-[0.68rem] font-extrabold text-accent-foreground">
            {sinLeer.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="card-elevated absolute right-0 z-20 mt-2 w-[21rem] overflow-hidden rounded-2xl border border-border bg-popover">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-extrabold text-popover-foreground">Notificaciones</p>
            {sinLeer.length > 0 && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.68rem] font-bold text-accent">
                {sinLeer.length} sin leer
              </span>
            )}
          </div>

          {primeros.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay tickets sin leer.</p>
          ) : (
            <ul className="flex max-h-72 flex-col overflow-y-auto">
              {primeros.map((t) => (
                <li key={t.id} className="border-b border-border/60 last:border-b-0">
                  <button type="button" onClick={irATodas} className="flex w-full gap-2.5 px-4 py-3 text-left hover:bg-muted">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <span className="min-w-0">
                      <p className="truncate text-[0.83rem] font-bold text-popover-foreground">
                        {t.origen === 'pregunta' && t.preguntaNumero ? `Pregunta N.º ${t.preguntaNumero}` : ETIQUETA_ORIGEN[t.origen]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {correosPorId.get(t.usuarioId) ?? 'Usuario'} · "{t.asunto}"
                      </p>
                      <p className="mt-0.5 text-[0.68rem] text-muted-foreground">{formatoRelativo(t.ultimaActividadEn)}</p>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={irATodas}
            className="block w-full border-t border-border px-4 py-2.5 text-center text-xs font-bold text-accent hover:bg-muted"
          >
            Ver todas en Atención al cliente
          </button>
        </div>
      )}
    </div>
  )
}
