import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Ban, BellOff, ShieldCheck, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Campo, Cajon, Interruptor, Panelito, Pildora, Segmentado, fechaCorta, selectCls } from '@/components/ui/extra'
import { cn } from '@/lib/utils'
import * as chat from '@/lib/chat'
import type { ConfigChat, SalaAdmin, UsuarioChat, ReporteChat, SolicitudChat, AccionChat, ActividadSala } from '@/lib/chat'

type Pestana = 'resumen' | 'grupos' | 'usuarios' | 'pendientes' | 'registro'

const ASIGNATURAS = ['Ortodoncia', 'Pacientes Especiales', 'Materiales Odontológicos', 'Psicología general', 'Examen Práctico']

const LENTO = [
  { valor: 0, etiqueta: 'Sin límite' },
  { valor: 10, etiqueta: '10 s' },
  { valor: 30, etiqueta: '30 s' },
  { valor: 60, etiqueta: '1 min' },
]

function silenciado(u: UsuarioChat): boolean {
  return !!u.silencioHasta && new Date(u.silencioHasta).getTime() > Date.now()
}

export function Chat({ adminId, onPendientes }: { adminId: string; onPendientes?: () => void }) {
  const [tab, setTab] = useState<Pestana>('resumen')
  const [config, setConfig] = useState<ConfigChat | null>(null)
  const [salas, setSalas] = useState<SalaAdmin[]>([])
  const [act, setAct] = useState<Map<string, ActividadSala>>(new Map())
  const [usuarios, setUsuarios] = useState<UsuarioChat[]>([])
  const [reportes, setReportes] = useState<ReporteChat[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudChat[]>([])
  const [acciones, setAcciones] = useState<AccionChat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    const [c, s, a, u, r, so, ac] = await Promise.all([
      chat.obtenerConfig(),
      chat.listarSalas(),
      chat.actividadPorSala(),
      chat.listarUsuariosChat(),
      chat.listarReportes(),
      chat.listarSolicitudes(),
      chat.listarAcciones(),
    ])
    setConfig(c)
    setSalas(s)
    setAct(a)
    setUsuarios(u)
    setReportes(r)
    setSolicitudes(so)
    setAcciones(ac)
    setCargando(false)
    onPendientes?.()
  }, [onPendientes])

  useEffect(() => {
    recargar()
    return chat.suscribirseAPendientesChat(recargar)
  }, [recargar])

  const alias = useMemo(() => new Map(usuarios.map((u) => [u.userId, u] as const)), [usuarios])
  const nombreDe = (id: string | null) => {
    if (!id) return '—'
    const u = alias.get(id)
    return u?.alias ?? u?.email ?? id.slice(0, 8)
  }
  const salaDe = (id: string | null) => salas.find((s) => s.id === id)?.nombre ?? '—'

  const pendientesN = reportes.length + solicitudes.length

  async function ejecutar(fn: () => Promise<string | null>, accion?: { tipo: string; detalle: string; salaId?: string | null; usuarioId?: string | null }) {
    setError(null)
    const e = await fn()
    if (e) {
      setError(e)
      return false
    }
    if (accion) await chat.registrarAccion(adminId, accion.tipo, accion.detalle, accion)
    await recargar()
    return true
  }

  if (cargando || !config) {
    return <p className="text-sm text-muted-foreground">Cargando chat…</p>
  }

  const tabs: { id: Pestana; label: string; n?: number }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'grupos', label: 'Grupos' },
    { id: 'usuarios', label: 'Usuarios y acceso' },
    { id: 'pendientes', label: 'Pendientes', n: pendientesN },
    { id: 'registro', label: 'Registro' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-bold transition-colors',
              tab === t.id ? 'border-accent text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {!!t.n && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-extrabold text-accent-foreground">{t.n}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {tab === 'resumen' && (
        <Resumen
          config={config}
          salas={salas}
          act={act}
          usuarios={usuarios}
          pendientes={pendientesN}
          onCambiar={(p, texto) => ejecutar(() => chat.guardarConfig(p), { tipo: 'config', detalle: texto })}
          onIr={setTab}
        />
      )}
      {tab === 'grupos' && (
        <Grupos
          salas={salas}
          act={act}
          onRecargar={recargar}
          onGuardar={(id, p, texto) => ejecutar(() => chat.guardarSala(id, p), { tipo: 'grupo', detalle: texto, salaId: id })}
          onCrear={async (s) => {
            const r = await chat.crearSala(s)
            if (r.error) {
              setError(r.error)
              return false
            }
            await chat.registrarAccion(adminId, 'grupo', `Grupo creado: ${s.nombre}`, { salaId: r.id })
            await recargar()
            return true
          }}
        />
      )}
      {tab === 'usuarios' && (
        <Usuarios
          usuarios={usuarios}
          salas={salas}
          modo={config.modoAcceso}
          nombreDe={nombreDe}
          adminId={adminId}
          ejecutar={ejecutar}
        />
      )}
      {tab === 'pendientes' && (
        <Pendientes
          reportes={reportes}
          solicitudes={solicitudes}
          nombreDe={nombreDe}
          salaDe={salaDe}
          ejecutar={ejecutar}
          adminId={adminId}
        />
      )}
      {tab === 'registro' && <Registro acciones={acciones} nombreDe={nombreDe} salaDe={salaDe} />}
    </div>
  )
}

