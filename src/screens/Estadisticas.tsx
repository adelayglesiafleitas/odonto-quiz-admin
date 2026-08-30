import { useEffect, useState } from 'react'
import {
  Activity,
  Moon,
  ClipboardList,
  PieChart,
  Clock,
  ListTree,
  Compass,
  Filter,
  LifeBuoy,
  Megaphone,
  TrendingUp,
  Wrench,
  Loader2,
  Image as ImageIcon,
  Video,
  FileText,
} from 'lucide-react'
import { obtenerEstadisticas, type EstadisticasApp, type PuntoSerie, type RankingItem } from '@/lib/estadisticas'
import type { Usuario } from '@/lib/usuarios'
import type { Ticket } from '@/lib/tickets'

const formatoFecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' })
function fmtDia(iso: string): string {
  return formatoFecha.format(new Date(`${iso}T00:00:00`))
}

interface Props {
  usuarios: Usuario[]
  cargandoUsuarios: boolean
  tickets: Ticket[]
  cargandoTickets: boolean
}

/**
 * Pantalla "Estadísticas": uso e interacción de la app, agregado entre todos
 * los usuarios (ver claude/estadisticas-admin-diseno.md). Doce widgets
 * agrupados en 6 bloques, mismo orden y numeración que el mockup aprobado.
 * Todo el cálculo vive en lib/estadisticas.ts — este archivo solo pinta.
 */
