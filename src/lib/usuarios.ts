import { supabase } from './supabase'
import type { RolAdmin } from './admin'

export interface Usuario {
  id: string
  email: string
  nickname: string | null
  creadoEn: string
  ultimoAcceso: string | null
  rolAdmin: RolAdmin | 'usuario'
  simulacros: number
  promedio: number | null
  vioTourBienvenida: boolean
  academiaHabilitada: boolean
}

interface FilaRpc {
  user_id: string
  email: string
  nickname: string | null
  creado_en: string
  ultimo_acceso: string | null
}

// admin_listar_usuarios() ya hace su propio chequeo de `admins` adentro
// (raise exception si auth.uid() no tiene fila ahí — admin o subadmin, ver
// migración admin_eliminar_usuario) — ver migración endurecer_rls_y_funciones.
// Acá se combina con `admins` (rol) y `historial_intentos` (actividad), que sí
// son legibles directo por RLS para un admin ("Ver historial propio o si es
// admin"). Nota: un subadmin que llame a esto (para resolver el correo del
// dueño de un ticket en Atención al cliente) solo ve su propia fila de
// `admins` por RLS — no le importa, `rolAdmin` no se usa fuera de la pantalla
// de Usuarios, que un subadmin nunca llega a ver.
export async function listarUsuarios(): Promise<Usuario[]> {
  const [
    { data: filas, error: errorUsuarios },
    { data: admins, error: errorAdmins },
    { data: intentos, error: errorIntentos },
    { data: perfiles, error: errorPerfiles },
  ] = await Promise.all([
    supabase.rpc('admin_listar_usuarios'),
    supabase.from('admins').select('user_id, tipo'),
    supabase.from('historial_intentos').select('user_id, porcentaje'),
    supabase.from('perfiles').select('user_id, vio_tour_bienvenida, academia_habilitada'),
  ])

  if (errorUsuarios) {
    console.error('Error al listar usuarios:', errorUsuarios.message)
    return []
  }
  if (errorAdmins) console.error('Error al listar admins:', errorAdmins.message)
  if (errorIntentos) console.error('Error al leer intentos para el resumen de usuarios:', errorIntentos.message)
  // No tener fila en `perfiles` es el caso esperado para casi todos hoy (la
  // tabla es nueva, sin backfill) — no es un error, simplemente vale 'No
  // visto' / 'No habilitada'.
  if (errorPerfiles) console.error('Error al leer perfiles (tour de bienvenida / acceso a Academia):', errorPerfiles.message)

  const rolPorUsuario = new Map<string, RolAdmin>((admins ?? []).map((fila) => [fila.user_id as string, fila.tipo as RolAdmin]))
  const tourVistoPorUsuario = new Map<string, boolean>(
    (perfiles ?? []).map((fila) => [fila.user_id as string, Boolean(fila.vio_tour_bienvenida)]),
  )
  const academiaHabilitadaPorUsuario = new Map<string, boolean>(
    (perfiles ?? []).map((fila) => [fila.user_id as string, Boolean(fila.academia_habilitada)]),
  )

  const resumenPorUsuario = new Map<string, { simulacros: number; sumaPorcentaje: number }>()
  for (const fila of intentos ?? []) {
    const uid = fila.user_id as string
    const acumulado = resumenPorUsuario.get(uid) ?? { simulacros: 0, sumaPorcentaje: 0 }
    acumulado.simulacros += 1
    acumulado.sumaPorcentaje += Number(fila.porcentaje) || 0
    resumenPorUsuario.set(uid, acumulado)
  }

  return ((filas ?? []) as FilaRpc[]).map((fila) => {
    const resumen = resumenPorUsuario.get(fila.user_id)
    return {
      id: fila.user_id,
      email: fila.email,
      nickname: fila.nickname,
      creadoEn: fila.creado_en,
      ultimoAcceso: fila.ultimo_acceso,
      rolAdmin: rolPorUsuario.get(fila.user_id) ?? 'usuario',
      simulacros: resumen?.simulacros ?? 0,
      promedio: resumen && resumen.simulacros > 0 ? Math.round(resumen.sumaPorcentaje / resumen.simulacros) : null,
      vioTourBienvenida: tourVistoPorUsuario.get(fila.user_id) ?? false,
      academiaHabilitada: academiaHabilitadaPorUsuario.get(fila.user_id) ?? false,
    }
  })
}

