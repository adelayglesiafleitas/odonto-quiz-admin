// src/lib/encuesta.ts
//
// ENCUESTA-TEMPORAL — Resultados de la encuesta "Ayúdanos a mejorar" de la
// app (tabla `encuesta_respuestas`, ver supabase/schema.sql sección 12 en
// odonto-quiz-proyecto-react y claude/encuesta-feedback-diseno.md).
// Para quitarla del admin: buscar "ENCUESTA-TEMPORAL" en este repo y borrar
// este archivo, screens/Encuesta.tsx y las dos líneas de AdminSidebar/Panel.
//
// Todo se calcula en el cliente a partir de un select simple (una fila por
// usuario y campaña), mismo criterio que lib/estadisticas.ts.

import { supabase } from './supabase'

export interface RespuestaEncuesta {
  userId: string
  campania: string
  nps: number | null
  canales: string[]
  canalOtro: string | null
  funcion: string | null
  cambio: string | null
  completada: boolean
  ultimoPaso: number
  cerradaConX: boolean
  creadaEn: string
  actualizadaEn: string
}

export const ETIQUETA_CANAL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  google: 'Google',
  whatsapp: 'Grupo de WhatsApp',
  telegram: 'Telegram',
  companero: 'Un compañero',
  academia: 'Una academia',
  otro: 'Otro',
}

// Debe coincidir con CAMPANIA_ENCUESTA de la app (src/lib/encuestaRemoto.ts
// en odonto-quiz-proyecto-react): es la campaña que "Repetir encuesta" borra.
export const CAMPANIA_ACTUAL = '2026-10'

// Borra la fila del usuario en la campaña actual: como la app solo muestra la
// encuesta a quien no tiene fila, le vuelve a salir la próxima vez que entre
// en Home. Pensado para probarla con la propia cuenta.
export async function repetirEncuesta(userId: string): Promise<boolean> {
  const { error } = await supabase.from('encuesta_respuestas').delete().eq('user_id', userId).eq('campania', CAMPANIA_ACTUAL)
  return !error
}

export async function listarRespuestasEncuesta(): Promise<RespuestaEncuesta[]> {
  const { data, error } = await supabase
    .from('encuesta_respuestas')
    .select('user_id, campania, nps, canales, canal_otro, funcion, cambio, completada, ultimo_paso, cerrada_con_x, creada_en, actualizada_en')
    .order('actualizada_en', { ascending: false })
  if (error || !data) return []
  return data.map((f) => ({
    userId: f.user_id as string,
    campania: f.campania as string,
    nps: (f.nps as number | null) ?? null,
    canales: (f.canales as string[] | null) ?? [],
    canalOtro: (f.canal_otro as string | null) ?? null,
    funcion: (f.funcion as string | null) ?? null,
    cambio: (f.cambio as string | null) ?? null,
    completada: Boolean(f.completada),
    ultimoPaso: (f.ultimo_paso as number) ?? 0,
    cerradaConX: Boolean(f.cerrada_con_x),
    creadaEn: f.creada_en as string,
    actualizadaEn: f.actualizada_en as string,
  }))
}

export type GrupoNota = 'det' | 'pas' | 'pro'
export const grupoNota = (n: number): GrupoNota => (n <= 6 ? 'det' : n <= 8 ? 'pas' : 'pro')

export interface ResumenEncuesta {
  mostradas: number
  completadas: number
  tasa: number | null
  conNota: number
  media: number | null
  nps: number | null
  pctDet: number
  pctPas: number
  pctPro: number
  distribucion: number[] // 11 posiciones, 0..10
  personasCanal: number
  canales: { id: string; etiqueta: string; n: number; pct: number }[]
  otros: string[]
  sinEmpezar: RespuestaEncuesta[]
  aMedias: RespuestaEncuesta[]
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

export function resumirEncuesta(filas: RespuestaEncuesta[]): ResumenEncuesta {
  const mostradas = filas.length
  const completadas = filas.filter((f) => f.completada).length
  // Las respuestas a medias SÍ cuentan en la nota si llegaron a ponerla.
  const notas = filas.map((f) => f.nps).filter((n): n is number => n !== null)
  const distribucion = Array.from({ length: 11 }, (_, v) => notas.filter((n) => n === v).length)
  const det = notas.filter((n) => grupoNota(n) === 'det').length
  const pas = notas.filter((n) => grupoNota(n) === 'pas').length
  const pro = notas.filter((n) => grupoNota(n) === 'pro').length

  // Selección múltiple: el % es sobre PERSONAS que contestaron la pregunta 2,
  // no sobre votos (la suma puede pasar del 100 %).
  const conCanal = filas.filter((f) => f.canales.length > 0)
  const cuenta = new Map<string, number>()
  conCanal.forEach((f) => f.canales.forEach((c) => cuenta.set(c, (cuenta.get(c) ?? 0) + 1)))
  const canales = [...cuenta.entries()]
    .map(([id, n]) => ({ id, etiqueta: ETIQUETA_CANAL[id] ?? id, n, pct: pct(n, conCanal.length) }))
    .sort((a, b) => b.n - a.n)

  const noTerminaron = filas.filter((f) => !f.completada)

  return {
    mostradas,
    completadas,
    tasa: mostradas > 0 ? pct(completadas, mostradas) : null,
    conNota: notas.length,
    media: notas.length > 0 ? notas.reduce((a, n) => a + n, 0) / notas.length : null,
    nps: notas.length > 0 ? pct(pro, notas.length) - pct(det, notas.length) : null,
    pctDet: pct(det, notas.length),
    pctPas: pct(pas, notas.length),
    pctPro: pct(pro, notas.length),
    distribucion,
    personasCanal: conCanal.length,
    canales,
    otros: filas.map((f) => f.canalOtro).filter((t): t is string => Boolean(t && t.trim())),
    sinEmpezar: noTerminaron.filter((f) => f.ultimoPaso === 0),
    aMedias: noTerminaron.filter((f) => f.ultimoPaso > 0),
  }
}

// CSV para abrir en Excel: separador ";" y BOM para que respete tildes.
export function descargarCsvEncuesta(filas: RespuestaEncuesta[], nombrePorId: Map<string, string>, campania: string) {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const cabecera = ['Usuario', 'Fecha', 'Nota', 'Canales', 'Otro', 'Función', 'Cambio', 'Completada', 'Último paso', 'Cerrada con X']
  const lineas = filas.map((f) =>
    [
      nombrePorId.get(f.userId) ?? f.userId,
      new Date(f.creadaEn).toLocaleString('es'),
      f.nps,
      f.canales.map((c) => ETIQUETA_CANAL[c] ?? c).join(', '),
      f.canalOtro,
      f.funcion,
      f.cambio,
      f.completada ? 'Sí' : 'No',
      f.ultimoPaso,
      f.cerradaConX ? 'Sí' : 'No',
    ]
      .map(esc)
      .join(';'),
  )
  const blob = new Blob(['﻿' + [cabecera.join(';'), ...lineas].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `encuesta-${campania}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
