// src/screens/Mensajes.tsx
//
// Comunicados que el admin manda a todos los usuarios o a uno puntual,
// mostrados en Home de la app cliente (ver mensajesAdminRemoto.ts y
// MensajeAdminBanner.tsx/MensajeAdminVideo.tsx en odonto-quiz-proyecto-react).
// Mismos patrones visuales que Usuarios.tsx: StatCard, tabla, menú `⋮`
// posicionado con getBoundingClientRect, y modal de confirmación por tono
// (accent = reversible, destructive = irreversible).

import { useEffect, useMemo, useRef, useState, type ReactNode, type ChangeEvent } from 'react'
import {
  Megaphone,
  Plus,
  Image as ImageIcon,
  Video,
  FileText,
  EllipsisVertical,
  Loader2,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Usuario } from '@/lib/usuarios'
import {
  listarMensajes,
  crearMensaje,
  cambiarActivoMensaje,
  eliminarMensaje,
  type MensajeAdmin,
  type TipoMensajeAdmin,
} from '@/lib/mensajesAdmin'

const formatoFecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
function fmt(fecha: string): string {
  return formatoFecha.format(new Date(fecha))
}

type TipoConfirmacion = 'desactivar' | 'reactivar' | 'eliminar'
interface Confirmacion {
  tipo: TipoConfirmacion
  mensaje: MensajeAdmin
}

interface ConfigConfirmacion {
  variant: 'destructive' | 'accent'
  icono: typeof Trash2
  titulo: string
  descripcion: ReactNode
  nota: string
  botonLabel: string
  botonCargando: string
}

function configPara(confirmacion: Confirmacion): ConfigConfirmacion {
  const { tipo } = confirmacion
  switch (tipo) {
    case 'desactivar':
      return {
        variant: 'accent',
        icono: Pause,
        titulo: '¿Desactivar este mensaje?',
        descripcion: 'Deja de aparecerle a quien todavía no lo haya visto. A quien ya lo tenga abierto en pantalla en este momento no se lo cierra.',
        nota: 'Podés reactivarlo cuando quieras desde este mismo menú.',
        botonLabel: 'Desactivar',
        botonCargando: 'Guardando…',
      }
    case 'reactivar':
      return {
        variant: 'accent',
        icono: Play,
        titulo: '¿Reactivar este mensaje?',
        descripcion: 'Vuelve a aparecerle a cualquier destinatario que todavía no lo haya cerrado.',
        nota: 'Podés desactivarlo de nuevo cuando quieras.',
        botonLabel: 'Reactivar',
        botonCargando: 'Guardando…',
      }
    case 'eliminar':
      return {
        variant: 'destructive',
        icono: Trash2,
        titulo: '¿Eliminar este mensaje?',
        descripcion: 'Se borra para siempre, incluso para quien todavía no lo vio.',
        nota: 'Esta acción no se puede deshacer.',
        botonLabel: 'Eliminar mensaje',
        botonCargando: 'Eliminando…',
      }
  }
}

function TipoBadge({ tipo }: { tipo: TipoMensajeAdmin }) {
  if (tipo === 'video') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground"><Video className="h-3 w-3" />Video</span>
  if (tipo === 'texto_foto') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground"><ImageIcon className="h-3 w-3" />Texto + foto</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground"><FileText className="h-3 w-3" />Texto</span>
}

function DestinatarioBadge({ mensaje, correosPorId }: { mensaje: MensajeAdmin; correosPorId: Map<string, string> }) {
  if (!mensaje.destinatarioUserId) {
    return <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">Todos</span>
  }
  const correo = correosPorId.get(mensaje.destinatarioUserId) ?? mensaje.destinatarioUserId
  return <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-bold text-muted-foreground">{correo}</span>
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">Activo</span>
  ) : (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Inactivo</span>
  )
}

