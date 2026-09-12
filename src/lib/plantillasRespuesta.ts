import { supabase } from './supabase'
import type { OrigenTicket } from './tickets'

// Respuestas predefinidas para el composer del chat de tickets (ver
// SelectorPlantillas en screens/AtencionCliente.tsx). Compartidas entre los
// dos admins (misma RLS que tickets: solo `es_admin()` lee/escribe). El
// texto se inserta en el textarea, nunca se envía directo — ver
// claude/respuestas-rapidas-tickets-diseno.md en el proyecto de Claude.
export interface PlantillaRespuesta {
  id: string
  titulo: string
  cuerpo: string
  categoria: OrigenTicket | null // null = general, aparece para cualquier tipo de ticket
  orden: number
  creadoEn: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlantilla(fila: any): PlantillaRespuesta {
  return {
    id: fila.id,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    categoria: fila.categoria,
    orden: fila.orden,
    creadoEn: fila.creado_en,
  }
}

export async function listarPlantillas(): Promise<PlantillaRespuesta[]> {
  const { data, error } = await supabase.from('plantillas_respuesta').select('*').order('orden', { ascending: true })
  if (error) {
    console.error('Error al listar plantillas de respuesta:', error.message)
    return []
  }
  return (data ?? []).map(mapPlantilla)
}

export async function crearPlantilla(
  titulo: string,
  cuerpo: string,
  categoria: OrigenTicket | null,
  creadoPor: string,
): Promise<{ ok: boolean; plantilla?: PlantillaRespuesta }> {
  const { data, error } = await supabase
    .from('plantillas_respuesta')
    .insert({ titulo, cuerpo, categoria, creado_por: creadoPor })
    .select()
    .single()
  if (error) {
    console.error('Error al crear la plantilla:', error.message)
    return { ok: false }
  }
  return { ok: true, plantilla: mapPlantilla(data) }
}

export async function eliminarPlantilla(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('plantillas_respuesta').delete().eq('id', id)
  if (error) {
    console.error('Error al eliminar la plantilla:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

// Orden para mostrar dentro de un ticket puntual: primero las de la
// categoría del ticket, después las generales (categoria null), el resto al
// final — así lo más probable de usar queda arriba sin esconder el resto.
export function ordenarParaTicket(plantillas: PlantillaRespuesta[], origen: OrigenTicket): PlantillaRespuesta[] {
  const propias = plantillas.filter((p) => p.categoria === origen)
  const generales = plantillas.filter((p) => p.categoria === null)
  const resto = plantillas.filter((p) => p.categoria !== origen && p.categoria !== null)
  return [...propias, ...generales, ...resto]
}
