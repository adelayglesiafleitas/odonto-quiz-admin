import { useMemo, useState } from 'react'
import { Search, TriangleAlert, Loader2, Users as UsersIcon } from 'lucide-react'
import { emailPareceSospechoso, type Usuario } from '@/lib/usuarios'

type FiltroRol = 'todos' | 'admin' | 'user'
type FiltroActividad = 'todos' | 'con' | 'sin'

const formatoFecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })
function fmt(fecha: string | null): string {
  if (!fecha) return '—'
  return formatoFecha.format(new Date(fecha))
}

const inputBase =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function Usuarios({ usuarios, cargando }: { usuarios: Usuario[]; cargando: boolean }) {
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<FiltroRol>('todos')
  const [actividad, setActividad] = useState<FiltroActividad>('todos')

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

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">Usuario</th>
                <th className="whitespace-nowrap px-4 py-3">Alta</th>
                <th className="whitespace-nowrap px-4 py-3">Último acceso</th>
                <th className="whitespace-nowrap px-4 py-3">Simulacros</th>
                <th className="whitespace-nowrap px-4 py-3">Promedio</th>
                <th className="whitespace-nowrap px-4 py-3">Rol</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {usuarios.length === 0 ? 'Todavía no hay usuarios registrados.' : 'Ningún usuario coincide con estos filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => (
                  <tr key={u.id} className="border-b border-border/70 text-sm last:border-b-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-[0.68rem] font-extrabold text-accent">
                          {u.email.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-mono font-semibold text-foreground">{u.email}</span>
                        {emailPareceSospechoso(u.email) && (
                          <TriangleAlert
                            className="h-3.5 w-3.5 shrink-0 text-destructive"
                            aria-label="El dominio de este correo parece inusual — verificar si hubo un error de tipeo"
                          />
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{fmt(u.creadoEn)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{fmt(u.ultimoAcceso)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-foreground">{u.simulacros}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-foreground">
                      {u.promedio === null ? '—' : `${u.promedio}%`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {u.esAdmin ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">Admin</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Usuario</span>
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
        <code className="mx-1 rounded bg-muted px-1 py-0.5">historial_intentos</code> agregado por usuario y{' '}
        <code className="mx-1 rounded bg-muted px-1 py-0.5">admins</code> para el rol. Los planes pagos llegan con la integración de
        Stripe.
      </p>
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
