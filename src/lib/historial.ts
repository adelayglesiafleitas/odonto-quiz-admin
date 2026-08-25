import { supabase } from './supabase'

export interface Intento {
  fecha: string
  totalPreguntas: number
  correctas: number
  porcentaje: number
  aprobado: boolean
  capitulos: string[]
  tiempoUsadoSeg: number
  agotoTiempo: boolean
  desgloseCapitulos: Record<string, { total: number; correctas: number }> | null
}

interface FilaHistorial {
  fecha: string
  total_preguntas: number
  correctas: number
  porcentaje: number | string
  aprobado: boolean
  capitulos: string[]
  tiempo_usado_seg: number
  agoto_tiempo: boolean
  desglose_capitulos: Record<string, { total: number; correctas: number }> | null
}

// RLS ("Ver historial propio o si es admin", tabla historial_intentos) ya
// deja que un admin lea el historial de cualquier usuario en forma directa
// — a diferencia de admin_listar_usuarios(), acá no hace falta una función
// RPC porque no se toca auth.users. Se pide bajo demanda, solo cuando se
// abre el panel de estadísticas de un usuario puntual, no junto con la
// lista completa (esa sigue trayendo nada más el resumen agregado, ver
// listarUsuarios en lib/usuarios.ts).
export async function obtenerHistorialUsuario(userId: string): Promise<Intento[]> {
  const { data, error } = await supabase
    .from('historial_intentos')
    .select('fecha, total_preguntas, correctas, porcentaje, aprobado, capitulos, tiempo_usado_seg, agoto_tiempo, desglose_capitulos')
    .eq('user_id', userId)
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Error al leer el historial del usuario:', error.message)
    return []
  }

  return ((data ?? []) as FilaHistorial[]).map((fila) => ({
    fecha: fila.fecha,
    totalPreguntas: fila.total_preguntas,
    correctas: fila.correctas,
    porcentaje: Number(fila.porcentaje) || 0,
    aprobado: fila.aprobado,
    capitulos: fila.capitulos,
    tiempoUsadoSeg: fila.tiempo_usado_seg,
    agotoTiempo: fila.agoto_tiempo,
    desgloseCapitulos: fila.desglose_capitulos,
  }))
}

export interface TemaResumen {
  tema: string
  total: number
  correctas: number
  pct: number
}

// Suma correctas/total por tema a través de todos los intentos que tienen
// desglose_capitulos (los intentos previos a esa columna quedan afuera del
// agregado, no hay con qué reconstruirlos). Se filtra a temas con al menos
// `minPreguntas` preguntas vistas en total para no mostrar un 0%/100% que en
// realidad sale de una sola pregunta — y se ordena de peor a mejor precisión,
// que es la lectura útil para un admin: dónde está fallando cada usuario.
export function agregarTemas(intentos: Intento[], minPreguntas = 5): TemaResumen[] {
  const acumulado = new Map<string, { total: number; correctas: number }>()
  for (const intento of intentos) {
    if (!intento.desgloseCapitulos) continue
    for (const [tema, v] of Object.entries(intento.desgloseCapitulos)) {
      const cur = acumulado.get(tema) ?? { total: 0, correctas: 0 }
      cur.total += v.total
      cur.correctas += v.correctas
      acumulado.set(tema, cur)
    }
  }
  return [...acumulado.entries()]
    .map(([tema, v]) => ({
      tema,
      total: v.total,
      correctas: v.correctas,
      pct: v.total ? Math.round((v.correctas / v.total) * 100) : 0,
    }))
    .filter((t) => t.total >= minPreguntas)
    .sort((a, b) => a.pct - b.pct)
}
