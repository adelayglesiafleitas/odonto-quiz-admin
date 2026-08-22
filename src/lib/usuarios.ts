import { supabase } from './supabase'

export interface Usuario {
  id: string
  email: string
  nickname: string | null
  creadoEn: string
  ultimoAcceso: string | null
  esAdmin: boolean
  simulacros: number
  promedio: number | null
}

interface FilaRpc {
  user_id: string
  email: string
  nickname: string | null
  creado_en: string
  ultimo_acceso: string | null
}

// admin_listar_usuarios() ya hace su propio chequeo de `admins` adentro
// (raise exception si auth.uid() no es admin) — ver migración
// endurecer_rls_y_funciones. Acá se combina con `admins` (rol) y
// `historial_intentos` (actividad), que sí son legibles directo por RLS
// para un admin ("Ver historial propio o si es admin").
export async function listarUsuarios(): Promise<Usuario[]> {
  const [{ data: filas, error: errorUsuarios }, { data: admins, error: errorAdmins }, { data: intentos, error: errorIntentos }] =
    await Promise.all([
      supabase.rpc('admin_listar_usuarios'),
      supabase.from('admins').select('user_id'),
      supabase.from('historial_intentos').select('user_id, porcentaje'),
    ])

  if (errorUsuarios) {
    console.error('Error al listar usuarios:', errorUsuarios.message)
    return []
  }
  if (errorAdmins) console.error('Error al listar admins:', errorAdmins.message)
  if (errorIntentos) console.error('Error al leer intentos para el resumen de usuarios:', errorIntentos.message)

  const idsAdmin = new Set((admins ?? []).map((fila) => fila.user_id as string))

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
      esAdmin: idsAdmin.has(fila.user_id),
      simulacros: resumen?.simulacros ?? 0,
      promedio: resumen && resumen.simulacros > 0 ? Math.round(resumen.sumaPorcentaje / resumen.simulacros) : null,
    }
  })
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
