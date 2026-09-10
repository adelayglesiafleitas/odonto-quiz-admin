import { supabase } from './supabase'

// Banco de preguntas: antes vivía como JSON estático embebido en la app del
// cliente (src/data/*.json); ahora vive en la tabla `preguntas` de Supabase
// para que se pueda editar desde este panel sin tocar código ni JSON. Ver
// claude/panel-revision-admin.md y la migración crear_tabla_preguntas.
//
// RLS de `preguntas` (migración crear_tabla_preguntas): lectura pública para
// cualquier usuario autenticado, escritura (insert/update/delete) solo para
// `es_admin()`. Acá adentro no hace falta chequear nada — si quien llama no
// es admin, el `update` de abajo simplemente no afecta ninguna fila.

export interface Opcion {
  letra: string
  texto: string
  correcta: boolean
}

export interface Pregunta {
  id: string
  asignatura: string
  numero: number
  capitulo: string | null
  anio: number | null
  pregunta: string
  opciones: Opcion[]
  bibliografia: string | null
  caso: string | null
  actualizadoEn: string | null
  actualizadoPor: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPregunta(fila: any): Pregunta {
  return {
    id: fila.id,
    asignatura: fila.asignatura,
    numero: fila.numero,
    capitulo: fila.capitulo,
    anio: fila.anio,
    pregunta: fila.pregunta,
    opciones: fila.opciones ?? [],
    bibliografia: fila.bibliografia,
    caso: fila.caso,
    actualizadoEn: fila.actualizado_en,
    actualizadoPor: fila.actualizado_por,
  }
}

export interface FiltrosPreguntas {
  asignatura: string | null
  capitulo?: string | null
  busqueda?: string
  pagina: number
  porPagina: number
}

export interface ResultadoPreguntas {
  preguntas: Pregunta[]
  total: number
}

// Todo filtrado/paginado se hace en el servidor (Postgres), nunca trayendo
// la tabla entera al navegador — Ortodoncia sola tiene más de 17 mil filas.
// Por eso `listarPreguntas` siempre pide un `range` y nunca ".select('*')"
// sin límite.
export async function listarPreguntas(filtros: FiltrosPreguntas): Promise<ResultadoPreguntas> {
  const desde = filtros.pagina * filtros.porPagina
  const hasta = desde + filtros.porPagina - 1

  let query = supabase.from('preguntas').select('*', { count: 'exact' })

  if (filtros.asignatura) query = query.eq('asignatura', filtros.asignatura)
  if (filtros.capitulo) query = query.eq('capitulo', filtros.capitulo)

  const busqueda = filtros.busqueda?.trim()
  if (busqueda) {
    if (/^\d+$/.test(busqueda)) {
      query = query.eq('numero', Number(busqueda))
    } else {
      query = query.ilike('pregunta', `%${busqueda}%`)
    }
  }

  const { data, error, count } = await query.order('numero', { ascending: true }).range(desde, hasta)

  if (error) {
    console.error('Error al listar preguntas:', error.message)
    return { preguntas: [], total: 0 }
  }
  return { preguntas: (data ?? []).map(mapPregunta), total: count ?? 0 }
}

export async function listarAsignaturas(): Promise<string[]> {
  const { data, error } = await supabase.from('preguntas').select('asignatura').order('asignatura')
  if (error) {
    console.error('Error al listar asignaturas:', error.message)
    return []
  }
  return Array.from(new Set((data ?? []).map((f) => f.asignatura as string)))
}

export async function listarCapitulos(asignatura: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('preguntas')
    .select('capitulo')
    .eq('asignatura', asignatura)
    .not('capitulo', 'is', null)
  if (error) {
    console.error('Error al listar capítulos:', error.message)
    return []
  }
  return Array.from(new Set((data ?? []).map((f) => f.capitulo as string))).sort()
}

export interface EstadisticasPreguntas {
  total: number
  totalAsignaturas: number
  editadasUltimos7Dias: number
}

export async function obtenerEstadisticas(): Promise<EstadisticasPreguntas> {
  const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ count: total }, { data: asignaturas }, { count: editadas }] = await Promise.all([
    supabase.from('preguntas').select('*', { count: 'exact', head: true }),
    supabase.from('preguntas').select('asignatura'),
    supabase.from('preguntas').select('*', { count: 'exact', head: true }).gte('actualizado_en', hace7Dias),
  ])
  const totalAsignaturas = new Set((asignaturas ?? []).map((f) => f.asignatura as string)).size
  return { total: total ?? 0, totalAsignaturas, editadasUltimos7Dias: editadas ?? 0 }
}

export async function obtenerPregunta(id: string): Promise<Pregunta | null> {
  const { data, error } = await supabase.from('preguntas').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('Error al obtener la pregunta:', error.message)
    return null
  }
  return data ? mapPregunta(data) : null
}

// Para el botón "Editar esta pregunta" dentro de un ticket: el ticket solo
// guarda asignatura + número (pregunta_asignatura / pregunta_numero en
// `tickets`), no el id de `preguntas` — así que se busca por el índice único
// (asignatura, numero) que crea la migración crear_tabla_preguntas.
export async function buscarPreguntaPorAsignaturaYNumero(asignatura: string, numero: number): Promise<Pregunta | null> {
  const { data, error } = await supabase
    .from('preguntas')
    .select('*')
    .eq('asignatura', asignatura)
    .eq('numero', numero)
    .maybeSingle()
  if (error) {
    console.error('Error al buscar la pregunta del ticket:', error.message)
    return null
  }
  return data ? mapPregunta(data) : null
}

export interface CambiosPregunta {
  pregunta: string
  opciones: Opcion[]
}

// El trigger `preguntas_actualizada` (migración crear_tabla_preguntas) ya
// pone `actualizado_en`/`actualizado_por` solo — acá no hace falta mandarlos.
export async function actualizarPregunta(id: string, cambios: CambiosPregunta): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('preguntas')
    .update({ pregunta: cambios.pregunta, opciones: cambios.opciones })
    .eq('id', id)
  if (error) {
    console.error('Error al guardar la pregunta:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

// Señal liviana para avisarle a quien edita que algo puede estar mal, no una
// validación real. Nació del caso real de claude/fix-texto-contaminado-copyright-materiales.md:
// texto de copyright/marca de agua pegado en una opción, mucho más largo que
// las demás. Falsos positivos son aceptables — es solo un aviso, no bloquea.
export function detectarAnomalias(p: Pick<Pregunta, 'opciones'>): string[] {
  const avisos: string[] = []
  const textos = p.opciones.map((o) => o.texto.trim())
  const longitudes = textos.map((t) => t.length)
  const promedio = longitudes.reduce((a, b) => a + b, 0) / (longitudes.length || 1)

  p.opciones.forEach((o, i) => {
    const largo = longitudes[i]
    if (promedio > 0 && largo > promedio * 3 && largo - promedio > 60) {
      avisos.push(`La opción ${o.letra} es mucho más larga que las demás — revisá si tiene texto pegado de más.`)
    }
    if (/copyright|derechos reservados|www\.|\.com\b/i.test(o.texto)) {
      avisos.push(`La opción ${o.letra} parece contener texto ajeno a la pregunta (copyright, URL).`)
    }
  })

  const marcadasCorrectas = p.opciones.filter((o) => o.correcta).length
  if (marcadasCorrectas === 0) avisos.push('Ninguna opción está marcada como correcta.')
  if (marcadasCorrectas > 1) avisos.push('Hay más de una opción marcada como correcta.')

  return avisos
}
