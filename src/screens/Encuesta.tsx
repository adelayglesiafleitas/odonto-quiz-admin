// src/screens/Encuesta.tsx
//
// ENCUESTA-TEMPORAL — Pantalla de resultados de la encuesta "Ayúdanos a
// mejorar". Diseño aprobado en claude/encuesta-feedback-diseno.md (canvas
// "Encuesta Ayúdanos a mejorar", fila de admin). Mismos átomos visuales que
// Estadisticas.tsx (tarjetas bg-card, cifras en mono, gráficos a mano), sin
// librerías nuevas. Para quitarla: ver cabecera de lib/encuesta.ts.

import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, RotateCcw, Search } from 'lucide-react'
import type { Usuario } from '@/lib/usuarios'
import { formatoUltimoAcceso } from '@/lib/fechas'
import {
  CAMPANIA_ACTUAL,
  descargarCsvEncuesta,
  repetirEncuesta,
  ETIQUETA_CANAL,
  grupoNota,
  listarRespuestasEncuesta,
  resumirEncuesta,
  type GrupoNota,
  type RespuestaEncuesta,
} from '@/lib/encuesta'

type FiltroNota = 'todas' | GrupoNota
type FiltroPend = 'todos' | 'sin' | 'medias'

const COLOR_GRUPO: Record<GrupoNota, { barra: string; texto: string; chip: string }> = {
  det: { barra: 'bg-destructive', texto: 'text-destructive', chip: 'bg-destructive/15 text-destructive' },
  pas: { barra: 'bg-muted-foreground/60', texto: 'text-muted-foreground', chip: 'bg-muted text-muted-foreground' },
  pro: { barra: 'bg-success', texto: 'text-success', chip: 'bg-success/15 text-success' },
}