/* ───────── Resumen ───────── */

function Kpi({ etiqueta, valor, sub }: { etiqueta: string; valor: string | number; sub?: string }) {
  return (
    <div className="card-elevated rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Fila({ titulo, desc, children }: { titulo: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function Resumen({
  config,
  salas,
  act,
  usuarios,
  pendientes,
  onCambiar,
  onIr,
}: {
  config: ConfigChat
  salas: SalaAdmin[]
  act: Map<string, ActividadSala>
  usuarios: UsuarioChat[]
  pendientes: number
  onCambiar: (p: Partial<ConfigChat>, texto: string) => Promise<boolean>
  onIr: (t: Pestana) => void
}) {
  const activos = usuarios.filter((u) => u.grupos > 0).length
  const msgs = [...act.values()].reduce((a, b) => a + b.mensajes7d, 0)
  const bloqueados = usuarios.filter((u) => u.acceso === 'bloqueado').length
  const maxMsgs = Math.max(1, ...salas.map((s) => act.get(s.id)?.mensajes7d ?? 0))

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi etiqueta="Usuarios en el chat" valor={activos} sub={`de ${usuarios.length} registrados`} />
        <Kpi etiqueta="Mensajes (7 días)" valor={msgs} />
        <Kpi etiqueta="Bloqueados" valor={bloqueados} />
        <button type="button" onClick={() => onIr('pendientes')} className="card-elevated rounded-2xl border border-border bg-card p-4 text-left">
          <p className="text-xs font-semibold text-muted-foreground">Pendientes</p>
          <p className={cn('mt-1 text-2xl font-extrabold tabular-nums', pendientes > 0 ? 'text-accent' : 'text-foreground')}>{pendientes}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">reportes y solicitudes</p>
        </button>
      </div>

      <Panelito>
        <h3 className="text-sm font-extrabold text-foreground">Control general</h3>
        <p className="mb-1 text-xs text-muted-foreground">Estos ajustes se aplican al instante en la app de los usuarios.</p>
        <div className="divide-y divide-border">
          <Fila titulo="Chat abierto" desc="Si lo cierras, nadie (salvo el equipo) puede entrar ni escribir.">
            <Interruptor
              activo={config.abierto}
              etiqueta="Chat abierto"
              onChange={(v) => onCambiar({ abierto: v }, v ? 'Chat abierto' : 'Chat cerrado')}
            />
          </Fila>
          <Fila titulo="Quién puede entrar" desc="Todos (excepto bloqueados) o solo los que habilites uno a uno.">
            <Segmentado
              valor={config.modoAcceso}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos' },
                { valor: 'habilitados', etiqueta: 'Solo habilitados' },
              ]}
              onChange={(v) => onCambiar({ modoAcceso: v }, `Acceso: ${v === 'todos' ? 'todos' : 'solo habilitados'}`)}
            />
          </Fila>
          <Fila titulo="Exigir alias" desc="El usuario elige un alias antes de escribir (no se muestra su correo).">
            <Interruptor
              activo={config.exigirAlias}
              etiqueta="Exigir alias"
              onChange={(v) => onCambiar({ exigirAlias: v }, `Exigir alias: ${v ? 'sí' : 'no'}`)}
            />
          </Fila>
          <Fila titulo="Exigir aceptar normas" desc="Debe aceptar las normas del grupo antes de escribir.">
            <Interruptor
              activo={config.exigirNormas}
              etiqueta="Exigir normas"
              onChange={(v) => onCambiar({ exigirNormas: v }, `Exigir normas: ${v ? 'sí' : 'no'}`)}
            />
          </Fila>
        </div>
      </Panelito>

      <Panelito>
        <h3 className="mb-3 text-sm font-extrabold text-foreground">Actividad por grupo (7 días)</h3>
        <ul className="space-y-2.5">
          {salas.map((s) => {
            const a = act.get(s.id)
            const n = a?.mensajes7d ?? 0
            return (
              <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[14rem_1fr_auto]">
                <span className="truncate text-sm font-semibold text-foreground">{s.nombre}</span>
                <span className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / maxMsgs) * 100}%` }} />
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {n} msgs · {a?.miembros ?? 0} miembros
                </span>
              </li>
            )
          })}
        </ul>
      </Panelito>
    </div>
  )
}

/* ───────── Grupos ───────── */

const VACIA: chat.CamposSala = {
  nombre: '',
  asignatura: null,
  orden: 50,
  acceso: 'libre',
  escribe: 'todos',
  modoLentoSeg: 0,
  pausada: false,
  normas: '',
  fijado: '',
  palabrasBloqueadas: [],
  archivada: false,
}

function Grupos({
  salas,
  act,
  onGuardar,
  onCrear,
  onRecargar,
}: {
  salas: SalaAdmin[]
  act: Map<string, ActividadSala>
  onRecargar: () => void
  onGuardar: (id: string, p: Partial<chat.CamposSala>, texto: string) => Promise<boolean>
  onCrear: (s: chat.CamposSala) => Promise<boolean>
}) {
  const [edit, setEdit] = useState<SalaAdmin | 'nuevo' | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="accent" onClick={() => setEdit('nuevo')}>
          <Plus /> Nuevo grupo
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">Grupo</th>
              <th className="px-4 py-3 font-bold">Entrada</th>
              <th className="px-4 py-3 font-bold">Escribe</th>
              <th className="px-4 py-3 font-bold">Miembros</th>
              <th className="px-4 py-3 font-bold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {salas.map((s) => (
              <tr key={s.id} onClick={() => setEdit(s)} className="cursor-pointer hover:bg-muted/50">
                <td className="px-4 py-3 font-bold text-foreground">{s.nombre}</td>
                <td className="px-4 py-3">{s.acceso === 'libre' ? 'Libre' : 'Con aprobación'}</td>
                <td className="px-4 py-3">{s.escribe === 'todos' ? 'Todos' : 'Solo equipo'}</td>
                <td className="px-4 py-3 tabular-nums">
                  {act.get(s.id)?.miembros ?? 0}
                  {!!act.get(s.id)?.pendientes && <Pildora tono="aviso">{act.get(s.id)?.pendientes} pend.</Pildora>}
                </td>
                <td className="space-x-1 px-4 py-3">
                  {s.archivada ? <Pildora>Archivado</Pildora> : s.pausada ? <Pildora tono="aviso">Pausado</Pildora> : <Pildora tono="ok">Activo</Pildora>}
                  {s.modoLentoSeg > 0 && <Pildora tono="info">Lento {s.modoLentoSeg}s</Pildora>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Limpieza salas={salas} onListo={onRecargar} />
      {edit && (
        <EditorGrupo
          key={edit === 'nuevo' ? 'nuevo' : edit.id}
          sala={edit === 'nuevo' ? null : edit}
          onLimpiado={onRecargar}
          onCerrar={() => setEdit(null)}
          onGuardar={async (campos) => {
            const ok =
              edit === 'nuevo'
                ? await onCrear(campos)
                : await onGuardar(edit.id, campos, `Grupo editado: ${campos.nombre}`)
            if (ok) setEdit(null)
          }}
        />
      )}
    </div>
  )
}

function EditorGrupo({
  sala,
  onCerrar,
  onGuardar,
  onLimpiado,
}: {
  sala: SalaAdmin | null
  onLimpiado: () => void
  onCerrar: () => void
  onGuardar: (c: chat.CamposSala) => Promise<void>
}) {
  const [f, setF] = useState<chat.CamposSala>(sala ? { ...sala } : VACIA)
  const [palabras, setPalabras] = useState((sala?.palabrasBloqueadas ?? []).join(', '))
  const [guardando, setGuardando] = useState(false)
  const set = <K extends keyof chat.CamposSala>(k: K, v: chat.CamposSala[K]) => setF((p) => ({ ...p, [k]: v }))

  return (
    <Cajon
      abierto
      titulo={sala ? 'Editar grupo' : 'Nuevo grupo'}
      onCerrar={onCerrar}
      pie={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant="accent"
            disabled={guardando || f.nombre.trim().length < 2}
            onClick={async () => {
              setGuardando(true)
              await onGuardar({
                ...f,
                nombre: f.nombre.trim(),
                palabrasBloqueadas: palabras.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean),
              })
              setGuardando(false)
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <Campo etiqueta="Nombre">
        <Input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={60} />
      </Campo>
      <Campo etiqueta="Asignatura" ayuda="Vincula el grupo a una asignatura de la app (o ninguna).">
        <select className={selectCls} value={f.asignatura ?? ''} onChange={(e) => set('asignatura', e.target.value || null)}>
          <option value="">Ninguna</option>
          {ASIGNATURAS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Entrada">
        <Segmentado
          valor={f.acceso}
          opciones={[
            { valor: 'libre', etiqueta: 'Libre' },
            { valor: 'aprobacion', etiqueta: 'Con aprobación' },
          ]}
          onChange={(v) => set('acceso', v)}
        />
      </Campo>
      <Campo etiqueta="Quién escribe">
        <Segmentado
          valor={f.escribe}
          opciones={[
            { valor: 'todos', etiqueta: 'Todos' },
            { valor: 'equipo', etiqueta: 'Solo equipo' },
          ]}
          onChange={(v) => set('escribe', v)}
        />
      </Campo>
      <Campo etiqueta="Modo lento" ayuda="Tiempo mínimo entre mensajes de un mismo usuario.">
        <Segmentado valor={f.modoLentoSeg} opciones={LENTO} onChange={(v) => set('modoLentoSeg', v)} />
      </Campo>
      <Campo etiqueta="Mensaje fijado" ayuda="Se muestra arriba del chat.">
        <Input value={f.fijado} onChange={(e) => set('fijado', e.target.value)} maxLength={140} />
      </Campo>
      <Campo etiqueta="Normas">
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
          value={f.normas}
          onChange={(e) => set('normas', e.target.value)}
        />
      </Campo>
      <Campo etiqueta="Palabras bloqueadas" ayuda="Separadas por comas. El mensaje que las contenga se rechaza.">
        <Input value={palabras} onChange={(e) => setPalabras(e.target.value)} />
      </Campo>
      {sala && (
        <div className="rounded-xl border border-border p-4">
          <Limpieza salas={[sala]} fija onListo={onLimpiado} compacto />
        </div>
      )}
      <div className="divide-y divide-border">
        <Fila titulo="Pausar grupo" desc="Nadie puede escribir mientras esté pausado.">
          <Interruptor activo={f.pausada} etiqueta="Pausar" onChange={(v) => set('pausada', v)} />
        </Fila>
        <Fila titulo="Archivar" desc="Lo oculta de la lista de los usuarios.">
          <Interruptor activo={f.archivada} etiqueta="Archivar" onChange={(v) => set('archivada', v)} />
        </Fila>
      </div>
    </Cajon>
  )
}

/* ───────── Limpieza de mensajes ───────── */

function Limpieza({
  salas,
  fija,
  compacto,
  onListo,
}: {
  salas: SalaAdmin[]
  fija?: boolean
  compacto?: boolean
  onListo: () => void
}) {
  const [dias, setDias] = useState(10)
  const [otro, setOtro] = useState(false)
  const [salaId, setSalaId] = useState<string>(fija ? salas[0].id : '')
  const [equipo, setEquipo] = useState(false)
  const [n, setN] = useState<number | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setN(null)
    setConfirmar(false)
    chat.limpiarMensajes(Math.max(1, dias), salaId || null, equipo, false).then((r) => {
      if (!vivo) return
      if (r.error) setError(r.error)
      else setN(r.n)
    })
    return () => {
      vivo = false
    }
  }, [dias, salaId, equipo])

  const corte = new Date(Date.now() - Math.max(1, dias) * 86400000).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  async function borrar() {
    setError(null)
    const r = await chat.limpiarMensajes(Math.max(1, dias), salaId || null, equipo, true)
    if (r.error) return setError(r.error)
    setMsg(`${r.n} mensajes borrados`)
    setConfirmar(false)
    setN(0)
    onListo()
  }

  return (
    <Panelito className={compacto ? 'space-y-3 border-0 bg-transparent p-0 shadow-none' : 'space-y-4'}>
      <div>
        <h3 className="text-sm font-extrabold text-foreground">Limpieza de mensajes</h3>
        <p className="text-xs text-muted-foreground">Borra mensajes con más de N días. No se puede deshacer.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Campo etiqueta="Más antiguos de">
          <div className="flex flex-wrap items-center gap-2">
            <Segmentado
              valor={otro ? 0 : dias}
              opciones={[
                { valor: 5, etiqueta: '5 días' },
                { valor: 10, etiqueta: '10 días' },
                { valor: 30, etiqueta: '30 días' },
                { valor: 0, etiqueta: 'Otro' },
              ]}
              onChange={(v) => {
                if (v === 0) setOtro(true)
                else {
                  setOtro(false)
                  setDias(v)
                }
              }}
            />
            {otro && (
              <Input
                id="limpieza-dias"
                type="number"
                min={1}
                className="w-20"
                value={dias}
                onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))}
              />
            )}
          </div>
        </Campo>
        {!fija && (
          <Campo etiqueta="En">
            <select className={selectCls} value={salaId} onChange={(e) => setSalaId(e.target.value)}>
              <option value="">Todos los grupos</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={equipo} onChange={(e) => setEquipo(e.target.checked)} />
        Incluir también los mensajes del equipo (Avisos)
      </label>
      <div className="rounded-xl bg-muted px-4 py-3">
        <p className="text-2xl font-extrabold tabular-nums text-foreground">{n === null ? '…' : `${n} mensajes`}</p>
        <p className="text-xs text-muted-foreground">anteriores al {corte}</p>
      </div>
      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
      {msg && <p className="text-xs font-semibold text-success">{msg}</p>}
      <div className="flex justify-end gap-2">
        {confirmar && (
          <Button variant="ghost" onClick={() => setConfirmar(false)}>
            Cancelar
          </Button>
        )}
        <Button variant="destructive" disabled={!n} onClick={() => (confirmar ? borrar() : setConfirmar(true))}>
          <Trash2 /> {confirmar ? `Confirmar: borrar ${n} mensajes` : 'Borrar…'}
        </Button>
      </div>
    </Panelito>
  )
}

/* ───────── Usuarios ───────── */

type Ejecutar = (
  fn: () => Promise<string | null>,
  accion?: { tipo: string; detalle: string; salaId?: string | null; usuarioId?: string | null },
) => Promise<boolean>

function Usuarios({
  usuarios,
  salas,
  modo,
  nombreDe,
  adminId,
  ejecutar,
}: {
  usuarios: UsuarioChat[]
  salas: SalaAdmin[]
  modo: chat.ModoAcceso
  nombreDe: (id: string | null) => string
  adminId: string
  ejecutar: Ejecutar
}) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'chat' | 'bloqueados' | 'silenciados'>('todos')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [abierto, setAbierto] = useState<string | null>(null)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return usuarios.filter((u) => {
      if (t && !`${u.email ?? ''} ${u.alias ?? ''}`.toLowerCase().includes(t)) return false
      if (filtro === 'chat') return u.grupos > 0
      if (filtro === 'bloqueados') return u.acceso === 'bloqueado'
      if (filtro === 'silenciados') return silenciado(u)
      return true
    })
  }, [usuarios, q, filtro])

  const masivo = (estado: 'habilitado' | 'bloqueado' | null, texto: string) =>
    ejecutar(() => chat.fijarAcceso([...sel], estado, adminId), { tipo: 'acceso', detalle: `${texto} (${sel.size} usuarios)` }).then(
      (ok) => ok && setSel(new Set()),
    )

  const usuario = usuarios.find((u) => u.userId === abierto) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por correo o alias" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmentado
          valor={filtro}
          opciones={[
            { valor: 'todos', etiqueta: 'Todos' },
            { valor: 'chat', etiqueta: 'En el chat' },
            { valor: 'bloqueados', etiqueta: 'Bloqueados' },
            { valor: 'silenciados', etiqueta: 'Silenciados' },
          ]}
          onChange={setFiltro}
        />
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent/10 px-4 py-2.5">
          <span className="text-sm font-bold text-foreground">{sel.size} seleccionados</span>
          <Button size="sm" variant="accent" onClick={() => masivo('habilitado', 'Habilitados')}>
            Habilitar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => masivo('bloqueado', 'Bloqueados')}>
            Bloquear
          </Button>
          <Button size="sm" variant="outline" onClick={() => masivo(null, 'Acceso restablecido')}>
            Quitar excepción
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Modo actual: <strong>{modo === 'todos' ? 'entran todos salvo bloqueados' : 'solo entran los habilitados'}</strong>.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={lista.length > 0 && lista.every((u) => sel.has(u.userId))}
                  onChange={(e) => setSel(e.target.checked ? new Set(lista.map((u) => u.userId)) : new Set())}
                />
              </th>
              <th className="px-4 py-3 font-bold">Usuario</th>
              <th className="px-4 py-3 font-bold">Acceso</th>
              <th className="px-4 py-3 font-bold">Grupos</th>
              <th className="px-4 py-3 font-bold">Mensajes</th>
              <th className="px-4 py-3 font-bold">Último</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((u) => (
              <tr key={u.userId} className="cursor-pointer hover:bg-muted/50" onClick={() => setAbierto(u.userId)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${nombreDe(u.userId)}`}
                    checked={sel.has(u.userId)}
                    onChange={(e) => {
                      const n = new Set(sel)
                      if (e.target.checked) n.add(u.userId)
                      else n.delete(u.userId)
                      setSel(n)
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-foreground">{u.alias ?? <span className="font-normal text-muted-foreground">sin alias</span>}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="space-x-1 px-4 py-3">
                  {u.acceso === 'bloqueado' ? (
                    <Pildora tono="error">Bloqueado</Pildora>
                  ) : u.acceso === 'habilitado' ? (
                    <Pildora tono="ok">Habilitado</Pildora>
                  ) : (
                    <Pildora>Por defecto</Pildora>
                  )}
                  {silenciado(u) && <Pildora tono="aviso">Silenciado</Pildora>}
                </td>
                <td className="px-4 py-3 tabular-nums">{u.grupos}</td>
                <td className="px-4 py-3 tabular-nums">{u.mensajes}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fechaCorta(u.ultimo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin resultados.</p>}
      </div>

      {usuario && (
        <FichaUsuario key={usuario.userId} u={usuario} salas={salas} adminId={adminId} ejecutar={ejecutar} onCerrar={() => setAbierto(null)} />
      )}
    </div>
  )
}

function FichaUsuario({
  u,
  salas,
  adminId,
  ejecutar,
  onCerrar,
}: {
  u: UsuarioChat
  salas: SalaAdmin[]
  adminId: string
  ejecutar: Ejecutar
  onCerrar: () => void
}) {
  const [mem, setMem] = useState<chat.MembresiaAdmin[]>([])
  const [msgs, setMsgs] = useState<chat.MensajeResumen[]>([])
  const nombre = u.alias ?? u.email ?? u.userId.slice(0, 8)
  const ref = { usuarioId: u.userId }

  const cargar = useCallback(async () => {
    setMem(await chat.membresiasDe(u.userId))
    setMsgs(await chat.ultimosMensajesDe(u.userId))
  }, [u.userId])
  useEffect(() => {
    cargar()
  }, [cargar, u.mensajes, u.grupos])

  const dur = (horas: number | null) =>
    horas === null ? chat.HASTA_SIEMPRE : new Date(Date.now() + horas * 3600000).toISOString()

  return (
    <Cajon abierto titulo={nombre} onCerrar={onCerrar}>
      <div>
        <p className="text-xs text-muted-foreground">{u.email}</p>
        <p className="text-xs text-muted-foreground">
          {u.mensajes} mensajes · en {u.grupos} grupos · registrado {fechaCorta(u.registrado)}
        </p>
      </div>

      <Campo etiqueta="Acceso al chat" ayuda="Habilitado entra aunque el chat esté en «solo habilitados». Bloqueado nunca entra.">
        <Segmentado
          valor={u.acceso ?? 'defecto'}
          opciones={[
            { valor: 'defecto', etiqueta: 'Por defecto' },
            { valor: 'habilitado', etiqueta: 'Habilitado' },
            { valor: 'bloqueado', etiqueta: 'Bloqueado' },
          ]}
          onChange={(v) =>
            ejecutar(() => chat.fijarAcceso([u.userId], v === 'defecto' ? null : v, adminId), {
              tipo: 'acceso',
              detalle: `${nombre}: acceso ${v}`,
              ...ref,
            })
          }
        />
      </Campo>

      <Campo etiqueta="Silenciar (en todos los grupos)" ayuda={silenciado(u) ? `Silenciado hasta ${fechaCorta(u.silencioHasta)}` : 'Puede leer pero no escribir.'}>
        <div className="flex flex-wrap gap-2">
          {[
            ['1 h', 1],
            ['24 h', 24],
            ['7 días', 168],
            ['Indefinido', null],
          ].map(([l, h]) => (
            <Button
              key={String(l)}
              size="sm"
              variant="outline"
              onClick={() =>
                ejecutar(() => chat.silenciar(u.userId, null, dur(h as number | null), 'Silenciado por el equipo', adminId), {
                  tipo: 'silencio',
                  detalle: `${nombre} silenciado ${l}`,
                  ...ref,
                })
              }
            >
              <BellOff /> {l}
            </Button>
          ))}
          {silenciado(u) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => ejecutar(() => chat.quitarSilencios(u.userId), { tipo: 'silencio', detalle: `${nombre}: silencio quitado`, ...ref })}
            >
              Quitar silencio
            </Button>
          )}
        </div>
      </Campo>

      <div>
        <p className="mb-2 text-xs font-bold text-foreground">Grupos</p>
        {mem.length === 0 ? (
          <p className="text-xs text-muted-foreground">No está en ningún grupo.</p>
        ) : (
          <ul className="space-y-1.5">
            {mem.map((m) => (
              <li key={m.salaId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{salas.find((s) => s.id === m.salaId)?.nombre}</span>
                <span className="flex items-center gap-2">
                  <Pildora tono={m.estado === 'activo' ? 'ok' : m.estado === 'pendiente' ? 'aviso' : 'error'}>{m.estado}</Pildora>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const nuevo = m.estado === 'expulsado' ? 'activo' : 'expulsado'
                      const ok = await ejecutar(() => chat.cambiarMembresia(m.salaId, u.userId, nuevo), {
                        tipo: 'membresia',
                        detalle: `${nombre}: ${nuevo === 'expulsado' ? 'expulsado de' : 'readmitido en'} ${salas.find((s) => s.id === m.salaId)?.nombre}`,
                        salaId: m.salaId,
                        ...ref,
                      })
                      if (ok) cargar()
                    }}
                  >
                    {m.estado === 'expulsado' ? 'Readmitir' : 'Expulsar'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-foreground">Últimos mensajes</p>
        {msgs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin mensajes.</p>
        ) : (
          <ul className="space-y-2">
            {msgs.map((m) => (
              <li key={m.id} className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <p className={cn(m.borrado && 'italic text-muted-foreground line-through')}>{m.cuerpo}</p>
                <p className="mt-0.5 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                  <span>
                    {salas.find((s) => s.id === m.salaId)?.nombre} · {fechaCorta(m.creadoEn)}
                  </span>
                  {!m.borrado && (
                    <button
                      type="button"
                      className="font-bold text-destructive"
                      onClick={async () => {
                        const ok = await ejecutar(() => chat.borrarMensajeAdmin(m.id, adminId), {
                          tipo: 'mensaje',
                          detalle: `Mensaje de ${nombre} borrado`,
                          salaId: m.salaId,
                          ...ref,
                        })
                        if (ok) cargar()
                      }}
                    >
                      Borrar
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cajon>
  )
}

/* ───────── Pendientes ───────── */

function Pendientes({
  reportes,
  solicitudes,
  nombreDe,
  salaDe,
  ejecutar,
  adminId,
}: {
  reportes: ReporteChat[]
  solicitudes: SolicitudChat[]
  nombreDe: (id: string | null) => string
  salaDe: (id: string | null) => string
  ejecutar: Ejecutar
  adminId: string
}) {
  const actuar = (r: ReporteChat, modo: 'borrar_silenciar' | 'borrar' | 'descartar') =>
    ejecutar(
      async () => {
        if (modo !== 'descartar' && !r.borrado) {
          const e = await chat.borrarMensajeAdmin(r.mensajeId, adminId)
          if (e) return e
        }
        if (modo === 'borrar_silenciar' && r.autorId) {
          const e = await chat.silenciar(r.autorId, null, new Date(Date.now() + 86400000).toISOString(), 'Reporte de mensaje', adminId)
          if (e) return e
        }
        return chat.resolverReporte(r.id, modo === 'descartar' ? 'descartado' : 'resuelto', adminId)
      },
      {
        tipo: 'reporte',
        detalle: `Reporte de ${nombreDe(r.autorId)}: ${modo === 'descartar' ? 'descartado' : modo === 'borrar' ? 'mensaje borrado' : 'borrado y silenciado 24 h'}`,
        salaId: r.salaId,
        usuarioId: r.autorId,
      },
    )

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-extrabold text-foreground">Mensajes reportados ({reportes.length})</h3>
        {reportes.length === 0 && <p className="text-sm text-muted-foreground">Nada pendiente.</p>}
        {reportes.map((r) => (
          <Panelito key={r.id} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {salaDe(r.salaId)} · autor <strong>{nombreDe(r.autorId)}</strong> · reportado por {nombreDe(r.reportadoPor)} · {fechaCorta(r.creadoEn)}
            </p>
            <p className={cn('rounded-xl bg-muted/60 px-3 py-2 text-sm', r.borrado && 'italic line-through')}>{r.cuerpo || '(mensaje no disponible)'}</p>
            {r.motivo && <p className="text-xs text-muted-foreground">Motivo: {r.motivo}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={() => actuar(r, 'borrar_silenciar')}>
                <Trash2 /> Borrar y silenciar 24 h
              </Button>
              <Button size="sm" variant="outline" onClick={() => actuar(r, 'borrar')}>
                Borrar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => actuar(r, 'descartar')}>
                Descartar
              </Button>
            </div>
          </Panelito>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-extrabold text-foreground">Solicitudes de entrada ({solicitudes.length})</h3>
        {solicitudes.length === 0 && <p className="text-sm text-muted-foreground">Nada pendiente.</p>}
        {solicitudes.map((s) => (
          <Panelito key={`${s.salaId}-${s.userId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-bold text-foreground">{nombreDe(s.userId)}</p>
              <p className="text-xs text-muted-foreground">
                quiere entrar a {salaDe(s.salaId)} · {fechaCorta(s.creadoEn)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="accent"
                onClick={() =>
                  ejecutar(() => chat.cambiarMembresia(s.salaId, s.userId, 'activo'), {
                    tipo: 'membresia',
                    detalle: `${nombreDe(s.userId)} aprobado en ${salaDe(s.salaId)}`,
                    salaId: s.salaId,
                    usuarioId: s.userId,
                  })
                }
              >
                <Check /> Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ejecutar(() => chat.cambiarMembresia(s.salaId, s.userId, 'expulsado'), {
                    tipo: 'membresia',
                    detalle: `${nombreDe(s.userId)} rechazado en ${salaDe(s.salaId)}`,
                    salaId: s.salaId,
                    usuarioId: s.userId,
                  })
                }
              >
                <X /> Rechazar
              </Button>
            </div>
          </Panelito>
        ))}
      </section>
    </div>
  )
}

/* ───────── Registro ───────── */

const ICONO: Record<string, typeof Ban> = { acceso: Ban, silencio: BellOff, config: ShieldCheck }

function Registro({
  acciones,
  nombreDe,
  salaDe,
}: {
  acciones: AccionChat[]
  nombreDe: (id: string | null) => string
  salaDe: (id: string | null) => string
}) {
  if (acciones.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay acciones registradas.</p>
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {acciones.map((a) => {
        const Icono = ICONO[a.tipo] ?? ShieldCheck
        return (
          <li key={a.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icono className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{a.detalle}</p>
              <p className="text-xs text-muted-foreground">
                {nombreDe(a.adminId)} · {fechaCorta(a.creadoEn)}
                {a.salaId ? ` · ${salaDe(a.salaId)}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
