import { supabase } from './supabase'
import { ASIGNATURAS_ADMIN, cursoIdsReales } from './preguntas'

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
  // null en intentos viejos, de antes de que existiera la columna (mismo
  // caso que desgloseCapitulos más arriba) — se ignoran al agrupar por
  // asignatura en agregarAsignaturas, no rompen el resto del historial.
  cursoId: string | null
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
  curso_id: string | null
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
    .select('fecha, total_preguntas, correctas, porcentaje, aprobado, capitulos, tiempo_usado_seg, agoto_tiempo, desglose_capitulos, curso_id')
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
    cursoId: fila.curso_id,
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

export interface AsignaturaResumen {
  cursoId: string
  nombre: string
  n: number
  aprobados: number
  promedio: number
  ultimaFecha: string
}

// curso_id real (tal como se guarda en historial_intentos) -> cursoId
// canónico de ASIGNATURAS_ADMIN. Reusa cursoIdsReales en vez de duplicar el
// mapeo a mano: hoy solo pliega `odontologia_libro` adentro de `odontologia`
// (ver claude/pacientes-especiales-libro-capitulo-diseno.md), pero si se
// agrega otro curso_id "alias" en el futuro, esto lo sigue automáticamente.
const CURSO_ID_A_CANONICO = new Map<string, string>(
  ASIGNATURAS_ADMIN.flatMap(({ cursoId }) => cursoIdsReales(cursoId).map((real) => [real, cursoId] as const)),
)

// Agrupa los intentos por asignatura para el panel de un usuario puntual —
// "¿qué está haciendo?", no solo "cuánto hizo en total". Solo devuelve
// asignaturas con al menos un intento (nada de listar en cero las que el
// usuario nunca tocó), en el mismo orden fijo que ASIGNATURAS_ADMIN.
export function agregarAsignaturas(intentos: Intento[]): AsignaturaResumen[] {
  const acumulado = new Map<string, { n: number; aprobados: number; sumaPorcentaje: number; ultimaFecha: string }>()
  for (const intento of intentos) {
    if (!intento.cursoId) continue
    const cursoId = CURSO_ID_A_CANONICO.get(intento.cursoId) ?? intento.cursoId
    const cur = acumulado.get(cursoId) ?? { n: 0, aprobados: 0, sumaPorcentaje: 0, ultimaFecha: intento.fecha }
    cur.n += 1
    if (intento.aprobado) cur.aprobados += 1
    cur.sumaPorcentaje += intento.porcentaje
    if (intento.fecha > cur.ultimaFecha) cur.ultimaFecha = intento.fecha
    acumulado.set(cursoId, cur)
  }

  return ASIGNATURAS_ADMIN.filter((a) => acumulado.has(a.cursoId)).map((a) => {
    const v = acumulado.get(a.cursoId)!
    return {
      cursoId: a.cursoId,
      nombre: a.nombre,
      n: v.n,
      aprobados: v.aprobados,
      promedio: Math.round(v.sumaPorcentaje / v.n),
      ultimaFecha: v.ultimaFecha,
    }
  })
}