function MenuItem({
  icono: Icono,
  etiqueta,
  onClick,
  danger,
}: {
  icono: typeof Trash2
  etiqueta: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-muted'
      }`}
    >
      <Icono className="h-4 w-4 shrink-0" />
      {etiqueta}
    </button>
  )
}

export function Mensajes({ usuarios, cargandoUsuarios }: { usuarios: Usuario[]; cargandoUsuarios: boolean }) {
  const [mensajes, setMensajes] = useState<MensajeAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [compositorAbierto, setCompositorAbierto] = useState(false)

  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const recargar = async () => {
    setCargando(true)
    setMensajes(await listarMensajes())
    setCargando(false)
  }

  useEffect(() => {
    recargar()
  }, [])

  useEffect(() => {
    if (!menuAbiertoId) return
    function cerrar(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbiertoId(null)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuAbiertoId])

  const correosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u.email] as const)), [usuarios])

  const stats = useMemo(
    () => ({
      activos: mensajes.filter((m) => m.activo).length,
      videos: mensajes.filter((m) => m.activo && m.tipo === 'video').length,
      paraUno: mensajes.filter((m) => m.destinatarioUserId !== null).length,
      total: mensajes.length,
    }),
    [mensajes],
  )

  function abrirMenu(m: MensajeAdmin, boton: HTMLButtonElement) {
    if (menuAbiertoId === m.id) {
      setMenuAbiertoId(null)
      return
    }
    const r = boton.getBoundingClientRect()
    const anchoMenu = 220
    let left = r.right - anchoMenu
    if (left < 8) left = 8
    setMenuPos({ top: r.bottom + 6, left })
    setMenuAbiertoId(m.id)
  }

  function pedirConfirmacion(tipo: TipoConfirmacion, mensaje: MensajeAdmin) {
    setMenuAbiertoId(null)
    setErrorAccion(null)
    setConfirmacion({ tipo, mensaje })
  }

  async function confirmar() {
    if (!confirmacion) return
    const { tipo, mensaje } = confirmacion
    setConfirmando(true)
    setProcesandoId(mensaje.id)

    const resultado =
      tipo === 'desactivar'
        ? await cambiarActivoMensaje(mensaje.id, false)
        : tipo === 'reactivar'
          ? await cambiarActivoMensaje(mensaje.id, true)
          : await eliminarMensaje(mensaje.id)

    setConfirmando(false)
    setProcesandoId(null)
    setConfirmacion(null)

    if (resultado.ok) {
      recargar()
    } else {
      setErrorAccion('No se pudo completar la acción. Probá de nuevo en un momento.')
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Mensajes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comunicados que ven los usuarios en Home — para todos o para un usuario puntual.</p>
        </div>
        <Button type="button" onClick={() => setCompositorAbierto(true)}>
          <Plus className="h-4 w-4" />
          Nuevo mensaje
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard etiqueta="Activos ahora" valor={stats.activos} cargando={cargando} />
        <StatCard etiqueta="Total enviados" valor={stats.total} cargando={cargando} />
        <StatCard etiqueta="Videos activos" valor={stats.videos} cargando={cargando} />
        <StatCard etiqueta="Para un usuario puntual" valor={stats.paraUno} cargando={cargando} />
      </div>

      {errorAccion && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorAccion}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">Mensaje</th>
                <th className="whitespace-nowrap px-4 py-3">Destinatario</th>
                <th className="whitespace-nowrap px-4 py-3">Enviado</th>
                <th className="whitespace-nowrap px-4 py-3">Estado</th>
                <th className="whitespace-nowrap px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : mensajes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Todavía no se mandó ningún mensaje.
                  </td>
                </tr>
              ) : (
                mensajes.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-border/70 text-sm last:border-b-0 hover:bg-muted/50 ${menuAbiertoId === m.id ? 'bg-muted/50' : ''}`}
                  >
                    <td className="max-w-[320px] px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        {m.mediaUrl && m.tipo !== 'texto' ? (
                          <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
                            {m.tipo === 'video' ? (
                              <video src={m.mediaUrl} className="h-full w-full object-cover" muted />
                            ) : (
                              <img src={m.mediaUrl} alt="" className="h-full w-full object-cover" />
                            )}
                            {m.tipo === 'video' && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white drop-shadow">▶</span>
                            )}
                          </div>
                        ) : (
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Megaphone className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <TipoBadge tipo={m.tipo} />
                          {m.texto && <p className="mt-0.5 line-clamp-2 text-foreground">{m.texto}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><DestinatarioBadge mensaje={m} correosPorId={correosPorId} /></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{fmt(m.creadoEn)}</td>
                    <td className="whitespace-nowrap px-4 py-3"><EstadoBadge activo={m.activo} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {procesandoId === m.id ? (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => abrirMenu(m, e.currentTarget)}
                          aria-haspopup="true"
                          aria-expanded={menuAbiertoId === m.id}
                          aria-label="Acciones"
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <EllipsisVertical className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 flex max-w-[70ch] items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Fuente: tabla <code className="mx-1 rounded bg-muted px-1 py-0.5">mensajes_admin</code>. Un mensaje "Inactivo" deja de mostrarse a quien
        todavía no lo vio; a quien ya lo cerró no le vuelve a aparecer nunca, esté activo o no (registrado en{' '}
        <code className="mx-1 rounded bg-muted px-1 py-0.5">mensajes_admin_descartados</code>). Fotos y videos se guardan en el bucket público{' '}
        <code className="mx-1 rounded bg-muted px-1 py-0.5">mensajes-media</code>.
      </p>

      {menuAbiertoId && menuPos && (() => {
        const m = mensajes.find((x) => x.id === menuAbiertoId)
        if (!m) return null
        return (
          <div ref={menuRef} style={{ top: menuPos.top, left: menuPos.left }} className="fixed z-40 w-56 animate-float-up rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
            {m.activo ? (
              <MenuItem icono={Pause} etiqueta="Desactivar" onClick={() => pedirConfirmacion('desactivar', m)} />
            ) : (
              <MenuItem icono={Play} etiqueta="Reactivar" onClick={() => pedirConfirmacion('reactivar', m)} />
            )}
            <div className="my-1 h-px bg-border" />
            <MenuItem icono={Trash2} etiqueta="Eliminar" danger onClick={() => pedirConfirmacion('eliminar', m)} />
          </div>
        )
      })()}

      {confirmacion && (
        <ModalConfirmacion confirmacion={confirmacion} cargando={confirmando} onCancelar={() => setConfirmacion(null)} onConfirmar={confirmar} />
      )}

      {compositorAbierto && (
        <ModalNuevoMensaje
          usuarios={usuarios}
          cargandoUsuarios={cargandoUsuarios}
          onCerrar={() => setCompositorAbierto(false)}
          onCreado={() => {
            setCompositorAbierto(false)
            recargar()
          }}
        />
      )}
    </section>
  )
}

function StatCard({ etiqueta, valor, cargando }: { etiqueta: string; valor: number; cargando: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="font-mono text-2xl font-extrabold tabular-nums text-foreground">{cargando ? '—' : valor}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{etiqueta}</div>
    </div>
  )
}

function ModalConfirmacion({
  confirmacion,
  cargando,
  onCancelar,
  onConfirmar,
}: {
  confirmacion: Confirmacion
  cargando: boolean
  onCancelar: () => void
  onConfirmar: () => void
}) {
  const cfg = configPara(confirmacion)
  const Icono = cfg.icono
  const colorIcono = cfg.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-accent'
  const colorNota = cfg.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'
  const NotaIcono = cfg.variant === 'destructive' ? TriangleAlert : Info

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !cargando) onCancelar() }}>
      <div role="alertdialog" aria-modal="true" className="flex w-full max-w-sm animate-float-up flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${colorIcono}`}>
          <Icono className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-foreground">{cfg.titulo}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cfg.descripcion}</p>
        </div>
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${colorNota}`}>
          <NotaIcono className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{cfg.nota}</span>
        </div>
        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onCancelar} disabled={cargando}>Cancelar</Button>
          <Button type="button" variant={cfg.variant} onClick={onConfirmar} disabled={cargando}>
            {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
            {cargando ? cfg.botonCargando : cfg.botonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

const segmentBase = 'flex-1 rounded-lg px-3 py-2 text-xs font-bold transition'
const segmentActivo = 'bg-primary text-primary-foreground'
const segmentInactivo = 'text-muted-foreground hover:bg-muted'

function ModalNuevoMensaje({
  usuarios,
  cargandoUsuarios,
  onCerrar,
  onCreado,
}: {
  usuarios: Usuario[]
  cargandoUsuarios: boolean
  onCerrar: () => void
  onCreado: () => void
}) {
  const [tipo, setTipo] = useState<TipoMensajeAdmin>('texto')
  const [destinatario, setDestinatario] = useState<'todos' | 'uno'>('todos')
  const [destinatarioUserId, setDestinatarioUserId] = useState('')
  const [texto, setTexto] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [confirmandoTodos, setConfirmandoTodos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setMediaFile(archivo)
    setPreviewUrl(URL.createObjectURL(archivo))
  }

  const necesitaTexto = tipo === 'texto' || tipo === 'texto_foto'
  const necesitaMedia = tipo === 'texto_foto' || tipo === 'video'
  const puedeEnviar =
    (!necesitaTexto || texto.trim().length > 0) &&
    (!necesitaMedia || mediaFile !== null) &&
    (destinatario === 'todos' || destinatarioUserId !== '')

  async function enviar() {
    setEnviando(true)
    setError(null)
    const resultado = await crearMensaje({
      tipo,
      texto: necesitaTexto ? texto.trim() : null,
      mediaFile: necesitaMedia ? mediaFile : null,
      destinatarioUserId: destinatario === 'todos' ? null : destinatarioUserId,
    })
    setEnviando(false)
    if (resultado.ok) {
      onCreado()
    } else {
      setError(resultado.error ?? 'No se pudo enviar el mensaje.')
      setConfirmandoTodos(false)
    }
  }

  function onClickEnviar() {
    if (destinatario === 'todos' && !confirmandoTodos) {
      setConfirmandoTodos(true)
      return
    }
    enviar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onCerrar() }}>
      <div className="flex max-h-[88vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Nuevo mensaje</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Va a aparecer en Home de la app.</p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo de mensaje</label>
          <div className="mt-1.5 flex gap-1 rounded-xl border border-border bg-background p-1">
            <button type="button" className={`${segmentBase} ${tipo === 'texto' ? segmentActivo : segmentInactivo}`} onClick={() => setTipo('texto')}>Texto</button>
            <button type="button" className={`${segmentBase} ${tipo === 'texto_foto' ? segmentActivo : segmentInactivo}`} onClick={() => setTipo('texto_foto')}>Texto + foto</button>
            <button type="button" className={`${segmentBase} ${tipo === 'video' ? segmentActivo : segmentInactivo}`} onClick={() => setTipo('video')}>Video</button>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Destinatario</label>
          <div className="mt-1.5 flex gap-1 rounded-xl border border-border bg-background p-1">
            <button type="button" className={`${segmentBase} ${destinatario === 'todos' ? segmentActivo : segmentInactivo}`} onClick={() => { setDestinatario('todos'); setConfirmandoTodos(false) }}>Todos los usuarios</button>
            <button type="button" className={`${segmentBase} ${destinatario === 'uno' ? segmentActivo : segmentInactivo}`} onClick={() => { setDestinatario('uno'); setConfirmandoTodos(false) }}>Usuario específico</button>
          </div>
          {destinatario === 'uno' && (
            <select
              value={destinatarioUserId}
              onChange={(e) => setDestinatarioUserId(e.target.value)}
              disabled={cargandoUsuarios}
              className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 font-mono text-sm text-foreground"
            >
              <option value="">{cargandoUsuarios ? 'Cargando…' : 'Elegí un usuario'}</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          )}
        </div>

        {necesitaTexto && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mensaje</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí el mensaje que van a ver en Home..."
              className="mt-1.5 min-h-[70px] w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}

        {necesitaMedia && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tipo === 'video' ? 'Video' : 'Foto'}</label>
            <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3">
              {previewUrl ? (
                tipo === 'video' ? (
                  <video src={previewUrl} className="h-16 w-11 rounded-lg object-cover" muted />
                ) : (
                  <img src={previewUrl} alt="" className="h-16 w-11 rounded-lg object-cover" />
                )
              ) : (
                <div className="flex h-16 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {tipo === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{mediaFile ? mediaFile.name : 'Ningún archivo elegido'}</p>
                <label className="mt-1 inline-block cursor-pointer text-xs font-bold text-accent hover:underline">
                  {mediaFile ? 'Cambiar archivo' : 'Elegir archivo'}
                  <input type="file" accept={tipo === 'video' ? 'video/*' : 'image/*'} onChange={elegirArchivo} className="hidden" />
                </label>
              </div>
            </div>
            {tipo === 'video' && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Se muestra a pantalla completa apenas se entra a Home (no como banner chico). Recomendado: menos de 30s y 20 MB.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {confirmandoTodos && (
          <div className="flex items-start gap-2 rounded-xl bg-accent/10 px-3 py-2.5 text-xs leading-relaxed text-accent">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Este mensaje les va a aparecer a los {usuarios.length} usuarios activos que todavía no lo hayan cerrado.
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button type="button" variant="accent" onClick={onClickEnviar} disabled={!puedeEnviar || enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? 'Enviando…' : confirmandoTodos ? 'Sí, enviar a todos' : 'Enviar mensaje'}
          </Button>
        </div>
      </div>
    </div>
  )
}
