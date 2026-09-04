import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Search,
  TriangleAlert,
  Loader2,
  Users as UsersIcon,
  AlertCircle,
  EllipsisVertical,
  KeyRound,
  Shield,
  Trash2,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelEstadisticasUsuario } from '@/components/PanelEstadisticasUsuario'
import {
  emailPareceSospechoso,
  otorgarAdmin,
  revocarAdmin,
  restablecerContrasena,
  eliminarUsuario,
  marcarTourBienvenida,
  type Usuario,
} from '@/lib/usuarios'

type FiltroRol = 'todos' | 'admin' | 'user'
type FiltroActividad = 'todos' | 'con' | 'sin'

const formatoFecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })
function fmt(fecha: string | null): string {
  if (!fecha) return '—'
  return formatoFecha.format(new Date(fecha))
}

const inputBase =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface Props {
  usuarios: Usuario[]
  cargando: boolean
  miPropioId: string
  onRecargar: () => void
}

// Toda acción que escribe algo en la base (cambiar rol, mandar el enlace de
// contraseña, eliminar la cuenta) pasa primero por este modal de
// confirmación — nada se aplica con un solo click. `variant` define el tono:
// destructive para lo irreversible, accent para el cambio de rol (mismo
// color que el pill de Admin), info para lo que es solo un aviso/envío.
type TipoConfirmacion = 'otorgar' | 'quitar' | 'reset' | 'eliminar' | 'marcarTourVisto' | 'marcarTourNoVisto'

interface Confirmacion {
  tipo: TipoConfirmacion
  usuario: Usuario
}

interface ConfigConfirmacion {
  variant: 'destructive' | 'accent' | 'info'
  icono: typeof Shield
  titulo: string
  descripcion: ReactNode
  nota: string
  botonLabel: string
  botonCargando: string
}

function configPara(confirmacion: Confirmacion): ConfigConfirmacion {
  const { tipo, usuario } = confirmacion
  switch (tipo) {
    case 'otorgar':
      return {
        variant: 'accent',
        icono: Shield,
        titulo: '¿Dar permisos de administrador?',
        descripcion: (
          <>
            <strong className="font-mono font-semibold text-foreground">{usuario.email}</strong> va a poder ver y gestionar todo el
            panel — usuarios, pagos y soporte, igual que vos.
          </>
        ),
        nota: 'Podés revertirlo cuando quieras desde este mismo menú.',
        botonLabel: 'Dar admin',
        botonCargando: 'Guardando…',
      }
    case 'quitar':
      return {
        variant: 'accent',
        icono: Shield,
        titulo: '¿Quitar permisos de administrador?',
        descripcion: (
          <>
            <strong className="font-mono font-semibold text-foreground">{usuario.email}</strong> deja de tener acceso al panel de
            administración de inmediato.
          </>
        ),
        nota: 'Podés revertirlo cuando quieras desde este mismo menú.',
        botonLabel: 'Quitar admin',
        botonCargando: 'Guardando…',
      }
    case 'marcarTourVisto':
      return {
        variant: 'accent',
        icono: Eye,
        titulo: '¿Marcar el tour de bienvenida como visto?',
        descripcion: (
          <>
            La próxima vez que <strong className="font-mono font-semibold text-foreground">{usuario.email}</strong> entre a
            Home, ya no va a ver el carrusel de bienvenida.
          </>
        ),
        nota: 'No le manda ningún aviso. Podés volver a marcarlo como "No visto" cuando quieras desde este mismo menú.',
        botonLabel: 'Marcar visto',
        botonCargando: 'Guardando…',
      }
    case 'marcarTourNoVisto':
      return {
        variant: 'accent',
        icono: EyeOff,
        titulo: '¿Marcar el tour de bienvenida como no visto?',
        descripcion: (
          <>
            La próxima vez que <strong className="font-mono font-semibold text-foreground">{usuario.email}</strong> entre a
            Home, va a volver a ver el carrusel de bienvenida completo, como si fuera nuevo.
          </>
        ),
        nota: 'Podés volver a marcarlo como "Visto" en cualquier momento desde este mismo menú.',
        botonLabel: 'Marcar no visto',
        botonCargando: 'Guardando…',
      }
    case 'reset':
      return {
        variant: 'info',
        icono: KeyRound,
        titulo: '¿Restablecer la contraseña?',
        descripcion: (
          <>
            Se envía un enlace a <strong className="font-mono font-semibold text-foreground">{usuario.email}</strong> para crear una
            contraseña nueva.
          </>
        ),
        nota: 'Su contraseña actual deja de funcionar en cuanto la cambie desde el enlace.',
        botonLabel: 'Enviar enlace',
        botonCargando: 'Enviando…',
      }
    case 'eliminar':
      return {
        variant: 'destructive',
        icono: Trash2,
        titulo: '¿Eliminar este usuario?',
        descripcion: (
          <>
            Vas a eliminar a <strong className="font-mono font-semibold text-foreground">{usuario.email}</strong>. Pierde acceso a la
            app de inmediato.
          </>
        ),
        nota: 'Esta acción no se puede deshacer. Se borra también su historial de simulacros, dispositivos y configuración guardada.',
        botonLabel: 'Eliminar usuario',
        botonCargando: 'Eliminando…',
      }
  }
}

