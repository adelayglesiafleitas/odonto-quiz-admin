import { supabase } from './supabase'

// Administración del chat Comunidad. La misma configuración vive en Supabase
// (comunidad_config, comunidad_salas, comunidad_acceso_usuario…) y la app del
// cliente la lee/escribe: un cambio hecho acá aparece allá y viceversa.
// Las reglas se validan en triggers/RLS de la base, no en esta UI.

export type ModoAcceso = 'todos' | 'habilitados'

export interface ConfigChat {
  abierto: boolean
  modoAcceso: ModoAcceso
  exigirAlias: boolean
  exigirNormas: boolean
}

export interface SalaAdmin {
  id: string
  nombre: string
  asignatura: string | null
  orden: number
  acceso: 'libre' | 'aprobacion'
  escribe: 'todos' | 'equipo'
  modoLentoSeg: number
  pausada: boolean
  normas: string
  fijado: string
  palabrasBloqueadas: string[]
  archivada: boolean
}

export interface UsuarioChat {
  userId: string
  email: string | null
  alias: string | null
  acceso: 'habilitado' | 'bloqueado' | null
  silencioHasta: string | null
  grupos: number
  expulsadoDe: number
  mensajes: number
  ultimo: string | null
  registrado: string | null
}

export interface ReporteChat {
  id: string
  mensajeId: string
  salaId: string
  reportadoPor: string
  motivo: string
  creadoEn: string
  cuerpo: string
  autorId: string | null
  borrado: boolean
}

export interface SolicitudChat {
  salaId: string
  userId: string
  creadoEn: string
}

export interface AccionChat {
  id: number
  adminId: string
  tipo: string
  salaId: string | null
  usuarioId: string | null
  detalle: string
  creadoEn: string
}

export interface ActividadSala {
  salaId: string
  miembros: number
  pendientes: number
  mensajes7d: number
}

export const HASTA_SIEMPRE = '2100-01-01T00:00:00Z'

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSala(f: any): SalaAdmin {
  return {
    id: f.id,
    nombre: f.nombre,
    asignatura: f.asignatura,
    orden: f.orden,
    acceso: f.acceso,
    escribe: f.escribe,
    modoLentoSeg: f.modo_lento_seg ?? 0,
    pausada: !!f.pausada,
    normas: f.normas ?? '',
    fijado: f.fijado ?? '',
    palabrasBloqueadas: f.palabras_bloqueadas ?? [],
    archivada: !!f.archivada,
  }
}

export async function obtenerConfig(): Promise<ConfigChat> {
  const { data } = await supabase.from('comunidad_config').select('*').eq('id', true).maybeSingle()
  return {
    abierto: data?.abierto ?? true,
    modoAcceso: (data?.modo_acceso as ModoAcceso) ?? 'todos',
    exigirAlias: data?.exigir_alias ?? true,
    exigirNormas: data?.exigir_normas ?? true,
  }
}

export async function guardarConfig(parcial: Partial<ConfigChat>): Promise<string | null> {
  const fila: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
  if (parcial.abierto !== undefined) fila.abierto = parcial.abierto
  if (parcial.modoAcceso !== undefined) fila.modo_acceso = parcial.modoAcceso
  if (parcial.exigirAlias !== undefined) fila.exigir_alias = parcial.exigirAlias
  if (parcial.exigirNormas !== undefined) fila.exigir_normas = parcial.exigirNormas
  const { error } = await supabase.from('comunidad_config').update(fila).eq('id', true)
  return error?.message ?? null
}

export async function listarSalas(): Promise<SalaAdmin[]> {
  const { data } = await supabase.from('comunidad_salas').select('*').order('orden').order('nombre')
  return (data ?? []).map(mapSala)
}

export type CamposSala = Omit<SalaAdmin, 'id'>

function aFilaSala(s: Partial<CamposSala>) {
  const f: Record<string, unknown> = {}
  if (s.nombre !== undefined) f.nombre = s.nombre
  if (s.asignatura !== undefined) f.asignatura = s.asignatura
  if (s.orden !== undefined) f.orden = s.orden
  if (s.acceso !== undefined) f.acceso = s.acceso
  if (s.escribe !== undefined) f.escribe = s.escribe
  if (s.modoLentoSeg !== undefined) f.modo_lento_seg = s.modoLentoSeg
  if (s.pausada !== undefined) f.pausada = s.pausada
  if (s.normas !== undefined) f.normas = s.normas
  if (s.fijado !== undefined) f.fijado = s.fijado
  if (s.palabrasBloqueadas !== undefined) f.palabras_bloqueadas = s.palabrasBloqueadas
  if (s.archivada !== undefined) f.archivada = s.archivada
  return f
}

