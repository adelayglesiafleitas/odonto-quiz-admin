import { supabase } from './supabase'
import type { Usuario } from './usuarios'
import type { Ticket, EstadoTicket } from './tickets'
import { ASIGNATURAS_ADMIN, cursoIdsReales } from './preguntas'
import { colorAsignatura, type ColorAsignatura } from './coloresAsignatura'

// Estadísticas agregadas de uso e interacción para el admin (ver
// claude/estadisticas-admin-diseno.md en el proyecto de Claude). Todo se
// calcula en el cliente a partir de consultas simples — mismo criterio que
// PanelEstadisticasUsuario.tsx (sin RPCs nuevas, sin librería de gráficos),
// razonable a esta escala (decenas/cientos de filas, no millones).

const MS_DIA = 24 * 60 * 60 * 1000

const NOMBRE_CURSO: Record<string, string> = {
  odontologia: 'Pacientes especiales',
  psicologia: 'Psicología',
  ortodoncia: 'Ortodoncia',
}

const NOMBRE_MOTIVO: Record<string, string> = {
  pregunta: 'Pregunta reportada',
  cuenta: 'Cuenta',
  pagos: 'Pagos',
  otro: 'Otro',
}

function fechaCorta(iso: string): string {
  return iso.slice(0, 10)
}

export interface PuntoSerie {
  fecha: string
  valor: number
}

export interface UsuarioDormido {
  id: string
  email: string
  nickname: string | null
  ultimoUso: string | null
  diasInactivo: number | null
}

export interface RankingItem {
  clave: string
  nombre: string
  cantidad: number
  pct: number
  // Opcional — cuando se completa, el `Ranking` de Estadisticas.tsx pinta ese
  // ítem con el color fijo de la asignatura (mismo mapa que usa la columna
  // "Asignatura" en AtencionCliente.tsx) en vez del celeste por defecto.
  color?: ColorAsignatura
}

export interface PreguntaReportada {
  numero: number
  asignatura: string
  capitulo: string | null
  veces: number
  estado: EstadoTicket
}

export interface CapituloReporteVsFallo {
  capitulo: string
  asignatura: string
  reportes: number
  // null cuando ese capítulo todavía no tiene suficientes intentos con
  // desglose (mismo mínimo de 3 preguntas vistas que usa capitulosMasFallos).
  pctFalladoReal: number | null
  enAmbosRankings: boolean
}

export interface ResolucionAsignatura {
  asignatura: string
  color: ColorAsignatura
  abiertos: number
  resueltos: number
  total: number
}

export interface MensajeAlcance {
  id: string
  tipo: 'texto' | 'texto_foto' | 'video'
  resumen: string
  audiencia: number
  vistos: number
  creadoEn: string
}

export interface EstadisticasApp {
  actividad: {
    hoy: number
    semana: number
    mes: number
    serieIntentosPorUsuario: PuntoSerie[]
  }
  dormidos: UsuarioDormido[]
  intentosPorDia: PuntoSerie[]
  aprobacion: {
    aprobados: number
    desaprobados: number
    total: number
    pctAprobados: number
  }
  materias: RankingItem[]
  tiempoAgotado: {
    pct: number
    agotados: number
    conTiempo: number
  }
  capitulosMasFallos: RankingItem[]
  // Bloque "Reportes de errores" (2026-09-13) — de los tickets con
  // origen='pregunta', ver claude/atencion-cliente-diseno.md /
  // claude/estadisticas-admin-diseno.md.
  reportesPorAsignatura: RankingItem[]
  preguntasMasReportadas: PreguntaReportada[]
  capitulosReportadoVsFallado: CapituloReporteVsFallo[]
  resolucionReportesPorAsignatura: ResolucionAsignatura[]
  preguntasOcultasPorAsignatura: RankingItem[]
  onboarding: {
    vieron: number
    total: number
    pct: number
  }
  embudo: {
    registrados: number
    vioTour: number
    primerSimulacro: number
  }
  soporte: {
    abiertos: number
    resueltos: number
    promedioRespuestaHoras: number | null
    porMotivo: RankingItem[]
  }
  alcanceMensajes: MensajeAlcance[]
  crecimiento: PuntoSerie[]
}