export function Estadisticas({ usuarios, cargandoUsuarios, tickets, cargandoTickets }: Props) {
  const [datos, setDatos] = useState<EstadisticasApp | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (cargandoUsuarios || cargandoTickets) return
    let cancelado = false
    setCargando(true)
    obtenerEstadisticas(usuarios, tickets).then((d) => {
      if (!cancelado) {
        setDatos(d)
        setCargando(false)
      }
    })
    return () => {
      cancelado = true
    }
  }, [usuarios, tickets, cargandoUsuarios, cargandoTickets])

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Estadísticas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Uso e interacción de la app — datos en vivo desde Supabase.</p>
      </div>

      {cargando || !datos ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando estadísticas…
        </div>
      ) : (
        <>
          <Eyebrow icono={Activity} n={1} titulo="Actividad" />
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Widget n={1} icono={Activity} titulo="Usuarios activos (DAU / WAU / MAU)" sub="Última actividad por dispositivo — sale de dispositivos_activos.ultimo_uso.">
              <div className="mt-1 grid grid-cols-3 gap-2.5">
                <StatMini valor={datos.actividad.hoy} etiqueta="Hoy" />
                <StatMini valor={datos.actividad.semana} etiqueta="Esta semana" />
                <StatMini valor={datos.actividad.mes} etiqueta="Este mes" />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">Usuarios con al menos un intento por día (últimos 30 días):</p>
              <SerieLinea puntos={datos.actividad.serieIntentosPorUsuario} altura={110} />
            </Widget>

            <Widget n={2} icono={Moon} titulo="Usuarios dormidos" sub="No usaron un dispositivo hace 7+ días — doble uso: métrica y lista para mandarles un mensaje.">
              {datos.dormidos.length === 0 ? (
                <VacioMini texto="Nadie está inactivo por ahora." />
              ) : (
                <div className="mt-1 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Usuario</th>
                        <th className="px-3 py-2">Últ. uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.dormidos.slice(0, 5).map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="truncate px-3 py-2 font-semibold text-foreground">{u.nickname || u.email}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {u.diasInactivo === null ? 'nunca' : `hace ${u.diasInactivo} días`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {datos.dormidos.length > 5 && (
                    <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                      +{datos.dormidos.length - 5} más
                    </p>
                  )}
                </div>
              )}
            </Widget>
          </div>

          <Widget n={3} icono={ClipboardList} titulo="Intentos de simulacro por día" sub="Últimos 14 días — sale de historial_intentos.fecha." className="mt-3.5">
            <BarrasDia puntos={datos.intentosPorDia} />
          </Widget>

          <Eyebrow icono={PieChart} n={4} titulo="Desempeño y contenido" />
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            <Widget n={4} icono={PieChart} titulo="Aprobados vs. desaprobados" sub="Global, todos los intentos.">
              {datos.aprobacion.total === 0 ? (
                <VacioMini texto="Todavía no hay intentos registrados." />
              ) : (
                <div className="mt-2 flex items-center gap-4">
                  <Donut pct={datos.aprobacion.pctAprobados} />
                  <div className="space-y-1.5">
                    <Leyenda color="bg-accent" texto={`${datos.aprobacion.pctAprobados}% aprobados`} />
                    <Leyenda color="bg-muted" texto={`${100 - datos.aprobacion.pctAprobados}% desaprobados`} muted />
                  </div>
                </div>
              )}
            </Widget>

            <Widget n={4} icono={Filter} titulo="Materia más / menos practicada" sub="% de intentos por asignatura.">
              {datos.materias.length === 0 ? <VacioMini texto="Sin intentos todavía." /> : <Ranking items={datos.materias} />}
            </Widget>

            <Widget n={5} icono={Clock} titulo="Agotan el tiempo" sub="De los intentos con límite de tiempo.">
              <div className="flex flex-1 flex-col items-center justify-center py-2">
                <div className="font-mono text-3xl font-extrabold text-destructive">{datos.tiempoAgotado.pct}%</div>
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  {datos.tiempoAgotado.agotados} de {datos.tiempoAgotado.conTiempo} agotó el tiempo
                </p>
              </div>
            </Widget>
          </div>

          <Widget n={6} icono={ListTree} titulo="Capítulos con más fallos (global)" sub="Agregado entre todos los usuarios — uso editorial: qué reforzar en el banco de preguntas." className="mt-3.5">
            {datos.capitulosMasFallos.length === 0 ? (
              <VacioMini texto="Todavía no hay suficientes intentos con desglose por capítulo." />
            ) : (
              <Ranking items={datos.capitulosMasFallos} danger />
            )}
          </Widget>

          <Eyebrow icono={Compass} n={7} titulo="Onboarding" />
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Widget n={7} icono={Compass} titulo="Completaron el tour de bienvenida" sub="Sale de perfiles.vio_tour_bienvenida.">
              <div className="mt-2 flex items-center gap-4">
                <Donut pct={datos.onboarding.pct} />
                <div>
                  <div className="font-mono text-2xl font-extrabold text-foreground">{datos.onboarding.pct}%</div>
                  <p className="text-[11px] text-muted-foreground">
                    {datos.onboarding.vieron} de {datos.onboarding.total} usuarios
                  </p>
                </div>
              </div>
            </Widget>

            <Widget n={8} icono={TrendingUp} titulo="Embudo de activación" sub="Registro → tour → primer simulacro.">
              <div className="mt-1 space-y-2">
                <Funnel etiqueta="Registrados" valor={datos.embudo.registrados} base={datos.embudo.registrados} />
                <Funnel etiqueta="Vio el tour" valor={datos.embudo.vioTour} base={datos.embudo.registrados} />
                <Funnel etiqueta="1er simulacro" valor={datos.embudo.primerSimulacro} base={datos.embudo.registrados} />
              </div>
            </Widget>
          </div>

          <Eyebrow icono={LifeBuoy} n={9} titulo="Soporte y mensajes" />
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Widget n={9} icono={LifeBuoy} titulo="Panel de soporte agregado" sub="Sale de tickets / mensajes.">
              <div className="mt-1 grid grid-cols-3 gap-2.5">
                <StatMini valor={datos.soporte.abiertos} etiqueta="Abiertos" />
                <StatMini valor={datos.soporte.resueltos} etiqueta="Resueltos" />
                <StatMini
                  valor={datos.soporte.promedioRespuestaHoras ?? '—'}
                  etiqueta="1ra respuesta"
                  sufijo={datos.soporte.promedioRespuestaHoras !== null ? 'h' : undefined}
                />
              </div>
              {datos.soporte.porMotivo.length > 0 && (
                <div className="mt-3">
                  <Ranking items={datos.soporte.porMotivo} />
                </div>
              )}
            </Widget>

            <Widget n={10} icono={Megaphone} titulo="Alcance de tus mensajes" sub="Sale de mensajes_admin_descartados.">
              {datos.alcanceMensajes.length === 0 ? (
                <VacioMini texto="Todavía no mandaste ningún mensaje." />
              ) : (
                <div className="mt-1 space-y-2.5">
                  {datos.alcanceMensajes.slice(0, 4).map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {m.tipo === 'video' ? <Video className="h-3.5 w-3.5" /> : m.tipo === 'texto_foto' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground" title={m.resumen}>
                        {m.resumen}
                      </span>
                      <span className="relative h-2 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-accent"
                          style={{ width: `${m.audiencia > 0 ? Math.min(100, Math.round((m.vistos / m.audiencia) * 100)) : 0}%` }}
                        />
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                        {m.vistos}/{m.audiencia}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Widget>
          </div>

          <Eyebrow icono={TrendingUp} n={11} titulo="Crecimiento" />
          <Widget n={11} icono={TrendingUp} titulo="Usuarios nuevos (acumulado)" sub="Últimas 10 semanas.">
            <SerieLinea puntos={datos.crecimiento} altura={110} />
          </Widget>

          <Eyebrow icono={Wrench} n={12} titulo="Por instrumentar" />
          <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-border p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Wrench className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Duración de sesión / eventos de login</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No sale de ninguna tabla actual — necesitaría una tabla nueva de eventos para medirlo con precisión.
              </p>
              <span className="mt-1.5 inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive">
                Requiere instrumentación nueva
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function Eyebrow({ icono: Icono, n, titulo }: { icono: typeof Activity; n: number; titulo: string }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-2 first:mt-0">
      <NumBadge n={n} />
      <Icono className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function NumBadge({ n }: { n: number }) {
  return (
    <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md bg-accent/15 text-[10.5px] font-extrabold text-accent">
      {n}
    </span>
  )
}

function Widget({
  n,
  icono: Icono,
  titulo,
  sub,
  children,
  className = '',
}: {
  n: number
  icono: typeof Activity
  titulo: string
  sub: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col rounded-2xl border border-border bg-card p-4 ${className}`}>
      <div className="flex items-start gap-2.5">
        <NumBadge n={n} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[13.5px] font-bold text-foreground">{titulo}</p>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="mt-2.5 flex-1">{children}</div>
    </div>
  )
}

function StatMini({ valor, etiqueta, sufijo }: { valor: number | string; etiqueta: string; sufijo?: string }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2.5">
      <div className="font-mono text-lg font-extrabold tabular-nums text-foreground">
        {valor}
        {sufijo && <span className="text-xs font-bold text-muted-foreground">{sufijo}</span>}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{etiqueta}</div>
    </div>
  )
}

function VacioMini({ texto }: { texto: string }) {
  return <p className="flex flex-1 items-center justify-center py-6 text-center text-xs text-muted-foreground">{texto}</p>
}

function Leyenda({ color, texto, muted }: { color: string; texto: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className={`text-xs font-bold ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{texto}</span>
    </div>
  )
}

function Donut({ pct }: { pct: number }) {
  const circ = 2 * Math.PI * 15.9
  return (
    <svg width="72" height="72" viewBox="0 0 42 42" className="shrink-0">
      <circle cx="21" cy="21" r="15.9" fill="transparent" className="stroke-muted" strokeWidth="6" />
      <circle
        cx="21"
        cy="21"
        r="15.9"
        fill="transparent"
        className="stroke-accent"
        strokeWidth="6"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
    </svg>
  )
}

function Funnel({ etiqueta, valor, base }: { etiqueta: string; valor: number; base: number }) {
  const pct = base > 0 ? Math.round((valor / base) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[92px] shrink-0 text-[11px] font-bold text-muted-foreground">{etiqueta}</span>
      <div className="h-6 flex-1 overflow-hidden rounded-lg bg-muted">
        <div
          className="flex h-full items-center rounded-lg bg-accent px-2.5 text-[11px] font-extrabold text-accent-foreground"
          style={{ width: `${Math.max(pct, valor > 0 ? 14 : 0)}%` }}
        >
          {valor}
        </div>
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] font-bold text-muted-foreground">{pct}%</span>
    </div>
  )
}

function Ranking({ items, danger = false }: { items: RankingItem[]; danger?: boolean }) {
  const max = Math.max(...items.map((it) => it.pct), 1)
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <div key={it.clave} className="grid grid-cols-[110px_1fr_32px] items-center gap-2">
          <span className="truncate text-[11.5px] font-semibold text-foreground" title={it.nombre}>
            {it.nombre}
          </span>
          <span className="relative h-3.5 overflow-hidden rounded bg-muted">
            <span
              className={`absolute inset-y-0 left-0 rounded ${danger ? 'bg-destructive' : 'bg-accent'}`}
              style={{ width: `${Math.max(4, (it.pct / max) * 100)}%` }}
            />
          </span>
          <span className="text-right font-mono text-[10.5px] text-muted-foreground">{it.pct}%</span>
        </div>
      ))}
    </div>
  )
}

function SerieLinea({ puntos, altura }: { puntos: PuntoSerie[]; altura: number }) {
  const w = 460
  const h = altura
  const padL = 26
  const padR = 6
  const padT = 8
  const padB = 18
  const n = puntos.length
  if (n === 0) return <VacioMini texto="Sin datos todavía." />
  const maxY = Math.max(4, Math.ceil(Math.max(...puntos.map((p) => p.valor)) * 1.15))
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (w - padL - padR))
  const y = (v: number) => h - padB - (v / maxY) * (h - padT - padB)
  const linePoints = puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')
  const areaPoints = `${x(0)},${y(0)} ${linePoints} ${x(n - 1)},${y(0)}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block overflow-visible">
      <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth={1} />
      <line x1={padL} x2={w - padR} y1={y(maxY / 2)} y2={y(maxY / 2)} className="stroke-border" strokeWidth={1} />
      <line x1={padL} x2={w - padR} y1={y(maxY)} y2={y(maxY)} className="stroke-border" strokeWidth={1} />
      <text x={padL - 5} y={y(0) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>0</text>
      <text x={padL - 5} y={y(maxY / 2) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{Math.round(maxY / 2)}</text>
      <text x={padL - 5} y={y(maxY) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{Math.round(maxY)}</text>
      <polygon points={areaPoints} className="fill-accent/10" />
      <polyline points={linePoints} fill="none" className="stroke-accent" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <text x={padL} y={h - 4} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={9}>
        {/^S\d+$/.test(puntos[0].fecha) ? puntos[0].fecha : fmtDia(puntos[0].fecha)}
      </text>
      <text x={w - padR} y={h - 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
        {/^S\d+$/.test(puntos[n - 1].fecha) ? puntos[n - 1].fecha : fmtDia(puntos[n - 1].fecha)}
      </text>
    </svg>
  )
}

function BarrasDia({ puntos }: { puntos: PuntoSerie[] }) {
  const w = 900
  const h = 100
  const padB = 18
  const n = puntos.length
  const maxY = Math.max(4, Math.max(...puntos.map((p) => p.valor)))
  const gap = 8
  const barW = (w - gap * (n - 1)) / n
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block overflow-visible">
      <line x1={0} x2={w} y1={h - padB} y2={h - padB} className="stroke-border" strokeWidth={1} />
      {puntos.map((p, i) => {
        const barH = (p.valor / maxY) * (h - padB - 6)
        return (
          <rect
            key={p.fecha}
            x={i * (barW + gap)}
            y={h - padB - barH}
            width={barW}
            height={Math.max(barH, p.valor > 0 ? 2 : 0)}
            rx={4}
            className="fill-accent"
          />
        )
      })}
      <text x={0} y={h - 4} className="fill-muted-foreground font-mono" fontSize={9}>{fmtDia(puntos[0].fecha)}</text>
      <text x={w} y={h - 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{fmtDia(puntos[n - 1].fecha)}</text>
    </svg>
  )
}