export async function guardarSala(id: string, parcial: Partial<CamposSala>): Promise<string | null> {
  const { error } = await supabase.from('comunidad_salas').update(aFilaSala(parcial)).eq('id', id)
  return error?.message ?? null
}

export async function crearSala(s: CamposSala): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('comunidad_salas').insert(aFilaSala(s)).select('id').single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function actividadPorSala(): Promise<Map<string, ActividadSala>> {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString()
  const [mi, ms] = await Promise.all([
    supabase.from('comunidad_miembros').select('sala_id, estado').limit(20000),
    supabase.from('comunidad_mensajes').select('sala_id').gte('creado_en', desde).limit(20000),
  ])
  const m = new Map<string, ActividadSala>()
  const get = (id: string) => {
    let a = m.get(id)
    if (!a) {
      a = { salaId: id, miembros: 0, pendientes: 0, mensajes7d: 0 }
      m.set(id, a)
    }
    return a
  }
  for (const f of (mi.data ?? []) as any[]) {
    const a = get(f.sala_id)
    if (f.estado === 'activo') a.miembros++
    else if (f.estado === 'pendiente') a.pendientes++
  }
  for (const f of (ms.data ?? []) as any[]) get(f.sala_id).mensajes7d++
  return m
}

export async function listarUsuariosChat(): Promise<UsuarioChat[]> {
  const { data } = await supabase.rpc('admin_chat_usuarios')
  return ((data ?? []) as any[]).map((f) => ({
    userId: f.user_id,
    email: f.email,
    alias: f.alias,
    acceso: f.acceso,
    silencioHasta: f.silencio_hasta,
    grupos: Number(f.grupos ?? 0),
    expulsadoDe: Number(f.expulsado_de ?? 0),
    mensajes: Number(f.mensajes ?? 0),
    ultimo: f.ultimo,
    registrado: f.registrado,
  }))
}

export async function fijarAcceso(userIds: string[], estado: 'habilitado' | 'bloqueado' | null, adminId: string) {
  if (userIds.length === 0) return null
  if (estado === null) {
    const { error } = await supabase.from('comunidad_acceso_usuario').delete().in('user_id', userIds)
    return error?.message ?? null
  }
  const { error } = await supabase
    .from('comunidad_acceso_usuario')
    .upsert(userIds.map((u) => ({ user_id: u, estado, por: adminId })), { onConflict: 'user_id' })
  return error?.message ?? null
}

export async function silenciar(userId: string, salaId: string | null, hasta: string, motivo: string, adminId: string) {
  const { error } = await supabase
    .from('comunidad_silencios')
    .insert({ user_id: userId, sala_id: salaId, hasta, motivo, por: adminId })
  return error?.message ?? null
}

export async function quitarSilencios(userId: string) {
  const { error } = await supabase.from('comunidad_silencios').delete().eq('user_id', userId)
  return error?.message ?? null
}

export interface MembresiaAdmin {
  salaId: string
  estado: 'activo' | 'pendiente' | 'expulsado'
}

export async function membresiasDe(userId: string): Promise<MembresiaAdmin[]> {
  const { data } = await supabase.from('comunidad_miembros').select('sala_id, estado').eq('user_id', userId)
  return ((data ?? []) as any[]).map((f) => ({ salaId: f.sala_id, estado: f.estado }))
}

export async function cambiarMembresia(salaId: string, userId: string, estado: 'activo' | 'pendiente' | 'expulsado') {
  const { error } = await supabase.from('comunidad_miembros').update({ estado }).eq('sala_id', salaId).eq('user_id', userId)
  return error?.message ?? null
}

export interface MensajeResumen {
  id: string
  salaId: string
  cuerpo: string
  creadoEn: string
  borrado: boolean
}

export async function ultimosMensajesDe(userId: string, n = 8): Promise<MensajeResumen[]> {
  const { data } = await supabase
    .from('comunidad_mensajes')
    .select('id, sala_id, cuerpo, creado_en, borrado_por')
    .eq('autor_id', userId)
    .order('creado_en', { ascending: false })
    .limit(n)
  return ((data ?? []) as any[]).map((f) => ({
    id: f.id,
    salaId: f.sala_id,
    cuerpo: f.cuerpo,
    creadoEn: f.creado_en,
    borrado: !!f.borrado_por,
  }))
}