function ultimosNDias(n: number): string[] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dias: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    dias.push(fechaCorta(new Date(hoy.getTime() - i * MS_DIA).toISOString()))
  }
  return dias
}

export async function obtenerEstadisticas(usuarios: Usuario[], tickets: Ticket[]): Promise<EstadisticasApp> {
  const [
    { data: dispositivos, error: errorDispositivos },
    { data: intentos, error: errorIntentos },
    { data: mensajesTicket, error: errorMensajesTicket },
    { data: mensajesAdmin, error: errorMensajesAdmin },
    { data: descartes, error: errorDescartes },
  ] = await Promise.all([
    supabase.from('dispositivos_activos').select('user_id, ultimo_uso'),
    supabase
      .from('historial_intentos')
      .select('user_id, fecha, curso_id, aprobado, agoto_tiempo, tiempo_limite_minutos, desglose_capitulos'),
    supabase.from('mensajes').select('ticket_id, autor_id, created_at'),
    supabase
      .from('mensajes_admin')
      .select('id, tipo, texto, destinatario_user_id, creado_en')
      .order('creado_en', { ascending: false }),
    supabase.from('mensajes_admin_descartados').select('mensaje_id, user_id'),
  ])

  if (errorDispositivos) console.error('Error al leer dispositivos activos:', errorDispositivos.message)
  if (errorIntentos) console.error('Error al leer historial de intentos:', errorIntentos.message)
  if (errorMensajesTicket) console.error('Error al leer mensajes de tickets:', errorMensajesTicket.message)
  if (errorMensajesAdmin) console.error('Error al leer mensajes del admin:', errorMensajesAdmin.message)
  if (errorDescartes) console.error('Error al leer descartes de mensajes:', errorDescartes.message)

  const filasDispositivos = dispositivos ?? []
  const filasIntentos = intentos ?? []
  const filasMensajesTicket = mensajesTicket ?? []
  const filasMensajesAdmin = mensajesAdmin ?? []
  const filasDescartes = descartes ?? []

  // ---- 1. Actividad: hoy/semana/mes desde dispositivos_activos.ultimo_uso
  // (última vez que ESE dispositivo se usó — señal real de uso, no de login
  // de Supabase Auth, que puede no repetirse en cada apertura de la app). ----
  const ultimoUsoPorUsuario = new Map<string, number>()
  for (const fila of filasDispositivos) {
    const uid = fila.user_id as string
    const t = new Date(fila.ultimo_uso as string).getTime()
    const actual = ultimoUsoPorUsuario.get(uid)
    if (actual === undefined || t > actual) ultimoUsoPorUsuario.set(uid, t)
  }
  const ahora = Date.now()
  let hoy = 0
  let semana = 0
  let mes = 0
  for (const t of ultimoUsoPorUsuario.values()) {
    const dias = (ahora - t) / MS_DIA
    if (dias <= 1) hoy++
    if (dias <= 7) semana++
    if (dias <= 30) mes++
  }

  // Serie diaria de "usuarios con al menos un intento" (proxy de actividad
  // real por día — dispositivos_activos solo guarda el último uso, no un
  // historial día a día, así que para la tendencia usamos intentos, que sí
  // tienen fecha por evento).
  const dias30 = ultimosNDias(30)
  const usuariosPorDia = new Map<string, Set<string>>(dias30.map((d) => [d, new Set<string>()]))
  for (const fila of filasIntentos) {
    const d = fechaCorta(fila.fecha as string)
    usuariosPorDia.get(d)?.add(fila.user_id as string)
  }
  const serieIntentosPorUsuario: PuntoSerie[] = dias30.map((d) => ({ fecha: d, valor: usuariosPorDia.get(d)?.size ?? 0 }))

  // ---- 2. Usuarios dormidos: sin uso hace 7+ días (o nunca registrado en
  // dispositivos_activos). ----
  const dormidos: UsuarioDormido[] = usuarios
    .map((u) => {
      const t = ultimoUsoPorUsuario.get(u.id)
      const diasInactivo = t !== undefined ? Math.floor((ahora - t) / MS_DIA) : null
      return {
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        ultimoUso: t !== undefined ? new Date(t).toISOString() : null,
        diasInactivo,
      }
    })
    .filter((u) => u.diasInactivo === null || u.diasInactivo >= 7)
    .sort((a, b) => (b.diasInactivo ?? Infinity) - (a.diasInactivo ?? Infinity))

  // ---- 3. Intentos por día (últimos 14 días). ----
  const dias14 = ultimosNDias(14)
  const intentosPorDiaMap = new Map<string, number>(dias14.map((d) => [d, 0]))
  for (const fila of filasIntentos) {
    const d = fechaCorta(fila.fecha as string)
    if (intentosPorDiaMap.has(d)) intentosPorDiaMap.set(d, (intentosPorDiaMap.get(d) ?? 0) + 1)
  }
  const intentosPorDia: PuntoSerie[] = dias14.map((d) => ({ fecha: d, valor: intentosPorDiaMap.get(d) ?? 0 }))

  // ---- 4. Aprobación global + materias más/menos practicadas. ----
  const totalIntentos = filasIntentos.length
  const aprobados = filasIntentos.filter((f) => f.aprobado === true).length
  const porCurso = new Map<string, number>()
  for (const fila of filasIntentos) {
    const c = fila.curso_id as string
    porCurso.set(c, (porCurso.get(c) ?? 0) + 1)
  }
  const materias: RankingItem[] = Array.from(porCurso.entries())
    .map(([curso, cantidad]) => ({
      clave: curso,
      nombre: NOMBRE_CURSO[curso] ?? curso,
      cantidad,
      pct: totalIntentos > 0 ? Math.round((cantidad / totalIntentos) * 100) : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // ---- 5. % que agota el tiempo (de los intentos CON límite de tiempo). ----
  const conTiempo = filasIntentos.filter((f) => f.tiempo_limite_minutos !== null).length
  const agotados = filasIntentos.filter((f) => f.agoto_tiempo === true).length

  // ---- 6. Capítulos con más fallos, agregado entre todos los usuarios. ----
  const acumCapitulos = new Map<string, { correctas: number; total: number }>()
  for (const fila of filasIntentos) {
    const desglose = fila.desglose_capitulos as Record<string, { correctas: number; total: number }> | null
    if (!desglose) continue
    for (const [capitulo, { correctas, total }] of Object.entries(desglose)) {
      const acumulado = acumCapitulos.get(capitulo) ?? { correctas: 0, total: 0 }
      acumulado.correctas += correctas
      acumulado.total += total
      acumCapitulos.set(capitulo, acumulado)
    }
  }
  const capitulosMasFallos: RankingItem[] = Array.from(acumCapitulos.entries())
    // Mínimo de preguntas vistas para que un capítulo entre al ranking —
    // evita que un capítulo con 1 sola pregunta vista (y fallada) parezca el
    // peor de todos.
    .filter(([, { total }]) => total >= 3)
    .map(([capitulo, { correctas, total }]) => ({
      clave: capitulo,
      nombre: capitulo,
      cantidad: total,
      pct: Math.round((1 - correctas / total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6)

  // ---- 7 a 11. Reportes de errores (tickets con origen='pregunta'),
  // agregados por asignatura — bloque agregado 2026-09-13, ver
  // claude/atencion-cliente-diseno.md. Ninguno de estos 5 pide RPC nueva:
  // 7-10 salen de `tickets` (ya vienen como prop), 11 hace un puñado de
  // COUNT exactos sobre `preguntas` sin traer filas (mismo patrón que
  // `listarAsignaturasConConteo` en lib/preguntas.ts).
  const ticketsPregunta = tickets.filter((t) => t.origen === 'pregunta')

  // 7. Asignaturas con más reportes.
  const reportesPorAsignaturaMap = new Map<string, number>()
  for (const t of ticketsPregunta) {
    const a = t.preguntaAsignatura ?? 'Sin asignatura'
    reportesPorAsignaturaMap.set(a, (reportesPorAsignaturaMap.get(a) ?? 0) + 1)
  }
  const totalReportesPregunta = ticketsPregunta.length
  const reportesPorAsignatura: RankingItem[] = Array.from(reportesPorAsignaturaMap.entries())
    .map(([asignatura, cantidad]) => ({
      clave: asignatura,
      nombre: asignatura,
      cantidad,
      pct: totalReportesPregunta > 0 ? Math.round((cantidad / totalReportesPregunta) * 100) : 0,
      color: colorAsignatura(asignatura),
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // 8. Preguntas más reportadas — misma (asignatura, número) en más de un
  // ticket. Se queda con el capítulo/estado del ticket más reciente de cada
  // pregunta, pero cuenta TODOS los tickets de esa pregunta en `veces`.
  const porPreguntaMap = new Map<
    string,
    { asignatura: string; capitulo: string | null; numero: number; veces: number; estado: EstadoTicket; actividad: string }
  >()
  for (const t of ticketsPregunta) {
    if (t.preguntaNumero == null || !t.preguntaAsignatura) continue
    const clave = `${t.preguntaAsignatura}__${t.preguntaNumero}`
    const actual = porPreguntaMap.get(clave)
    if (!actual || new Date(t.ultimaActividadEn).getTime() > new Date(actual.actividad).getTime()) {
      porPreguntaMap.set(clave, {
        asignatura: t.preguntaAsignatura,
        capitulo: t.preguntaCapitulo,
        numero: t.preguntaNumero,
        veces: (actual?.veces ?? 0) + 1,
        estado: t.estado,
        actividad: t.ultimaActividadEn,
      })
    } else {
      actual.veces += 1
    }
  }
  const preguntasMasReportadas: PreguntaReportada[] = Array.from(porPreguntaMap.values())
    .filter((p) => p.veces >= 2)
    .sort((a, b) => b.veces - a.veces)
    .slice(0, 8)
    .map((p) => ({ numero: p.numero, asignatura: p.asignatura, capitulo: p.capitulo, veces: p.veces, estado: p.estado }))

  // 9. Reportado vs. fallado real, por capítulo — cruza el conteo de
  // reportes de este bloque con `acumCapitulos` (ya calculado arriba para el
  // widget 6, mismo mínimo de 3 preguntas vistas para dar un % real).
  const reportesPorCapituloMap = new Map<string, { asignatura: string; reportes: number }>()
  for (const t of ticketsPregunta) {
    if (!t.preguntaCapitulo) continue
    const actual = reportesPorCapituloMap.get(t.preguntaCapitulo) ?? { asignatura: t.preguntaAsignatura ?? 'Sin asignatura', reportes: 0 }
    actual.reportes += 1
    reportesPorCapituloMap.set(t.preguntaCapitulo, actual)
  }
  const capitulosMasFalladosClaves = new Set(capitulosMasFallos.map((c) => c.clave))
  const capitulosReportadoVsFallado: CapituloReporteVsFallo[] = Array.from(reportesPorCapituloMap.entries())
    .map(([capitulo, { asignatura, reportes }]) => {
      const real = acumCapitulos.get(capitulo)
      const pctFalladoReal = real && real.total >= 3 ? Math.round((1 - real.correctas / real.total) * 100) : null
      return { capitulo, asignatura, reportes, pctFalladoReal, enAmbosRankings: capitulosMasFalladosClaves.has(capitulo) }
    })
    .sort((a, b) => b.reportes - a.reportes)
    .slice(0, 8)

  // 10. Resolución de reportes, por asignatura (abiertos/en_progreso vs.
  // resuelto) — mismo criterio de "resuelto" que el widget 9 global.
  const resolucionMap = new Map<string, { abiertos: number; resueltos: number }>()
  for (const t of ticketsPregunta) {
    const a = t.preguntaAsignatura ?? 'Sin asignatura'
    const actual = resolucionMap.get(a) ?? { abiertos: 0, resueltos: 0 }
    if (t.estado === 'resuelto') actual.resueltos += 1
    else actual.abiertos += 1
    resolucionMap.set(a, actual)
  }
  const resolucionReportesPorAsignatura: ResolucionAsignatura[] = Array.from(resolucionMap.entries())
    .map(([asignatura, { abiertos, resueltos }]) => ({
      asignatura,
      color: colorAsignatura(asignatura),
      abiertos,
      resueltos,
      total: abiertos + resueltos,
    }))
    .sort((a, b) => b.total - a.total)

  // 11. Preguntas ocultas, por asignatura — usa `curso_id` (no el texto
  // `asignatura`) porque es el único campo con conteo exacto garantizado sin
  // traer filas (ver comentario de ASIGNATURAS_ADMIN en lib/preguntas.ts);
  // por eso los nombres acá son los "de curso" (ej. "Pacientes especiales"),
  // levemente distintos del texto que usan los tickets/preguntas sueltas.
  const conteosOcultas = await Promise.all(
    ASIGNATURAS_ADMIN.map(async ({ cursoId, nombre }) => {
      const ids = cursoIdsReales(cursoId)
      const [{ count: total, error: errorTotal }, { count: ocultas, error: errorOcultas }] = await Promise.all([
        supabase.from('preguntas').select('*', { count: 'exact', head: true }).in('curso_id', ids),
        supabase.from('preguntas').select('*', { count: 'exact', head: true }).in('curso_id', ids).eq('oculta', true),
      ])
      if (errorTotal) console.error(`Error al contar preguntas de "${cursoId}":`, errorTotal.message)
      if (errorOcultas) console.error(`Error al contar ocultas de "${cursoId}":`, errorOcultas.message)
      return { cursoId, nombre, total: total ?? 0, ocultas: ocultas ?? 0 }
    }),
  )
  const preguntasOcultasPorAsignatura: RankingItem[] = conteosOcultas
    .filter((c) => c.total > 0)
    .map((c) => ({
      clave: c.cursoId,
      nombre: c.nombre,
      cantidad: c.ocultas,
      pct: c.total > 0 ? Math.round((c.ocultas / c.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  // ---- 12 y 13 (antes 7 y 8). Onboarding (tour) + embudo de activación. ----
  const registrados = usuarios.length
  const vioTour = usuarios.filter((u) => u.vioTourBienvenida).length
  const idsConIntento = new Set(filasIntentos.map((f) => f.user_id as string))
  const primerSimulacro = usuarios.filter((u) => idsConIntento.has(u.id)).length

  // ---- 14. Soporte agregado (antes 9). ----
  const abiertos = tickets.filter((t) => t.estado === 'abierto' || t.estado === 'en_progreso').length
  const resueltos = tickets.filter((t) => t.estado === 'resuelto').length
  const porMotivoMap = new Map<string, number>()
  for (const t of tickets) {
    porMotivoMap.set(t.origen, (porMotivoMap.get(t.origen) ?? 0) + 1)
  }
  const porMotivo: RankingItem[] = Array.from(porMotivoMap.entries())
    .map(([motivo, cantidad]) => ({
      clave: motivo,
      nombre: NOMBRE_MOTIVO[motivo] ?? motivo,
      cantidad,
      pct: tickets.length > 0 ? Math.round((cantidad / tickets.length) * 100) : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const ticketsPorId = new Map(tickets.map((t) => [t.id, t] as const))
  const mensajesPorTicket = new Map<string, { autorId: string; creadoEn: string }[]>()
  for (const fila of filasMensajesTicket) {
    const tid = fila.ticket_id as string
    const lista = mensajesPorTicket.get(tid) ?? []
    lista.push({ autorId: fila.autor_id as string, creadoEn: fila.created_at as string })
    mensajesPorTicket.set(tid, lista)
  }
  const tiemposRespuestaHoras: number[] = []
  for (const [ticketId, mensajesTicketOrdenados] of mensajesPorTicket) {
    const ticket = ticketsPorId.get(ticketId)
    if (!ticket) continue
    const ordenados = [...mensajesTicketOrdenados].sort(
      (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
    )
    const primeraRespuestaAdmin = ordenados.find((m) => m.autorId !== ticket.usuarioId)
    if (primeraRespuestaAdmin) {
      const horas = (new Date(primeraRespuestaAdmin.creadoEn).getTime() - new Date(ticket.creadoEn).getTime()) / (1000 * 60 * 60)
      if (horas >= 0) tiemposRespuestaHoras.push(horas)
    }
  }
  const promedioRespuestaHoras =
    tiemposRespuestaHoras.length > 0
      ? Math.round((tiemposRespuestaHoras.reduce((a, b) => a + b, 0) / tiemposRespuestaHoras.length) * 10) / 10
      : null

  // ---- 15. Alcance de los mensajes del admin (antes 10). ----
  const vistosPorMensaje = new Map<string, Set<string>>()
  for (const fila of filasDescartes) {
    const mid = fila.mensaje_id as string
    const set = vistosPorMensaje.get(mid) ?? new Set<string>()
    set.add(fila.user_id as string)
    vistosPorMensaje.set(mid, set)
  }
  const alcanceMensajes: MensajeAlcance[] = filasMensajesAdmin.map((fila) => {
    const destinatario = fila.destinatario_user_id as string | null
    const audiencia = destinatario ? 1 : Math.max(registrados, 1)
    const vistosSet = vistosPorMensaje.get(fila.id as string) ?? new Set<string>()
    const vistos = destinatario ? (vistosSet.has(destinatario) ? 1 : 0) : vistosSet.size
    const tipo = fila.tipo as 'texto' | 'texto_foto' | 'video'
    const texto = fila.texto as string | null
    const resumen = texto && texto.trim().length > 0 ? texto.trim() : tipo === 'video' ? 'Video sin texto' : 'Mensaje sin texto'
    return { id: fila.id as string, tipo, resumen, audiencia, vistos, creadoEn: fila.creado_en as string }
  })

  // ---- 16. Crecimiento (antes 11): usuarios nuevos acumulados por semana (últimas 10). ----
  const semanas = 10
  const inicioSemana0 = new Date()
  inicioSemana0.setHours(0, 0, 0, 0)
  inicioSemana0.setDate(inicioSemana0.getDate() - inicioSemana0.getDay() - 7 * (semanas - 1))
  const cortesSemana: number[] = []
  for (let i = 0; i < semanas; i++) {
    cortesSemana.push(inicioSemana0.getTime() + (i + 1) * 7 * MS_DIA)
  }
  const crecimiento: PuntoSerie[] = cortesSemana.map((corte, i) => {
    const acumulado = usuarios.filter((u) => new Date(u.creadoEn).getTime() <= corte).length
    return { fecha: `S${i + 1}`, valor: acumulado }
  })

  return {
    actividad: { hoy, semana, mes, serieIntentosPorUsuario },
    dormidos,
    intentosPorDia,
    aprobacion: {
      aprobados,
      desaprobados: totalIntentos - aprobados,
      total: totalIntentos,
      pctAprobados: totalIntentos > 0 ? Math.round((aprobados / totalIntentos) * 100) : 0,
    },
    materias,
    tiempoAgotado: { pct: conTiempo > 0 ? Math.round((agotados / conTiempo) * 100) : 0, agotados, conTiempo },
    capitulosMasFallos,
    reportesPorAsignatura,
    preguntasMasReportadas,
    capitulosReportadoVsFallado,
    resolucionReportesPorAsignatura,
    preguntasOcultasPorAsignatura,
    onboarding: { vieron: vioTour, total: registrados, pct: registrados > 0 ? Math.round((vioTour / registrados) * 100) : 0 },
    embudo: { registrados, vioTour, primerSimulacro },
    soporte: { abiertos, resueltos, promedioRespuestaHoras, porMotivo },
    alcanceMensajes,
    crecimiento,
  }
}