export function Encuesta({
  usuarios,
  cargandoUsuarios,
  miPropioId,
}: {
  usuarios: Usuario[]
  cargandoUsuarios: boolean
  miPropioId: string
}) {
  const [filas, setFilas] = useState<RespuestaEncuesta[] | null>(null)
  const [campania, setCampania] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroNota>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [pend, setPend] = useState<FiltroPend>('todos')
  const [filtroLista, setFiltroLista] = useState<EstadoFila | 'todos'>('todos')
  const [ultimaCarga, setUltimaCarga] = useState<Date | null>(null)

  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    listarRespuestasEncuesta().then((datos) => {
      if (cancelado) return
      setFilas(datos)
      setUltimaCarga(new Date())
    })
    return () => {
      cancelado = true
    }
  }, [recarga])

  // Se refresca sola cada 30 s mientras la pantalla está abierta, para ver
  // a la gente "ir haciéndola" sin recargar.
  useEffect(() => {
    const id = setInterval(() => setRecarga((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const campanias = useMemo(() => [...new Set((filas ?? []).map((f) => f.campania))].sort().reverse(), [filas])
  const campaniaActiva = campania ?? campanias[0] ?? null
  const deCampania = useMemo(() => (filas ?? []).filter((f) => f.campania === campaniaActiva), [filas, campaniaActiva])
  const r = useMemo(() => resumirEncuesta(deCampania), [deCampania])
  const nombrePorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nickname?.trim() || u.email] as const)), [usuarios])
  const nombre = (id: string) => nombrePorId.get(id) ?? 'Usuario eliminado'

  const q = busqueda.trim().toLowerCase()
  const pasaFiltro = (f: RespuestaEncuesta, texto: string | null) =>
    Boolean(texto && texto.trim()) &&
    (filtro === 'todas' || (f.nps !== null && grupoNota(f.nps) === filtro)) &&
    (!q || (texto ?? '').toLowerCase().includes(q))
  const funciones = deCampania.filter((f) => pasaFiltro(f, f.funcion))
  const cambios = deCampania
    .filter((f) => pasaFiltro(f, f.cambio))
    // Los de nota baja primero: ahí suele estar lo que hay que arreglar.
    .sort((a, b) => (a.nps ?? 11) - (b.nps ?? 11))
  const pendientes = pend === 'sin' ? r.sinEmpezar : pend === 'medias' ? r.aMedias : [...r.sinEmpezar, ...r.aMedias]
  const pendientesOrdenados = [...pendientes].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  const maxBarra = Math.max(1, ...r.distribucion)

  const cargando = filas === null || cargandoUsuarios
  // Lo más reciente arriba (por última actividad, no por cuándo la vio).
  const listaFiltrada = (filtroLista === 'todos' ? deCampania : deCampania.filter((f) => estadoDe(f).id === filtroLista))
    .slice()
    .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn))

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Encuesta</h1>
          <p className="mt-1 text-sm text-muted-foreground">«Ayúdanos a mejorar» · respuestas de los usuarios de la app</p>
        </div>
        {campaniaActiva && (
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              Campaña
              <select
                value={campaniaActiva}
                onChange={(e) => setCampania(e.target.value)}
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground"
              >
                {campanias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => descargarCsvEncuesta(deCampania, nombrePorId, campaniaActiva)}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-border bg-card px-3.5 text-sm font-bold text-foreground transition hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        )}
      </div>

      {!cargando && (
        <ProbarEncuesta
          usuarios={usuarios}
          miPropioId={miPropioId}
          filas={filas ?? []}
          onRepetida={() => setRecarga((n) => n + 1)}
        />
      )}

      {cargando ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando encuesta…
        </div>
      ) : deCampania.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Sin respuestas todavía. La encuesta aparece en la Home de la app a quien ya ha hecho al menos un simulacro.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra etiqueta="Respuestas" valor={String(r.completadas)} sufijo={` / ${r.mostradas}`} nota="Completadas / personas a las que se mostró" />
            <Cifra etiqueta="Tasa de respuesta" valor={r.tasa === null ? '—' : String(r.tasa)} sufijo={r.tasa === null ? '' : ' %'} nota="De quienes la vieron, cuántos la terminaron" />
            <Cifra
              etiqueta="Nota media"
              valor={r.media === null ? '—' : r.media.toFixed(1).replace('.', ',')}
              sufijo={r.media === null ? '' : ' / 10'}
              nota={`${r.conNota} ${r.conNota === 1 ? 'persona puso' : 'personas pusieron'} nota`}
            />
            <Cifra
              etiqueta="NPS"
              valor={r.nps === null ? '—' : `${r.nps > 0 ? '+' : ''}${r.nps}`}
              nota={`% de 9–10 (${r.pctPro} %) menos % de 0–6 (${r.pctDet} %)`}
              color={r.nps === null ? '' : r.nps >= 0 ? 'text-success' : 'text-destructive'}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-bold text-foreground">Quién la va haciendo</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {deCampania.length} {deCampania.length === 1 ? 'persona' : 'personas'} · lo más reciente arriba · se actualiza sola cada 30 s
                  {ultimaCarga && ` (última: ${ultimaCarga.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecarga((n) => n + 1)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-bold text-foreground transition hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Actualizar
              </button>
            </div>
            <div className="mt-3">
              <Pastillas
                valor={filtroLista}
                onCambiar={setFiltroLista}
                opciones={[
                  ['todos', `Todos · ${deCampania.length}`],
                  ['completada', `Completada · ${contarEstado(deCampania, 'completada')}`],
                  ['respondiendo', `Respondiendo ahora · ${contarEstado(deCampania, 'respondiendo')}`],
                  ['medias', `A medias · ${contarEstado(deCampania, 'medias')}`],
                  ['sin', `Sin empezar · ${contarEstado(deCampania, 'sin')}`],
                ]}
              />
            </div>
            {listaFiltrada.length === 0 ? (
              <Vacio texto="Nadie en este grupo" />
            ) : (
              <div className="mt-2 flex flex-col">
                <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(10.5rem,1fr)_minmax(0,0.45fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,0.8fr)] gap-3 border-b border-border py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground lg:grid">
                  <span>Usuario</span>
                  <span>Estado</span>
                  <span>Nota</span>
                  <span>Canales</span>
                  <span>Función</span>
                  <span>Cambio</span>
                  <span>Actividad</span>
                </div>
                {listaFiltrada.map((f) => {
                  const e = estadoDe(f)
                  const act = formatoUltimoAcceso(f.actualizadaEn)
                  return (
                    <div
                      key={f.userId}
                      className="flex flex-col gap-1 border-b border-border py-2.5 text-[13px] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(10.5rem,1fr)_minmax(0,0.45fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,0.8fr)] lg:items-start lg:gap-3"
                    >
                      <span className="truncate font-bold text-foreground">{nombre(f.userId)}</span>
                      <span>
                        <span
                          title={e.detalle}
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${e.clase}`}
                        >
                          {e.id === 'respondiendo' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                          {e.etiqueta}
                        </span>
                      </span>
                      <span className={`font-mono font-bold ${f.nps === null ? 'text-muted-foreground' : COLOR_GRUPO[grupoNota(f.nps)].texto}`}>
                        <Etiqueta texto="Nota" />
                        {f.nps ?? '—'}
                      </span>
                      <span className={f.canales.length ? 'text-foreground' : 'hidden text-muted-foreground lg:block'}>
                        <Etiqueta texto="Canales" />
                        {f.canales.map((c) => ETIQUETA_CANAL[c] ?? c).join(', ') || '—'}
                      </span>
                      {/* En móvil, las respuestas vacías no ocupan una línea con "—". */}
                      <span className={f.funcion ? 'text-foreground' : 'hidden text-muted-foreground lg:block'}>
                        <Etiqueta texto="Función" />
                        {f.funcion || '—'}
                      </span>
                      <span className={f.cambio ? 'text-foreground' : 'hidden text-muted-foreground lg:block'}>
                        <Etiqueta texto="Cambio" />
                        {f.cambio || '—'}
                      </span>
                      <span className="text-muted-foreground" title={act.full}>
                        <Etiqueta texto="Actividad" />
                        {act.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Tarjeta titulo="Distribución de la nota (0–10)" sub="Cuántas personas eligieron cada nota">
              <div className="grid h-44 grid-cols-11 items-end gap-1 sm:gap-2">
                {r.distribucion.map((n, v) => (
                  <div key={v} className="flex flex-col items-center gap-1">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">{n}</span>
                    <span
                      className={`w-full rounded-t-md rounded-b-sm ${COLOR_GRUPO[grupoNota(v)].barra}`}
                      style={{ height: `${Math.max(4, Math.round((n / maxBarra) * 120))}px` }}
                    />
                    <span className="font-mono text-xs font-bold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-foreground">
                <Leyenda color="bg-destructive" texto={`0–6 · ${r.pctDet} %`} />
                <Leyenda color="bg-muted-foreground/60" texto={`7–8 · ${r.pctPas} %`} />
                <Leyenda color="bg-success" texto={`9–10 · ${r.pctPro} %`} />
              </div>
            </Tarjeta>

            <Tarjeta titulo="¿Cómo nos conocieron?" sub={`% sobre ${r.personasCanal} personas · se podían marcar varias opciones`}>
              {r.canales.length === 0 ? (
                <Vacio texto="Nadie ha llegado todavía a esta pregunta" />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {r.canales.map((c) => (
                    <div key={c.id} className="grid grid-cols-[9.5rem_minmax(0,1fr)_4.5rem] items-center gap-2.5 text-[13px]">
                      <span className="truncate font-bold text-foreground">{c.etiqueta}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
                      </span>
                      <span className="text-right font-mono text-xs font-semibold text-muted-foreground">
                        {c.pct} % · {c.n}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {r.otros.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Textos de «Otro»</p>
                  <p className="mt-1 text-[13px] text-foreground">{r.otros.map((t) => `«${t}»`).join(' · ')}</p>
                </div>
              )}
            </Tarjeta>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en los comentarios"
                aria-label="Buscar en los comentarios"
                className="h-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </label>
            <Pastillas
              valor={filtro}
              onCambiar={setFiltro}
              opciones={[
                ['todas', 'Todas'],
                ['det', '0–6'],
                ['pas', '7–8'],
                ['pro', '9–10'],
              ]}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Tarjeta titulo="¿Qué función añadirían?" sub={`${funciones.length} comentarios · con la nota de quien lo escribió`}>
              <ListaComentarios filas={funciones} texto={(f) => f.funcion} nombre={nombre} />
            </Tarjeta>
            <Tarjeta titulo="¿Qué cambiarían?" sub={`${cambios.length} comentarios · primero los de nota más baja`}>
              <ListaComentarios filas={cambios} texto={(f) => f.cambio} nombre={nombre} />
            </Tarjeta>
          </div>

          <Tarjeta
            titulo="La vieron y no la terminaron"
            sub={`${r.sinEmpezar.length + r.aMedias.length} de ${r.mostradas} personas · no se les vuelve a mostrar`}
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Grupo n={r.sinEmpezar.length} titulo="Sin empezar" nota="Cerraron antes de poner nota" />
              <Grupo n={r.aMedias.length} titulo="A medias" nota="Respondieron algo; lo contestado ya cuenta" />
            </div>
            <div className="mt-3">
              <Pastillas
                valor={pend}
                onCambiar={setPend}
                opciones={[
                  ['todos', 'Todos'],
                  ['sin', 'Sin empezar'],
                  ['medias', 'A medias'],
                ]}
              />
            </div>
            {pendientesOrdenados.length === 0 ? (
              <Vacio texto="Nadie en este grupo" />
            ) : (
              <div className="mt-2 flex flex-col">
                <div className="hidden grid-cols-[1.3fr_1.2fr_0.9fr_1fr] gap-3 border-b border-border py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Usuario</span>
                  <span>Llegó hasta</span>
                  <span>Cuándo la vio</span>
                  <span>Cómo salió</span>
                </div>
                {pendientesOrdenados.map((f) => {
                  const cuando = formatoUltimoAcceso(f.creadaEn)
                  return (
                    <div
                      key={f.userId}
                      className="flex flex-col gap-1 border-b border-border py-2.5 text-[13px] md:grid md:grid-cols-[1.3fr_1.2fr_0.9fr_1fr] md:items-center md:gap-3"
                    >
                      <span className="truncate font-bold text-foreground">{nombre(f.userId)}</span>
                      <span className="text-foreground">{f.ultimoPaso === 0 ? 'No empezó' : `Respondió hasta la pregunta ${f.ultimoPaso}`}</span>
                      <span className="text-muted-foreground" title={cuando.full}>
                        {cuando.label}
                      </span>
                      <span>
                        <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-extrabold text-muted-foreground">
                          {f.cerradaConX ? 'Cerrada con la ✕' : 'Salió de la app'}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Tarjeta>

        </div>
      )}
    </section>
  )
}

// Estado de cada fila para la lista "Quién la va haciendo". "Respondiendo
// ahora" = sin terminar, sin cerrar con la ✕ y con actividad en los últimos
// 15 min (la ventana sigue abierta o la acaba de dejar).
type EstadoFila = 'completada' | 'respondiendo' | 'medias' | 'sin'
const MIN_RESPONDIENDO = 15

function estadoDe(f: RespuestaEncuesta): { id: EstadoFila; etiqueta: string; clase: string; detalle: string } {
  if (f.completada) return { id: 'completada', etiqueta: 'Completada', clase: 'bg-success/15 text-success', detalle: 'Llegó hasta el final' }
  const reciente = Date.now() - new Date(f.actualizadaEn).getTime() < MIN_RESPONDIENDO * 60_000
  if (!f.cerradaConX && reciente)
    return { id: 'respondiendo', etiqueta: `Respondiendo · ${f.ultimoPaso}/4`, clase: 'bg-info/15 text-info', detalle: 'Actividad en los últimos 15 min' }
  const salida = f.cerradaConX ? 'Cerrada con la ✕' : 'Salió de la app'
  if (f.ultimoPaso > 0) return { id: 'medias', etiqueta: `A medias · ${f.ultimoPaso}/4`, clase: 'bg-accent/15 text-accent', detalle: salida }
  return { id: 'sin', etiqueta: 'Sin empezar', clase: 'bg-muted text-muted-foreground', detalle: salida }
}

const contarEstado = (filas: RespuestaEncuesta[], id: EstadoFila) => filas.filter((f) => estadoDe(f).id === id).length

// "Probar la encuesta": borra la fila de un usuario (por defecto, el propio
// admin) en la campaña actual para que la app se la vuelva a mostrar.
// Confirmación en línea en dos pasos, porque borra lo que haya contestado.
function ProbarEncuesta({
  usuarios,
  miPropioId,
  filas,
  onRepetida,
}: {
  usuarios: Usuario[]
  miPropioId: string
  filas: RespuestaEncuesta[]
  onRepetida: () => void
}) {
  const [elegido, setElegido] = useState(miPropioId)
  const [confirmando, setConfirmando] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'borrando' | 'ok' | 'error'>('idle')

  const opciones = [...usuarios].sort((a, b) =>
    a.id === miPropioId ? -1 : b.id === miPropioId ? 1 : (a.nickname || a.email).localeCompare(b.nickname || b.email),
  )
  const fila = filas.find((f) => f.userId === elegido && f.campania === CAMPANIA_ACTUAL)
  const situacion = !fila
    ? 'Todavía no la ha visto: le saldrá si cumple las condiciones.'
    : fila.completada
      ? 'Ya la completó.'
      : fila.ultimoPaso === 0
        ? 'La vio y la cerró sin empezar.'
        : `La dejó a medias (respondió hasta la pregunta ${fila.ultimoPaso}).`

  const cambiar = (id: string) => {
    setElegido(id)
    setConfirmando(false)
    setEstado('idle')
  }

  const repetir = async () => {
    setEstado('borrando')
    const ok = await repetirEncuesta(elegido)
    setConfirmando(false)
    setEstado(ok ? 'ok' : 'error')
    if (ok) onRepetida()
  }

  return (
    <div className="mb-4 rounded-2xl border border-dashed border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-foreground">
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Probar la encuesta
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Borra la respuesta de un usuario en la campaña {CAMPANIA_ACTUAL} para que le vuelva a salir.
          </p>
        </div>
        <select
          value={elegido}
          onChange={(e) => cambiar(e.target.value)}
          aria-label="Usuario"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground sm:max-w-xs sm:flex-none"
        >
          {opciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === miPropioId ? `Tú (${u.nickname || u.email})` : u.nickname || u.email}
            </option>
          ))}
        </select>
        {!confirmando ? (
          <button
            type="button"
            disabled={!fila || estado === 'borrando'}
            onClick={() => setConfirmando(true)}
            className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Repetir encuesta
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-10 rounded-xl border border-border px-3.5 text-sm font-bold text-foreground transition hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={repetir}
              disabled={estado === 'borrando'}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-destructive px-3.5 text-sm font-bold text-destructive-foreground transition disabled:opacity-60"
            >
              {estado === 'borrando' && <Loader2 className="h-4 w-4 animate-spin" />}
              Sí, borrar su respuesta
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-foreground">{situacion}</p>
      {estado === 'ok' && (
        <p className="mt-1.5 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success">
          Listo. Le saldrá de nuevo la próxima vez que entre en la Home de la app (recarga la app si ya estaba abierta).
        </p>
      )}
      {estado === 'error' && (
        <p className="mt-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          No se pudo borrar. Inténtalo de nuevo.
        </p>
      )}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Solo aparece a quien ya vio el tour de bienvenida, ha hecho al menos un simulacro y no tiene mensajes nuevos del admin.
      </p>
    </div>
  )
}

// Etiqueta visible solo cuando la tabla pasa a filas apiladas (móvil/tablet).
function Etiqueta({ texto }: { texto: string }) {
  return <span className="mr-1 font-sans text-[11px] font-bold uppercase tracking-wide text-muted-foreground lg:hidden">{texto}:</span>
}

function Cifra({ etiqueta, valor, sufijo, nota, color = '' }: { etiqueta: string; valor: string; sufijo?: string; nota: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{etiqueta}</span>
      <span className={`font-mono text-2xl font-extrabold tabular-nums ${color || 'text-foreground'}`}>
        {valor}
        {sufijo && <span className="text-sm font-bold text-muted-foreground">{sufijo}</span>}
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground">{nota}</span>
    </div>
  )
}

function Tarjeta({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <p className="text-[13.5px] font-bold text-foreground">{titulo}</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
      {children}
    </div>
  )
}

function Grupo({ n, titulo, nota }: { n: number; titulo: string; nota: string }) {
  return (
    <div className="rounded-xl bg-background px-3.5 py-3">
      <div className="font-mono text-xl font-extrabold tabular-nums text-foreground">{n}</div>
      <div className="text-[13px] font-bold text-foreground">{titulo}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{nota}</div>
    </div>
  )
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {texto}
    </span>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{texto}</p>
}

function Pastillas<T extends string>({ valor, onCambiar, opciones }: { valor: T; onCambiar: (v: T) => void; opciones: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(([id, etiqueta]) => {
        const sel = valor === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={sel}
            onClick={() => onCambiar(id)}
            className={`h-9 rounded-full border px-3 text-[12.5px] font-bold transition ${
              sel ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}

function ListaComentarios({
  filas,
  texto,
  nombre,
}: {
  filas: RespuestaEncuesta[]
  texto: (f: RespuestaEncuesta) => string | null
  nombre: (id: string) => string
}) {
  if (filas.length === 0) return <Vacio texto="Ningún comentario con este filtro" />
  return (
    <div className="flex flex-col">
      {filas.map((f) => (
        <div key={f.userId} className="flex items-start gap-3 border-t border-border py-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold ${
              f.nps === null ? 'bg-muted text-muted-foreground' : COLOR_GRUPO[grupoNota(f.nps)].chip
            }`}
          >
            {f.nps ?? '—'}
          </span>
          <div className="min-w-0">
            <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed text-foreground">{texto(f)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {nombre(f.userId)} · {formatoUltimoAcceso(f.actualizadaEn).label}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
