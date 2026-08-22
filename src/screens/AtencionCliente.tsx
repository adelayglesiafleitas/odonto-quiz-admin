import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Inbox, CheckCheck, Flag, Loader2 } from 'lucide-react'
import { actualizarEstadoFeedback, type EstadoFeedback, type FeedbackItem } from '@/lib/feedbackAdmin'

interface Props {
  feedback: FeedbackItem[]
  cargando: boolean
  correosPorId: Map<string, string>
  adminId: string
  onRecargar: () => void
}

const ETIQUETA_ESTADO: Record<EstadoFeedback, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
}

const ESTILO_ESTADO: Record<EstadoFeedback, string> = {
  pendiente: 'bg-destructive/10 text-destructive',
  en_revision: 'bg-info/10 text-info',
  resuelto: 'bg-success/10 text-success',
  descartado: 'bg-muted text-muted-foreground',
}

const ETIQUETA_MOTIVO: Record<string, string> = {
  respuesta_incorrecta: 'Respuesta incorrecta',
  opcion_ambigua_o_duplicada: 'Opción ambigua o duplicada',
  texto_con_error: 'Texto con error',
  otro: 'Otro',
}

const formatoFechaHora = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function haceCuanto(fecha: string): string {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

const selectBase =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function AtencionCliente({ feedback, cargando, correosPorId, adminId, onRecargar }: Props) {
  const [saltados, setSaltados] = useState<Set<string>>(new Set())
  const [procesando, setProcesando] = useState<string | null>(null)

  const cola = useMemo(
    () =>
      feedback
        .filter((f) => (f.estado === 'pendiente' || f.estado === 'en_revision') && !saltados.has(f.id))
        .sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime()),
    [feedback, saltados],
  )
  const actual = cola[0] ?? null

  async function manejarAccion(id: string, accion: 'revision' | 'resuelto' | 'descartado' | 'siguiente') {
    if (procesando) return
    if (accion !== 'siguiente') {
      setProcesando(id)
      const estado: EstadoFeedback = accion === 'revision' ? 'en_revision' : accion
      await actualizarEstadoFeedback(id, estado, adminId)
      setProcesando(null)
      onRecargar()
    }
    setSaltados((prev) => new Set(prev).add(id))
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!actual || procesando) return
      if (e.key === '1') manejarAccion(actual.id, 'revision')
      else if (e.key === '2') manejarAccion(actual.id, 'resuelto')
      else if (e.key === '3') manejarAccion(actual.id, 'descartado')
      else if (e.key === 'ArrowRight') manejarAccion(actual.id, 'siguiente')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, procesando])

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Atención al cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cola de triage sobre <code className="rounded bg-muted px-1 py-0.5">feedback</code> — un reporte a la vez, resolvés con el
          teclado.
        </p>
      </div>

      <p className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Cola pendiente</p>

      {cargando ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : actual ? (
        <div className="rounded-[18px] border border-border bg-card p-5 md:p-6">
          <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {actual.origen === 'pregunta' ? (
                <>
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                    Pregunta N.º {actual.preguntaNumero}
                  </span>
                  {actual.capitulo && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                      {actual.capitulo}
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">App</span>
              )}
              {actual.tipo && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">
                  {ETIQUETA_MOTIVO[actual.tipo] ?? actual.tipo}
                </span>
              )}
            </div>
            <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
              {cola.length - 1} más en la cola
            </span>
          </div>

          {actual.preguntaTexto && (
            <p className="mb-2.5 text-[1.02rem] font-bold leading-snug text-foreground text-balance">{actual.preguntaTexto}</p>
          )}
          {actual.comentario && (
            <p className="mb-4 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
              &ldquo;{actual.comentario}&rdquo;
            </p>
          )}
          <p className="mb-5 text-xs text-muted-foreground">
            Reportó <span className="font-mono">{correosPorId.get(actual.reportadoPor) ?? 'usuario desconocido'}</span> ·{' '}
            {haceCuanto(actual.creadoEn)}
          </p>

          <div className="flex flex-wrap gap-2">
            <BotonAccion
              disabled={procesando === actual.id}
              onClick={() => manejarAccion(actual.id, 'revision')}
              atajo="1"
              hoverClase="hover:border-info hover:text-info"
            >
              En revisión
            </BotonAccion>
            <BotonAccion
              disabled={procesando === actual.id}
              onClick={() => manejarAccion(actual.id, 'resuelto')}
              atajo="2"
              claseExtra="border-success bg-success text-success-foreground hover:bg-success/90"
            >
              Resuelto
            </BotonAccion>
            <BotonAccion
              disabled={procesando === actual.id}
              onClick={() => manejarAccion(actual.id, 'descartado')}
              atajo="3"
              hoverClase="hover:border-destructive hover:text-destructive"
            >
              Descartado
            </BotonAccion>
            <BotonAccion
              disabled={procesando === actual.id}
              onClick={() => manejarAccion(actual.id, 'siguiente')}
              atajo="→"
              claseExtra="ml-auto border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Siguiente
            </BotonAccion>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-14 text-center text-muted-foreground">
          <CheckCheck className="h-9 w-9 text-muted-foreground/60" />
          <p className="font-bold text-foreground">Cola al día</p>
          <p className="max-w-xs text-sm">No quedan reportes pendientes de revisión.</p>
        </div>
      )}

      {actual && (
        <p className="my-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            Atajos: <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">1</kbd> en revisión
          </span>
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">2</kbd> resuelto
          </span>
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">3</kbd> descartado
          </span>
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">→</kbd> siguiente
          </span>
        </p>
      )}

      <HistorialReportes feedback={feedback} correosPorId={correosPorId} cargando={cargando} />
    </section>
  )
}