export async function borrarMensajeAdmin(mensajeId: string, adminId: string) {
  const { error } = await supabase.from('comunidad_mensajes').update({ borrado_por: adminId }).eq('id', mensajeId)
  return error?.message ?? null
}

export async function listarReportes(): Promise<ReporteChat[]> {
  const { data } = await supabase
    .from('comunidad_reportes')
    .select('id, mensaje_id, sala_id, reportado_por, motivo, creado_en')
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: false })
    .limit(200)
  const filas = (data ?? []) as any[]
  const ids = [...new Set(filas.map((f) => f.mensaje_id))]
  const msgs = new Map<string, any>()
  if (ids.length) {
    const { data: ms } = await supabase.from('comunidad_mensajes').select('id, cuerpo, autor_id, borrado_por').in('id', ids)
    for (const m of (ms ?? []) as any[]) msgs.set(m.id, m)
  }
  return filas.map((f) => {
    const m = msgs.get(f.mensaje_id)
    return {
      id: f.id,
      mensajeId: f.mensaje_id,
      salaId: f.sala_id,
      reportadoPor: f.reportado_por,
      motivo: f.motivo ?? '',
      creadoEn: f.creado_en,
      cuerpo: m?.cuerpo ?? '',
      autorId: m?.autor_id ?? null,
      borrado: !!m?.borrado_por,
    }
  })
}

export async function resolverReporte(id: string, estado: 'resuelto' | 'descartado', adminId: string) {
  const { error } = await supabase
    .from('comunidad_reportes')
    .update({ estado, resuelto_por: adminId, resuelto_en: new Date().toISOString() })
    .eq('id', id)
  return error?.message ?? null
}

export async function listarSolicitudes(): Promise<SolicitudChat[]> {
  const { data } = await supabase
    .from('comunidad_miembros')
    .select('sala_id, user_id, creado_en')
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: false })
    .limit(200)
  return ((data ?? []) as any[]).map((f) => ({ salaId: f.sala_id, userId: f.user_id, creadoEn: f.creado_en }))
}

export async function contarPendientesChat(): Promise<number> {
  const [r, s] = await Promise.all([
    supabase.from('comunidad_reportes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('comunidad_miembros').select('user_id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
  ])
  return (r.count ?? 0) + (s.count ?? 0)
}

export function suscribirseAPendientesChat(alCambiar: () => void): () => void {
  let t: ReturnType<typeof setTimeout> | undefined
  const disparar = () => {
    clearTimeout(t)
    t = setTimeout(alCambiar, 300)
  }
  const canal = supabase
    .channel(`admin-chat-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comunidad_reportes' }, disparar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comunidad_miembros' }, disparar)
    .subscribe()
  return () => {
    clearTimeout(t)
    supabase.removeChannel(canal)
  }
}

export async function registrarAccion(
  adminId: string,
  tipo: string,
  detalle: string,
  ref: { salaId?: string | null; usuarioId?: string | null } = {},
) {
  await supabase
    .from('comunidad_acciones')
    .insert({ admin_id: adminId, tipo, detalle, sala_id: ref.salaId ?? null, usuario_id: ref.usuarioId ?? null })
}

export async function listarAcciones(limite = 150): Promise<AccionChat[]> {
  const { data } = await supabase
    .from('comunidad_acciones')
    .select('id, admin_id, tipo, sala_id, usuario_id, detalle, creado_en')
    .order('creado_en', { ascending: false })
    .limit(limite)
  return ((data ?? []) as any[]).map((f) => ({
    id: f.id,
    adminId: f.admin_id,
    tipo: f.tipo,
    salaId: f.sala_id,
    usuarioId: f.usuario_id,
    detalle: f.detalle ?? '',
    creadoEn: f.creado_en,
  }))
}

/** Limpieza de mensajes con más de `dias` días. ejecutar=false solo cuenta; true borra de verdad (queda en el registro). */
export async function limpiarMensajes(
  dias: number,
  salaId: string | null,
  incluirEquipo: boolean,
  ejecutar: boolean,
): Promise<{ n: number; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_chat_limpiar', {
    p_dias: dias,
    p_sala: salaId,
    p_incluir_equipo: incluirEquipo,
    p_ejecutar: ejecutar,
  })
  return { n: Number(data ?? 0), error: error?.message ?? null }
}
