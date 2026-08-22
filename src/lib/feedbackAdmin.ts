import { supabase } from './supabase'

export type EstadoFeedback = 'pendiente' | 'en_revision' | 'resuelto' | 'descartado'
export type OrigenFeedback = 'pregunta' | 'app'

export interface FeedbackItem {
  id: string
  creadoEn: string
  reportadoPor: string
  origen: OrigenFeedback
  preguntaNumero: number | null
  preguntaTexto: string | null
  asignatura: string | null
  capitulo: string | null
  tipo: string | null
  comentario: string | null
  estado: EstadoFeedback
  resueltoPor: string | null
  resueltoEn: string | null
}

interface FilaFeedback {
  id: string
  created_at: string
  reportado_por: string
  origen: OrigenFeedback
  pregunta_numero: number | null
  pregunta_texto: string | null
  asignatura: string | null
  capitulo: string | null
  tipo: string | null
  comentario: string | null
  estado: EstadoFeedback
  resuelto_por: string | null
  resuelto_en: string | null
}

function filaAItem(fila: FilaFeedback): FeedbackItem {
  return {
    id: fila.id,
    creadoEn: fila.created_at,
    reportadoPor: fila.reportado_por,
    origen: fila.origen,
    preguntaNumero: fila.pregunta_numero,
    preguntaTexto: fila.pregunta_texto,
    asignatura: fila.asignatura,
    capitulo: fila.capitulo,
    tipo: fila.tipo,
    comentario: fila.comentario,
    estado: fila.estado,
    resueltoPor: fila.resuelto_por,
    resueltoEn: fila.resuelto_en,
  }
}

// RLS ("Ver feedback propio o si es admin") ya le permite a un admin leer
// toda la tabla, así que no hace falta una función RPC acá — a diferencia
// de admin_listar_usuarios, que existe porque auth.users no es legible
// directo con la anon key.
export async function listarFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('Error al listar los reportes:', error.message)
    return []
  }
  return (data ?? []).map(filaAItem)
}

// "en_revision" no es un estado final: no toca resuelto_por/resuelto_en, así
// esas columnas solo quedan registradas cuando alguien realmente cerró el
// caso (resuelto o descartado) — que es lo que promete el footnote del
// historial en el diseño aprobado.
export async function actualizarEstadoFeedback(
  id: string,
  estado: EstadoFeedback,
  adminId: string,
): Promise<{ ok: boolean }> {
  const esFinal = estado === 'resuelto' || estado === 'descartado'
  const { error } = await supabase
    .from('feedback')
    .update({
      estado,
      resuelto_por: esFinal ? adminId : null,
      resuelto_en: esFinal ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) {
    console.error('Error al actualizar el reporte:', error.message)
    return { ok: false }
  }
  return { ok: true }
}
