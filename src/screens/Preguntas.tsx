import { useCallback, useEffect, useState } from 'react'
import { Search, BookOpen, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  listarPreguntas,
  listarAsignaturas,
  listarCapitulos,
  obtenerEstadisticas,
  type Pregunta,
  type EstadisticasPreguntas,
} from '@/lib/preguntas'
import { EditarPreguntaModal } from '@/components/EditarPreguntaModal'

const POR_PAGINA = 50

const inputBase =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// Banco de preguntas: reemplaza los JSON estáticos (src/data/*.json en la
// app del cliente) por la tabla `preguntas` de Supabase, editable acá sin
// tocar código. Ver claude/panel-revision-admin.md.
//
// A diferencia de Usuarios/AtencionCliente (que cargan todo una vez en
// Panel.tsx), acá cada página se pide al servidor con `.range()` — Ortodoncia
// sola tiene más de 17 mil preguntas, traerlas todas al navegador de una vez
// sería justo lo que el proyecto pidió evitar ("óptimo", "no debe cargarme
// mucho"). Este filtro/paginado es del panel admin, no afecta cómo el cliente
// carga un examen.
export function Preguntas() {
  const [asignaturas, setAsignaturas] = useState<string[]>([])
  const [asignatura, setAsignatura] = useState<string>('')
  const [capitulos, setCapitulos] = useState<string[]>([])
  const [capitulo, setCapitulo] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)

  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  const [stats, setStats] = useState<EstadisticasPreguntas | null>(null)

  const [preguntaAbiertaId, setPreguntaAbiertaId] = useState<string | null>(null)

  useEffect(() => {
    listarAsignaturas().then((lista) => {
      setAsignaturas(lista)
      if (lista.length > 0) setAsignatura((prev) => prev || lista[0])
    })
    obtenerEstadisticas().then(setStats)
  }, [])

  useEffect(() => {
    if (!asignatura) {
      setCapitulos([])
      return
    }
    listarCapitulos(asignatura).then(setCapitulos)
    setCapitulo('')
  }, [asignatura])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { preguntas: filas, total: totalFilas } = await listarPreguntas({
      asignatura: asignatura || null,
      capitulo: capitulo || null,
      busqueda,
      pagina,
      porPagina: POR_PAGINA,
    })
    setPreguntas(filas)
    setTotal(totalFilas)
    setCargando(false)
  }, [asignatura, capitulo, busqueda, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Buscar o cambiar de filtro siempre vuelve a la primera página — evita
  // quedar en una página vacía si el nuevo filtro tiene menos resultados.
  useEffect(() => {
    setPagina(0)
  }, [asignatura, capitulo, busqueda])

  const desde = total === 0 ? 0 : pagina * POR_PAGINA + 1
  const hasta = Math.min(total, (pagina + 1) * POR_PAGINA)
  const hayFiltros = busqueda.trim() !== '' || capitulo !== ''

  function alGuardar() {
    cargar()
    obtenerEstadisticas().then(setStats)
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Preguntas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Banco de preguntas del examen — datos en vivo desde Supabase.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard etiqueta="Total preguntas" valor={stats?.total} />
        <StatCard etiqueta="Asignaturas" valor={stats?.totalAsignaturas} />
        <StatCard etiqueta="Editadas (7 días)" valor={stats?.editadasUltimos7Dias} tono="text-accent" />
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <select value={asignatura} onChange={(e) => setAsignatura(e.target.value)} className={inputBase}>
          {asignaturas.length === 0 && <option value="">Sin asignaturas cargadas</option>}
          {asignaturas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={capitulo} onChange={(e) => setCapitulo(e.target.value)} className={inputBase} disabled={capitulos.length === 0}>
          <option value="">Capítulo: todos</option>
          {capitulos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número o texto"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('')
              setCapitulo('')
            }}
            className="text-sm font-bold text-accent hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        {cargando ? 'Cargando…' : total === 0 ? '0 preguntas' : `${desde}–${hasta} de ${total} preguntas`}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">N.º</th>
                <th className="whitespace-nowrap px-4 py-3">Pregunta</th>
                <th className="whitespace-nowrap px-4 py-3">Capítulo</th>
                <th className="whitespace-nowrap px-4 py-3">Opciones</th>
                <th className="whitespace-nowrap px-4 py-3">Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : preguntas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <span className="flex flex-col items-center gap-2">
                      <BookOpen className="h-6 w-6 text-muted-foreground/60" />
                      Ninguna pregunta coincide con estos filtros.
                    </span>
                  </td>
                </tr>
              ) : (
                preguntas.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setPreguntaAbiertaId(p.id)}
                    className="cursor-pointer border-b border-border/70 text-sm last:border-b-0 hover:bg-muted/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{p.numero}</td>
                    <td className="max-w-[420px] px-4 py-3">
                      <span className="line-clamp-1 font-semibold text-foreground">{p.pregunta}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{p.capitulo ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{p.opciones.length}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.actualizadoEn ? new Date(p.actualizadoEn).toLocaleDateString('es') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Clic en cualquier fila para editarla.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={pagina === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPagina((p) => (hasta < total ? p + 1 : p))}
              disabled={hasta >= total}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {total <= POR_PAGINA && <p className="mt-4 text-xs text-muted-foreground">Clic en cualquier fila para editarla.</p>}

      {preguntaAbiertaId && (
        <EditarPreguntaModal preguntaId={preguntaAbiertaId} onClose={() => setPreguntaAbiertaId(null)} onGuardado={alGuardar} />
      )}
    </section>
  )
}

function StatCard({ etiqueta, valor, tono }: { etiqueta: string; valor: number | undefined; tono?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className={`font-mono text-2xl font-extrabold tabular-nums ${tono ?? 'text-foreground'}`}>
        {valor === undefined ? '—' : valor}
      </div>
      <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{etiqueta}</div>
    </div>
  )
}
