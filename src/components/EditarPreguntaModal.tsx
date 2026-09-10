import { useEffect, useState } from 'react'
import { Loader2, Pencil, TriangleAlert, X } from 'lucide-react'
import {
  obtenerPregunta,
  buscarPreguntaPorAsignaturaYNumero,
  actualizarPregunta,
  detectarAnomalias,
  type Pregunta,
  type Opcion,
} from '@/lib/preguntas'

// Modal de edición de una pregunta — reutilizado desde dos lugares:
// Preguntas.tsx (clic en una fila de la lista) y AtencionCliente.tsx (botón
// "Editar esta pregunta" dentro de un ticket). Por eso se le puede pasar el
// id directo, o la asignatura+número que trae el ticket (ver
// buscarPreguntaPorAsignaturaYNumero en lib/preguntas.ts).
//
// Pensado para que lo use una doctora sin conocimientos de programación: el
// texto (enunciado y cada opción) se edita escribiendo directo en su propio
// recuadro con ícono de lápiz, y cuál opción es la correcta se marca aparte
// con el punto de selección — son dos acciones separadas y las dos están
// siempre visibles, nunca hay que "activar" un modo edición.
interface Props {
  preguntaId?: string
  asignatura?: string
  numero?: number
  onClose: () => void
  onGuardado?: () => void
}

export function EditarPreguntaModal({ preguntaId, asignatura, numero, onClose, onGuardado }: Props) {
  const [cargando, setCargando] = useState(true)
  const [noEncontrada, setNoEncontrada] = useState(false)
  const [original, setOriginal] = useState<Pregunta | null>(null)
  const [enunciado, setEnunciado] = useState('')
  const [opciones, setOpciones] = useState<Opcion[]>([])
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setNoEncontrada(false)
      const pregunta = preguntaId
        ? await obtenerPregunta(preguntaId)
        : asignatura && numero != null
          ? await buscarPreguntaPorAsignaturaYNumero(asignatura, numero)
          : null
      if (cancelado) return
      if (!pregunta) {
        setNoEncontrada(true)
        setCargando(false)
        return
      }
      setOriginal(pregunta)
      setEnunciado(pregunta.pregunta)
      setOpciones(pregunta.opciones)
      setCargando(false)
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [preguntaId, asignatura, numero])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onClose])

  const avisos = original ? detectarAnomalias({ opciones }) : []
  const huboCambios =
    original != null && (enunciado !== original.pregunta || JSON.stringify(opciones) !== JSON.stringify(original.opciones))

  function cambiarTextoOpcion(letra: string, texto: string) {
    setOpciones((prev) => prev.map((o) => (o.letra === letra ? { ...o, texto } : o)))
  }

  function marcarCorrecta(letra: string) {
    setOpciones((prev) => prev.map((o) => ({ ...o, correcta: o.letra === letra })))
  }

  async function guardar() {
    if (!original || guardando) return
    setGuardando(true)
    setError(null)
    const { ok, error: mensaje } = await actualizarPregunta(original.id, { pregunta: enunciado, opciones })
    setGuardando(false)
    if (!ok) {
      setError(mensaje ?? 'No se pudo guardar. Probá de nuevo.')
      return
    }
    setGuardado(true)
    onGuardado?.()
    setTimeout(onClose, 900)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-pregunta-titulo"
        className="flex max-h-[88vh] w-full max-w-2xl animate-float-up flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 id="editar-pregunta-titulo" className="text-[15.5px] font-extrabold text-foreground">
              Editar pregunta
            </h2>
            {original && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                N.º {original.numero} · {original.asignatura}
                {original.capitulo ? ` · ${original.capitulo}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cargando ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : noEncontrada ? (
            <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              No se encontró esta pregunta en el banco de preguntas.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-foreground/80">
                Escribí directo sobre el texto para corregirlo. Para cambiar cuál es la respuesta correcta, marcá el
                punto junto a la opción — son dos cosas separadas, las dos siempre disponibles.
              </p>

              {avisos.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-l-4 border-l-destructive bg-destructive/10 px-3.5 py-3">
                  {avisos.map((aviso, i) => (
                    <p key={i} className="flex items-start gap-2 text-xs font-semibold text-destructive">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {aviso}
                    </p>
                  ))}
                </div>
              )}

              <CampoEditable etiqueta="Enunciado" valor={enunciado} onChange={setEnunciado} filas={3} />

              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Opciones de respuesta</p>
                {opciones.map((o) => (
                  <div key={o.letra} className="flex items-start gap-3">
                    <label className="mt-3 flex shrink-0 cursor-pointer items-center gap-2" title="Marcar como correcta">
                      <input
                        type="radio"
                        name="correcta"
                        checked={o.correcta}
                        onChange={() => marcarCorrecta(o.letra)}
                        className="h-4 w-4 accent-success"
                      />
                    </label>
                    <div className="flex-1">
                      <CampoEditable
                        etiqueta={`Opción ${o.letra}${o.correcta ? ' — correcta' : ''}`}
                        valor={o.texto}
                        onChange={(v) => cambiarTextoOpcion(o.letra, v)}
                        filas={2}
                        resaltarCorrecta={o.correcta}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!cargando && !noEncontrada && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">
              {error ? (
                <span className="font-semibold text-destructive">{error}</span>
              ) : guardado ? (
                <span className="font-semibold text-success">Guardado.</span>
              ) : huboCambios ? (
                'Hay cambios sin guardar.'
              ) : (
                ' '
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-muted px-4 py-2 text-sm font-bold text-foreground hover:bg-muted/70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={!huboCambios || guardando || guardado}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CampoEditable({
  etiqueta,
  valor,
  onChange,
  filas,
  resaltarCorrecta,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  filas: number
  resaltarCorrecta?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Pencil className="h-3 w-3" />
        {etiqueta}
      </span>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={filas}
        className={`w-full resize-y rounded-xl border border-dashed px-3.5 py-2.5 text-sm leading-relaxed text-foreground transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          resaltarCorrecta ? 'border-success/50 bg-success/[0.04]' : 'border-border bg-background'
        }`}
      />
    </label>
  )
}