function BotonAccion({
  children,
  onClick,
  disabled,
  atajo,
  claseExtra,
  hoverClase,
}: {
  children: ReactNode
  onClick: () => void
  disabled: boolean
  atajo: string
  claseExtra?: string
  hoverClase?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-bold text-foreground transition-transform hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50 ${hoverClase ?? ''} ${claseExtra ?? ''}`}
    >
      <kbd className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.72rem]">{atajo}</kbd>
      {children}
    </button>
  )
}

type FiltroEstado = 'todos' | EstadoFeedback
type FiltroOrigen = 'todos' | 'pregunta' | 'app'

function HistorialReportes({
  feedback,
  correosPorId,
  cargando,
}: {
  feedback: FeedbackItem[]
  correosPorId: Map<string, string>
  cargando: boolean
}) {
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [origen, setOrigen] = useState<FiltroOrigen>('todos')
  const [capitulo, setCapitulo] = useState('todos')
  const [rango, setRango] = useState(30)

  const capitulos = useMemo(
    () => [...new Set(feedback.map((f) => f.capitulo).filter((c): c is string => !!c))].sort(),
    [feedback],
  )

  const filtrados = useMemo(() => {
    const limite = rango === 0 ? null : Date.now() - rango * 24 * 60 * 60 * 1000
    return feedback
      .filter((f) => estado === 'todos' || f.estado === estado)
      .filter((f) => origen === 'todos' || f.origen === origen)
      .filter((f) => capitulo === 'todos' || f.capitulo === capitulo)
      .filter((f) => limite === null || new Date(f.creadoEn).getTime() >= limite)
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
  }, [feedback, estado, origen, capitulo, rango])

  const hayFiltros = estado !== 'todos' || origen !== 'todos' || capitulo !== 'todos' || rango !== 30

  return (
    <>
      <p className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Todos los reportes</p>

      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <select value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)} className={selectBase}>
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_revision">En revisión</option>
          <option value="resuelto">Resuelto</option>
          <option value="descartado">Descartado</option>
        </select>
        <select value={origen} onChange={(e) => setOrigen(e.target.value as FiltroOrigen)} className={selectBase}>
          <option value="todos">Origen: todos</option>
          <option value="pregunta">Pregunta</option>
          <option value="app">App</option>
        </select>
        <select value={capitulo} onChange={(e) => setCapitulo(e.target.value)} className={selectBase}>
          <option value="todos">Capítulo: todos</option>
          {capitulos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={rango} onChange={(e) => setRango(Number(e.target.value))} className={selectBase}>
          <option value={30}>Últimos 30 días</option>
          <option value={7}>Últimos 7 días</option>
          <option value={0}>Todo</option>
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setEstado('todos')
              setOrigen('todos')
              setCapitulo('todos')
              setRango(30)
            }}
            className="text-sm font-bold text-accent hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        {cargando ? 'Cargando…' : hayFiltros ? `${filtrados.length} de ${feedback.length} reportes` : `${feedback.length} reportes`}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">Reportó</th>
                <th className="whitespace-nowrap px-4 py-3">Origen</th>
                <th className="whitespace-nowrap px-4 py-3">Pregunta</th>
                <th className="whitespace-nowrap px-4 py-3">Motivo</th>
                <th className="whitespace-nowrap px-4 py-3">Estado</th>
                <th className="whitespace-nowrap px-4 py-3">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {feedback.length === 0 ? (
                      <span className="flex flex-col items-center gap-2">
                        <Inbox className="h-6 w-6 text-muted-foreground/60" />
                        Todavía no llegó ningún reporte.
                      </span>
                    ) : (
                      'Ningún reporte coincide con estos filtros.'
                    )}
                  </td>
                </tr>
              ) : (
                filtrados.map((f) => (
                  <tr key={f.id} className="border-b border-border/70 text-sm last:border-b-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono">{correosPorId.get(f.reportadoPor) ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {f.origen === 'pregunta' ? (
                        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">Pregunta</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">App</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {f.origen === 'pregunta' ? `N.º ${f.preguntaNumero} · ${f.capitulo ?? '—'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">{f.tipo ? (ETIQUETA_MOTIVO[f.tipo] ?? f.tipo) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${ESTILO_ESTADO[f.estado]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                        {ETIQUETA_ESTADO[f.estado]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">
                      {formatoFechaHora.format(new Date(f.resueltoEn ?? f.creadoEn))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 flex max-w-[62ch] items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Cada fila es una lectura directa de <code className="mx-1 rounded bg-muted px-1 py-0.5">feedback</code> — marcar un reporte
        como resuelto o descartado registra quién lo cerró y cuándo (
        <code className="mx-1 rounded bg-muted px-1 py-0.5">resuelto_por</code>,{' '}
        <code className="mx-1 rounded bg-muted px-1 py-0.5">resuelto_en</code>), sin lógica extra.
      </p>
    </>
  )
}
