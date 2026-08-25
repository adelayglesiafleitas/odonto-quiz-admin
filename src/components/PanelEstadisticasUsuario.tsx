import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { X, Loader2, Inbox } from 'lucide-react'
import { obtenerHistorialUsuario, agregarTemas, type Intento, type TemaResumen } from '@/lib/historial'
import type { Usuario } from '@/lib/usuarios'

const formatoFechaCorta = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' })
const formatoFechaHora = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
function fechaCorta(iso: string): string {
  return formatoFechaCorta.format(new Date(iso))
}
function fechaHora(iso: string): string {
  return formatoFechaHora.format(new Date(iso))
}
function fmtTiempo(seg: number): string {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
}

interface Props {
  usuario: Usuario
  onClose: () => void
}

// Panel lateral con las estadísticas individuales de un usuario — se abre
// desde Usuarios.tsx al hacer clic en su nombre. Pide el historial bajo
// demanda (obtenerHistorialUsuario) en vez de traerlo junto con la lista
// completa, para no cargar el historial de todos los usuarios de una.
export function PanelEstadisticasUsuario({ usuario, onClose }: Props) {
  const [intentos, setIntentos] = useState<Intento[] | null>(null)

  useEffect(() => {
    let activo = true
    setIntentos(null)
    obtenerHistorialUsuario(usuario.id).then((data) => {
      if (activo) setIntentos(data)
    })
    return () => {
      activo = false
    }
  }, [usuario.id])

  useEffect(() => {
    function alPresionarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', alPresionarTecla)
    return () => document.removeEventListener('keydown', alPresionarTecla)
  }, [onClose])

  const cargando = intentos === null
  const n = intentos?.length ?? 0
  const promedio = n ? Math.round(intentos!.reduce((acc, it) => acc + it.porcentaje, 0) / n) : null
  const aprobados = intentos?.filter((it) => it.aprobado).length ?? 0
  const temas = intentos ? agregarTemas(intentos) : []
  const recientes = intentos ? [...intentos].reverse().slice(0, 8) : []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-estadisticas-email"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col overflow-y-auto border-l border-border bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-sm font-extrabold text-accent">
              {usuario.email.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 id="panel-estadisticas-email" className="truncate font-mono text-base font-extrabold text-foreground">
                {usuario.email}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    usuario.esAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {usuario.esAdmin ? 'Admin' : 'Usuario'}
                </span>
                <span>Alta {fechaCorta(usuario.creadoEn)}</span>
                {usuario.ultimoAcceso && (
                  <>
                    <span>·</span>
                    <span>Último acceso {fechaCorta(usuario.ultimoAcceso)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          {cargando ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : n === 0 ? (
            <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card px-6 py-14 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-50" />
              <p className="text-sm font-bold text-foreground">Todavía no hizo ningún simulacro</p>
              <p className="max-w-[34ch] text-xs">
                En cuanto complete el primero, acá van a aparecer su evolución de puntaje y los temas con más dificultad.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <Kpi etiqueta="Simulacros" valor={String(n)} />
                <Kpi etiqueta="Promedio general" valor={`${promedio}%`} />
                <Kpi etiqueta="Aprobados" valor={`${aprobados}/${n}`} />
                <Kpi etiqueta="Última actividad" valor={fechaCorta(intentos![n - 1].fecha)} chico />
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-bold text-foreground">Evolución del puntaje</p>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  {n} simulacros · {fechaCorta(intentos![0].fecha)} – {fechaCorta(intentos![n - 1].fecha)}
                </p>
                <GraficoLinea intentos={intentos!} />
              </div>

              {temas.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-bold text-foreground">Temas con más dificultad</p>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Precisión acumulada por tema (mín. 5 preguntas vistas), de peor a mejor
                  </p>
                  <GraficoBarras temas={temas} />
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-bold text-foreground">Últimos intentos</p>
                <p className="mb-1 text-[11px] text-muted-foreground">Los {Math.min(8, n)} más recientes</p>
                <div className="flex flex-col">
                  {recientes.map((it, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[88px_1fr_44px_52px] items-center gap-2.5 border-t border-border/60 py-2 text-xs first:border-t-0"
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">{fechaHora(it.fecha)}</span>
                      <span className="truncate text-muted-foreground">{it.capitulos.length === 0 ? 'Examen completo' : it.capitulos.join(', ')}</span>
                      <span className="text-right font-mono font-bold text-foreground">{it.porcentaje}%</span>
                      <span className="text-right font-mono text-[11px] text-muted-foreground">{fmtTiempo(it.tiempoUsadoSeg)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Kpi({ etiqueta, valor, chico }: { etiqueta: string; valor: string; chico?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className={`font-mono font-extrabold text-foreground ${chico ? 'text-sm' : 'text-xl'}`}>{valor}</div>
      <div className="mt-0.5 text-[11px] font-semibold leading-snug text-muted-foreground">{etiqueta}</div>
    </div>
  )
}

// Line chart a mano en SVG — sin librería de gráficos (ver
// claude/panel-revision-admin.md sobre por qué: solo dos tipos de gráfico
// acá, control total del tema claro/oscuro con los mismos tokens de color
// (stroke="currentColor" + clases de texto), y evita otro `npm install` por
// el bridge remote-devices. Crosshair + tooltip al pasar el mouse.
function GraficoLinea({ intentos }: { intentos: Intento[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const w = 480
  const h = 160
  const padL = 30
  const padR = 8
  const padT = 10
  const padB = 22
  const n = intentos.length
  const maxY = Math.max(20, Math.ceil(Math.max(...intentos.map((it) => it.porcentaje)) / 10) * 10)
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (w - padL - padR))
  const y = (v: number) => h - padB - (v / maxY) * (h - padT - padB)

  const linePoints = intentos.map((it, i) => `${x(i)},${y(it.porcentaje)}`).join(' ')
  const areaPoints = `${x(0)},${y(0)} ${linePoints} ${x(n - 1)},${y(0)}`
  const gridTicks = [0, maxY / 2, maxY]

  function alMover(e: ReactPointerEvent<SVGRectElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * w
    let mejor = 0
    let mejorDist = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - px)
      if (d < mejorDist) {
        mejorDist = d
        mejor = i
      }
    }
    setHoverIdx(mejor)
  }

  const activo = hoverIdx !== null ? intentos[hoverIdx] : null
  const activoX = hoverIdx !== null ? x(hoverIdx) : 0
  const tooltipALaDerecha = activoX / w > 0.7

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block overflow-visible">
        {gridTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        <polygon points={areaPoints} className="fill-accent/10" />
        <polyline points={linePoints} fill="none" className="stroke-accent" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <text x={padL} y={h - 4} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>
          {fechaCorta(intentos[0].fecha)}
        </text>
        <text x={w - padR} y={h - 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
          {fechaCorta(intentos[n - 1].fecha)}
        </text>
        {activo && (
          <>
            <line x1={activoX} x2={activoX} y1={padT} y2={h - padB} className="stroke-muted-foreground" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={activoX} cy={y(activo.porcentaje)} r={5} className="fill-accent stroke-background" strokeWidth={2} />
          </>
        )}
        <rect
          x={padL}
          y={padT}
          width={w - padL - padR}
          height={h - padT - padB}
          fill="transparent"
          onPointerMove={alMover}
          onPointerLeave={() => setHoverIdx(null)}
        />
      </svg>
      {activo && (
        <div
          className="pointer-events-none absolute rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: tooltipALaDerecha ? undefined : `calc(${(activoX / w) * 100}% + 10px)`,
            right: tooltipALaDerecha ? `calc(${100 - (activoX / w) * 100}% + 10px)` : undefined,
            top: `${(y(activo.porcentaje) / h) * 100}%`,
          }}
        >
          <div className="font-mono text-sm font-bold text-foreground">
            {activo.porcentaje}% · {activo.correctas}/{activo.totalPreguntas}
          </div>
          <div className="text-[11px] text-muted-foreground">{fechaHora(activo.fecha)}</div>
        </div>
      )}
    </div>
  )
}

function GraficoBarras({ temas }: { temas: TemaResumen[] }) {
  const max = Math.max(...temas.map((t) => t.pct), 10)
  return (
    <div className="flex flex-col">
      {temas.slice(0, 8).map((t) => (
        <div key={t.tema} className="py-1">
          <div className="grid grid-cols-[128px_1fr_38px] items-center gap-2.5">
            <span className="truncate text-xs font-semibold text-foreground" title={t.tema}>
              {t.tema}
            </span>
            <span className="relative h-4 overflow-hidden rounded bg-muted">
              <span className="absolute inset-y-0 left-0 rounded bg-accent" style={{ width: `${Math.max(4, (t.pct / max) * 100)}%` }} />
            </span>
            <span className="text-right font-mono text-[11px] text-muted-foreground">{t.pct}%</span>
          </div>
          <div className="pl-[138px] text-[10.5px] text-muted-foreground">
            {t.correctas}/{t.total} preguntas vistas
          </div>
        </div>
      ))}
    </div>
  )
}
