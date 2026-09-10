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
  cursoId: string
  asignatura: string
  numero: number
  capitulo: string | null
  anio: number | null
  pregunta: string
  opciones: Opcion[]
  bibliografia: string | null
  caso: string | null
  oculta: boolean
  actualizadoEn: string | null
  actualizadoPor: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPregunta(fila: any): Pregunta {
  return {
    id: fila.id,
    cursoId: fila.curso_id,
    asignatura: fila.asignatura,
    numero: fila.numero,
    capitulo: fila.capitulo,
    anio: fila.anio,
    pregunta: fila.pregunta,
    opciones: fila.opciones ?? [],
    bibliografia: fila.bibliografia,
    caso: fila.caso,
    oculta: fila.oculta ?? false,
    actualizadoEn: fila.actualizado_en,
    actualizadoPor: fila.actualizado_por,
  }
}

// Las 4 asignaturas reales de la app (mismo cursoId que usan lib/cursos.ts y
// lib/data.ts del lado del cliente, mismos nombres que ve el alumno en
// "¿Qué vas a examinar?" — ver lib/asignaturas.ts allá). Se fija esta lista
// acá en vez de calcularla con un SELECT distinct: `asignatura` (el texto de
// cada pregunta) no alcanza para esto porque "Examen Práctico" existe tanto
// en Pacientes Especiales como en Psicología con preguntas de casos
// clínicos distintas — la columna que sí distingue el banco real es
// `curso_id` (migración agregar_curso_id_preguntas). Además, calcular esta
// lista pidiendo filas se rompía en la práctica: PostgREST no devuelve más
// de 1000 filas por pedido, así que un SELECT sin acotar sobre 20 mil+ filas
// podía perderse asignaturas enteras (el bug real que se vio: "2
// Asignaturas" en vez de 4).
export const ASIGNATURAS_ADMIN: { cursoId: string; nombre: string }[] = [
  { cursoId: 'odontologia', nombre: 'Pacientes especiales' },
  { cursoId: 'psicologia', nombre: 'Psicología' },
  { cursoId: 'ortodoncia', nombre: 'Ortodoncia' },
  { cursoId: 'materiales', nombre: 'Materiales Odontológicos' },
]

export interface FiltrosPreguntas {
  cursoId: string | null
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

  if (filtros.cursoId) query = query.eq('curso_id', filtros.cursoId)
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

export interface AsignaturaConConteo {
  cursoId: string
  nombre: string
  total: number
}

// Conteo exacto por asignatura vía `count: 'exact', head: true` (4 pedidos
// en paralelo, uno por curso fijo de ASIGNATURAS_ADMIN) — nunca trae filas,
// así que no importa que Ortodoncia tenga 17k+: el número siempre es exacto.
export async function listarAsignaturasConConteo(): Promise<AsignaturaConConteo[]> {
  const resultados = await Promise.all(
    ASIGNATURAS_ADMIN.map(async ({ cursoId, nombre }) => {
      const { count, error } = await supabase
        .from('preguntas')
        .select('*', { count: 'exact', head: true })
        .eq('curso_id', cursoId)
      if (error) console.error(`Error al contar preguntas de "${cursoId}":`, error.message)
      return { cursoId, nombre, total: count ?? 0 }
    }),
  )
  return resultados
}

// DISTINCT hecho en la base (RPC preguntas_capitulos_distintos, migración
// rpc_preguntas_capitulos_distintos) en vez de pedir la columna `capitulo`
// de todas las filas del curso y sacar los valores únicos acá — con
// Ortodoncia (17k+ preguntas) esa segunda forma corre el mismo riesgo que ya
// causó el bug de "2 Asignaturas": PostgREST no devuelve más de 1000 filas
// por pedido, así que podría faltar un capítulo que solo aparece más allá de
// la fila 1000.
export async function listarCapitulos(cursoId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('preguntas_capitulos_distintos', { p_curso_id: cursoId })
  if (error) {
    console.error('Error al listar capítulos:', error.message)
    return []
  }
  return ((data ?? []) as { capitulo: string | null }[]).map((f) => f.capitulo).filter((c): c is string => c != null)
}

export interface EstadisticasPreguntas {
  total: number
  totalAsignaturas: number
  editadasUltimos7Dias: number
}

export async function obtenerEstadisticas(): Promise<EstadisticasPreguntas> {
  const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ count: total }, { count: editadas }] = await Promise.all([
    supabase.from('preguntas').select('*', { count: 'exact', head: true }),
    supabase.from('preguntas').select('*', { count: 'exact', head: true }).gte('actualizado_en', hace7Dias),
  ])
  // Fija, no calculada — ver el comentario de ASIGNATURAS_ADMIN más arriba.
  return { total: total ?? 0, totalAsignaturas: ASIGNATURAS_ADMIN.length, editadasUltimos7Dias: editadas ?? 0 }
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
// `tickets`), no el id ni el curso_id de `preguntas` — así que se busca por
// el índice único (asignatura, numero) que crea la migración
// crear_tabla_preguntas. Esa pareja sigue siendo única fila por fila aunque
// el texto "asignatura" se repita entre cursos, así que esta búsqueda es
// correcta tal cual está.
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

// "Ocultar" (columna `oculta`, migración agregar_oculta_preguntas) es
// reversible y sin confirmación: la pregunta deja de salir en los exámenes
// (lib/data.ts del cliente filtra `oculta = false`) pero sigue en esta tabla,
// atenuada, para poder volver a mostrarla con el mismo botón. Pensado para
// sacar de circulación una pregunta problemática sin perder el trabajo de
// haberla cargado — ver claude/preguntas-tabla-editor-admin.md.
export async function alternarOcultaPregunta(id: string, oculta: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('preguntas').update({ oculta }).eq('id', id)
  if (error) {
    console.error('Error al ocultar/mostrar la pregunta:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

// A diferencia de ocultar, esto borra la fila para siempre — por eso el
// modal de confirmación vive en la pantalla, no acá. Protegido por la misma
// RLS que `actualizarPregunta` (solo `es_admin()` puede).
export async function eliminarPregunta(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('preguntas').delete().eq('id', id)
  if (error) {
    console.error('Error al eliminar la pregunta:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

// Señal liviana para avisarle a quien edita que algo puede estar mal, no una
// validación real. Nació del caso real de claude/fix-texto-contaminado-copyright-materiales.md:
// texto de copyright/marca de agua pegado en una opción, mucho más larga que
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