// RLS ("Solo admins agregan admins" / "Solo admins cambian el tipo de un
// admin") ya exige que quien ejecuta esto sea un admin completo — ver
// migraciones admins_pueden_gestionar_admins y agregar_rol_subadmin. El
// upsert cubre las cuatro transiciones con una sola llamada: Usuario→Admin y
// Usuario→Subadmin insertan la fila; Admin→Subadmin y Subadmin→Admin
// actualizan el `tipo` de la fila que ya existía. Si el objetivo es la propia
// cuenta de quien llama, la policy de UPDATE lo bloquea a propósito (no
// podés bajarte el rol a vos mismo) — la UI además deshabilita esa opción en
// el menú para no depender solo de eso.
export async function asignarRolAdmin(userId: string, tipo: RolAdmin): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('admins').upsert({ user_id: userId, tipo }, { onConflict: 'user_id' })
  if (error) {
    console.error('Error al asignar el rol de admin:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

// Quita todo acceso admin (sea nivel admin o subadmin) — vuelve a ser un
// usuario normal.
export async function revocarAdmin(userId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('admins').delete().eq('user_id', userId)
  if (error) {
    console.error('Error al quitar el acceso de administración:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

// A diferencia de `revocarAdmin` (que siempre borra una fila que ya existe en
// `admins`), acá casi nunca hay fila previa en
// `perfiles` — la tabla es nueva y sin backfill, así que la mayoría de los
// usuarios todavía no tienen una. Por eso es upsert (mismo patrón que usa el
// cliente en tourBienvenidaRemoto.ts): si no existe, la crea; si existe, la
// actualiza. Requiere la policy "Los admins crean cualquier perfil" además de
// la de update, si no, el insert de la primera vez lo rechaza RLS.
export async function marcarTourBienvenida(userId: string, visto: boolean): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('perfiles')
    .upsert({ user_id: userId, vio_tour_bienvenida: visto }, { onConflict: 'user_id' })
  if (error) {
    console.error('Error al actualizar el tour de bienvenida:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

// Mismo patrón de upsert que marcarTourBienvenida, sobre la misma tabla
// `perfiles`. La base también lo hace cumplir del otro lado: un trigger
// (migración proteger_academia_habilitada_solo_admin) descarta cualquier
// cambio a esta columna que no venga de una cuenta admin — así que aunque
// esta llamada la haga cualquier código, solo tiene efecto real si quien
// está autenticado es admin (que es siempre el caso acá, porque esta app
// entera está detrás del gate de admin).
export async function marcarAcademiaHabilitada(userId: string, habilitada: boolean): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('perfiles')
    .upsert({ user_id: userId, academia_habilitada: habilitada }, { onConflict: 'user_id' })
  if (error) {
    console.error('Error al actualizar el acceso a Academia:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

// Dispara el flujo estándar de Supabase Auth (manda un correo con el enlace
// para elegir contraseña nueva). No requiere permisos especiales — cualquier
// cuenta autenticada puede llamarlo para cualquier email, así que la
// protección real acá es de UI: solo se ofrece desde el menú de acciones del
// panel admin.
export async function restablecerContrasena(email: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) {
    console.error('Error al enviar el enlace de restablecimiento:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

// admin_eliminar_usuario() (migración admin_eliminar_usuario) ya valida que
// quien llama sea admin y que no se esté eliminando a sí mismo — acá solo se
// propaga el resultado. Al ser SECURITY DEFINER, hace el `delete from
// auth.users` con privilegios que el anon key nunca tiene.
export async function eliminarUsuario(userId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc('admin_eliminar_usuario', { objetivo_id: userId })
  if (error) {
    console.error('Error al eliminar usuario:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

const TLDS_CONOCIDOS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'info', 'io', 'co',
  'es', 'mx', 'ar', 'cl', 'pe', 'uy', 've', 'cu', 'do', 'pr', 'bo', 'ec', 'py',
])

// Señal liviana, no una validación real de correo: si el dominio termina en
// algo que no parece un TLD conocido (por ejemplo "gmail.coms" en vez de
// "gmail.com"), vale la pena que un admin le eche un ojo. Falsos positivos
// son aceptables acá — es solo un ícono de alerta, no bloquea nada.
export function emailPareceSospechoso(email: string): boolean {
  const dominio = email.split('@')[1]
  if (!dominio) return true
  const tld = dominio.split('.').pop()?.toLowerCase()
  return !tld || !TLDS_CONOCIDOS.has(tld)
}
