import { supabase } from './supabase'

// Sistema de atención al cliente conversacional: reemplaza el modelo
// unidireccional de `feedback` (lib/feedbackAdmin.ts, que queda sin usar).
// Ver claude/atencion-cliente-diseno.md en el proyecto de Claude.

export type EstadoTicket = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado'
export type OrigenTicket = 'pregunta' | 'cuenta' | 'pagos' | 'otro'

export interface Ticket {
  id: string
  usuarioId: string
  creadoEn: string
  ultimaActividadEn: string
  origen: OrigenTicket
  preguntaNumero: number | null
  preguntaTexto: string | null
  preguntaAsignatura: string | null
  preguntaCapitulo: string | null
  asunto: string
  estado: EstadoTicket
  noLeidoAdmin: boolean
}

export interface Mensaje {
  id: string
  ticketId: string
  autorId: string
  cuerpo: string
  creadoEn: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(fila: any): Ticket {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    creadoEn: fila.created_at,
    ultimaActividadEn: fila.ultima_actividad_en,
    origen: fila.origen,
    preguntaNumero: fila.pregunta_numero,
    preguntaTexto: fila.pregunta_texto,
    preguntaAsignatura: fila.pregunta_asignatura,
    preguntaCapitulo: fila.pregunta_capitulo,
    asunto: fila.asunto,
    estado: fila.estado,
    noLeidoAdmin: fila.no_leido_admin,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMensaje(fila: any): Mensaje {
  return {
    id: fila.id,
    ticketId: fila.ticket_id,
    autorId: fila.autor_id,
    cuerpo: fila.cuerpo,
    creadoEn: fila.created_at,
  }
}

// RLS ("Ver tickets propios o si es admin") ya le da a un admin lectura de
// todos los tickets — no hace falta RPC, mismo criterio que feedbackAdmin.ts.
export async function listarTodosTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase.from('tickets').select('*').order('ultima_actividad_en', { ascending: false })
  if (error) {
    console.error('Error al listar tickets:', error.message)
    return []
  }
  return (data ?? []).map(mapTicket)
}

export async function obtenerMensajes(ticketId: string): Promise<Mensaje[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Error al obtener mensajes:', error.message)
    return []
  }
  return (data ?? []).map(mapMensaje)
}

export async function enviarMensaje(ticketId: string, adminId: string, cuerpo: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('mensajes').insert({ ticket_id: ticketId, autor_id: adminId, cuerpo })
  if (error) {
    console.error('Error al enviar la respuesta:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

export async function marcarLeidoAdmin(ticketId: string): Promise<void> {
  await supabase.from('tickets').update({ no_leido_admin: false }).eq('id', ticketId)
}

export async function actualizarEstadoTicket(ticketId: string, estado: EstadoTicket): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('tickets').update({ estado }).eq('id', ticketId)
  if (error) {
    console.error('Error al actualizar el estado del ticket:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

export function contarNoLeidos(tickets: Ticket[]): number {
  return tickets.filter((t) => t.noLeidoAdmin).length
}

export function formatoRelativo(fecha: string): string {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

// La bandeja completa se refresca sola con cualquier cambio en `tickets`
// (nuevo ticket, nueva actividad, cambio de estado) — el trigger de la base
// ya actualiza esa fila cuando llega un mensaje, así que no hace falta
// suscribirse a `mensajes` acá también.
export function suscribirseATickets(onCambio: () => void): () => void {
  const canal = supabase
    .channel('admin-tickets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, onCambio)
    .subscribe()
  return () => {
    supabase.removeChannel(canal)
  }
}

export function suscribirseAMensajesTicket(
  ticketId: string,
  onMensaje: (m: Mensaje) => void,
  onTicketActualizado: () => void,
): () => void {
  const canal = supabase
    .channel(`admin-ticket-${ticketId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `ticket_id=eq.${ticketId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => onMensaje(mapMensaje(payload.new)),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
      onTicketActualizado,
    )
    .subscribe()
  return () => {
    supabase.removeChannel(canal)
  }
}