export function Usuarios({ usuarios, cargando, miPropioId, onRecargar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<FiltroRol>('todos')
  const [actividad, setActividad] = useState<FiltroActividad>('todos')

  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [usuarioEstadisticas, setUsuarioEstadisticas] = useState<Usuario | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  function abrirMenu(u: Usuario, boton: HTMLButtonElement) {
    if (menuAbiertoId === u.id) {
      setMenuAbiertoId(null)
      return
    }
    const r = boton.getBoundingClientRect()
    const anchoMenu = 240
    let left = r.right - anchoMenu
    if (left < 8) left = 8
    setMenuPos({ top: r.bottom + 6, left })
    setMenuAbiertoId(u.id)
  }

  useEffect(() => {
    if (!menuAbiertoId) return
    function cerrar(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbiertoId(null)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAbiertoId(null)
    }
    function cerrarPorScrollOResize() {
      setMenuAbiertoId(null)
    }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', cerrarPorScrollOResize, true)
    window.addEventListener('resize', cerrarPorScrollOResize)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', cerrarPorScrollOResize, true)
      window.removeEventListener('resize', cerrarPorScrollOResize)
    }
  }, [menuAbiertoId])

  useEffect(() => {
    if (!confirmacion) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape' && !confirmando) setConfirmacion(null)
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [confirmacion, confirmando])

  function pedirConfirmacion(tipo: TipoConfirmacion, usuario: Usuario) {
    setMenuAbiertoId(null)
    setErrorAccion(null)
    setConfirmacion({ tipo, usuario })
  }

  async function confirmar() {
    if (!confirmacion) return
    const { tipo, usuario } = confirmacion
    setConfirmando(true)
    setProcesandoId(usuario.id)

    let resultado: { ok: boolean }
    if (tipo === 'otorgar') resultado = await otorgarAdmin(usuario.id)
    else if (tipo === 'quitar') resultado = await revocarAdmin(usuario.id)
    else if (tipo === 'reset') resultado = await restablecerContrasena(usuario.email)
    else if (tipo === 'marcarTourVisto') resultado = await marcarTourBienvenida(usuario.id, true)
    else if (tipo === 'marcarTourNoVisto') resultado = await marcarTourBienvenida(usuario.id, false)
    else resultado = await eliminarUsuario(usuario.id)

    setConfirmando(false)
    setProcesandoId(null)
    setConfirmacion(null)

    if (resultado.ok) {
      onRecargar()
    } else {
      const mensajes: Record<TipoConfirmacion, string> = {
        otorgar: 'No se pudo actualizar el rol. Probá de nuevo en un momento.',
        quitar: 'No se pudo actualizar el rol. Probá de nuevo en un momento.',
        reset: 'No se pudo enviar el enlace de restablecimiento. Probá de nuevo en un momento.',
        eliminar: 'No se pudo eliminar el usuario. Probá de nuevo en un momento.',
        marcarTourVisto: 'No se pudo actualizar el tour de bienvenida. Probá de nuevo en un momento.',
        marcarTourNoVisto: 'No se pudo actualizar el tour de bienvenida. Probá de nuevo en un momento.',
      }
      setErrorAccion(mensajes[tipo])
    }
  }

  const stats = useMemo(() => {
    const haceUnaSemana = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      total: usuarios.length,
      simulacros: usuarios.reduce((acc, u) => acc + u.simulacros, 0),
      nuevos: usuarios.filter((u) => new Date(u.creadoEn).getTime() >= haceUnaSemana).length,
      admins: usuarios.filter((u) => u.esAdmin).length,
    }
  }, [usuarios])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      const coincideTexto = !q || u.email.toLowerCase().includes(q) || (u.nickname ?? '').toLowerCase().includes(q)
      const coincideRol = rol === 'todos' || (rol === 'admin' ? u.esAdmin : !u.esAdmin)
      const coincideActividad = actividad === 'todos' || (actividad === 'con' ? u.simulacros > 0 : u.simulacros === 0)
      return coincideTexto && coincideRol && coincideActividad
    })
  }, [usuarios, busqueda, rol, actividad])

  const hayFiltros = busqueda.trim() !== '' || rol !== 'todos' || actividad !== 'todos'
  const usuarioMenu = menuAbiertoId ? usuarios.find((u) => u.id === menuAbiertoId) ?? null : null

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cuentas registradas en el proyecto — datos en vivo desde Supabase.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard etiqueta="Total usuarios" valor={stats.total} cargando={cargando} />
        <StatCard etiqueta="Simulacros completados" valor={stats.simulacros} cargando={cargando} />
        <StatCard etiqueta="Nuevos esta semana" valor={stats.nuevos} cargando={cargando} />
        <StatCard etiqueta="Admins" valor={stats.admins} cargando={cargando} />
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por correo o nombre"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        <select value={rol} onChange={(e) => setRol(e.target.value as FiltroRol)} className={inputBase}>
          <option value="todos">Todos los roles</option>
          <option value="admin">Solo admins</option>
          <option value="user">Solo usuarios</option>
        </select>
        <select value={actividad} onChange={(e) => setActividad(e.target.value as FiltroActividad)} className={inputBase}>
          <option value="todos">Cualquier actividad</option>
          <option value="con">Con simulacros</option>
          <option value="sin">Sin simulacros todavía</option>
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('')
              setRol('todos')
              setActividad('todos')
            }}
            className="text-sm font-bold text-accent hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        {cargando ? 'Cargando…' : hayFiltros ? `${filtrados.length} de ${usuarios.length} usuarios` : `${usuarios.length} usuarios`}
      </p>

      {errorAccion && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorAccion}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">Usuario</th>
                <th className="whitespace-nowrap px-4 py-3">Alta</th>
                <th className="whitespace-nowrap px-4 py-3">Último acceso</th>
                <th className="whitespace-nowrap px-4 py-3">Simulacros</th>
                <th className="whitespace-nowrap px-4 py-3">Promedio</th>
                <th className="whitespace-nowrap px-4 py-3">Tour</th>
                <th className="whitespace-nowrap px-4 py-3">Rol</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {usuarios.length === 0 ? 'Todavía no hay usuarios registrados.' : 'Ningún usuario coincide con estos filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border/70 text-sm last:border-b-0 hover:bg-muted/50 ${
                      menuAbiertoId === u.id ? 'bg-muted/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setUsuarioEstadisticas(u)}
                        title="Ver estadísticas individuales"
                        className="flex items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-[0.68rem] font-extrabold text-accent">
                          {u.email.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-mono font-semibold text-foreground hover:underline">{u.email}</span>
                        {emailPareceSospechoso(u.email) && (
                          <TriangleAlert
                            className="h-3.5 w-3.5 shrink-0 text-destructive"
                            aria-label="El dominio de este correo parece inusual — verificar si hubo un error de tipeo"
                          />
                        )}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{fmt(u.creadoEn)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{fmt(u.ultimoAcceso)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-foreground">{u.simulacros}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-foreground">
                      {u.promedio === null ? '—' : `${u.promedio}%`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <TourBadge visto={u.vioTourBienvenida} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <RolBadge esAdmin={u.esAdmin} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {procesandoId === u.id ? (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => abrirMenu(u, e.currentTarget)}
                          aria-haspopup="true"
                          aria-expanded={menuAbiertoId === u.id}
                          aria-label={`Acciones para ${u.email}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

      <p className="mt-4 flex max-w-[62ch] items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <UsersIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Fuente de estos datos: <code className="mx-1 rounded bg-muted px-1 py-0.5">auth.users</code> (alta, último acceso) vía la
        función <code className="mx-1 rounded bg-muted px-1 py-0.5">admin_listar_usuarios</code>,
        <code className="mx-1 rounded bg-muted px-1 py-0.5">historial_intentos</code> agregado por usuario,{' '}
        <code className="mx-1 rounded bg-muted px-1 py-0.5">admins</code> para el rol y{' '}
        <code className="mx-1 rounded bg-muted px-1 py-0.5">perfiles</code> para el tour de bienvenida (sin fila creada = "No
        visto"). Los planes pagos llegan con la integración de Stripe.
      </p>

      {usuarioMenu && menuPos && (
        <div
          ref={menuRef}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed z-40 w-60 animate-float-up rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
        >
          <MenuItem
            icono={KeyRound}
            etiqueta="Restablecer contraseña"
            onClick={() => pedirConfirmacion('reset', usuarioMenu)}
          />
          {usuarioMenu.esAdmin ? (
            <MenuItem
              icono={Shield}
              etiqueta="Quitar admin"
              disabled={usuarioMenu.id === miPropioId}
              titulo={usuarioMenu.id === miPropioId ? 'No podés quitarte el rol de admin a vos mismo' : undefined}
              onClick={() => pedirConfirmacion('quitar', usuarioMenu)}
            />
          ) : (
            <MenuItem icono={Shield} etiqueta="Hacer admin" onClick={() => pedirConfirmacion('otorgar', usuarioMenu)} />
          )}
          {usuarioMenu.vioTourBienvenida ? (
            <MenuItem
              icono={EyeOff}
              etiqueta="Marcar tour como no visto"
              onClick={() => pedirConfirmacion('marcarTourNoVisto', usuarioMenu)}
            />
          ) : (
            <MenuItem
              icono={Eye}
              etiqueta="Marcar tour como visto"
              onClick={() => pedirConfirmacion('marcarTourVisto', usuarioMenu)}
            />
          )}
          <div className="my-1 h-px bg-border" />
          <MenuItem
            icono={Trash2}
            etiqueta="Eliminar usuario"
            danger
            disabled={usuarioMenu.id === miPropioId}
            titulo={usuarioMenu.id === miPropioId ? 'No podés eliminar tu propia cuenta' : undefined}
            onClick={() => pedirConfirmacion('eliminar', usuarioMenu)}
          />
        </div>
      )}

      {confirmacion && <ModalConfirmacion confirmacion={confirmacion} cargando={confirmando} onCancelar={() => setConfirmacion(null)} onConfirmar={confirmar} />}

      {usuarioEstadisticas && (
        <PanelEstadisticasUsuario usuario={usuarioEstadisticas} onClose={() => setUsuarioEstadisticas(null)} />
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

function RolBadge({ esAdmin }: { esAdmin: boolean }) {
  return esAdmin ? (
    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">Admin</span>
  ) : (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Usuario</span>
  )
}

// Mismo criterio visual que RolBadge (accent = lo que vale la pena notar,
// muted = el estado esperado/mayoritario) pero al revés: acá lo que vale la
// pena que un admin note de un vistazo es quién TODAVÍA NO vio el tour, no
// quién sí.
function TourBadge({ visto }: { visto: boolean }) {
  return visto ? (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Visto</span>
  ) : (
    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">No visto</span>
  )
}

function MenuItem({
  icono: Icono,
  etiqueta,
  onClick,
  danger,
  disabled,
  titulo,
}: {
  icono: typeof Shield
  etiqueta: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  titulo?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-muted'
      }`}
    >
      <Icono className="h-4 w-4 shrink-0" />
      {etiqueta}
    </button>
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
  const colorIcono =
    cfg.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : cfg.variant === 'accent' ? 'bg-accent/15 text-accent' : 'bg-info/10 text-info'
  const colorNota =
    cfg.variant === 'destructive'
      ? 'bg-destructive/10 text-destructive'
      : cfg.variant === 'accent'
        ? 'bg-accent/10 text-accent'
        : 'bg-info/10 text-info'
  const NotaIcono = cfg.variant === 'destructive' ? TriangleAlert : Info
  const botonVariant = cfg.variant

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !cargando) onCancelar()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmacion-titulo"
        className="flex w-full max-w-sm animate-float-up flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${colorIcono}`}>
          <Icono className="h-5 w-5" />
        </div>
        <div>
          <h2 id="confirmacion-titulo" className="text-base font-extrabold text-foreground">
            {cfg.titulo}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cfg.descripcion}</p>
        </div>
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${colorNota}`}>
          <NotaIcono className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{cfg.nota}</span>
        </div>
        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Button>
          <Button type="button" variant={botonVariant} onClick={onConfirmar} disabled={cargando}>
            {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
            {cargando ? cfg.botonCargando : cfg.botonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
