// src/lib/mensajesAdmin.ts
//
// Comunicados que un admin manda a todos los usuarios o a uno puntual,
// mostrados en Home de la app cliente (ver mensajesAdminRemoto.ts ahí).
// Tablas: `mensajes_admin` (el mensaje) + `mensajes_admin_descartados`
// (qué usuario ya lo cerró, gestionado del lado cliente, no acá). Los
// archivos de foto/video van al bucket público `mensajes-media`.

import { supabase } from './supabase'

export type TipoMensajeAdmin = 'texto' | 'texto_foto' | 'video'

export interface MensajeAdmin {
  id: string
  tipo: TipoMensajeAdmin
  texto: string | null
  mediaUrl: string | null
  destinatarioUserId: string | null
  activo: boolean
  creadoEn: string
}

export async function listarMensajes(): Promise<MensajeAdmin[]> {
  const { data, error } = await supabase
    .from('mensajes_admin')
    .select('id, tipo, texto, media_url, destinatario_user_id, activo, creado_en')
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al listar mensajes:', error.message)
    return []
  }

  return (data ?? []).map((fila) => ({
    id: fila.id as string,
    tipo: fila.tipo as TipoMensajeAdmin,
    texto: fila.texto as string | null,
    mediaUrl: fila.media_url as string | null,
    destinatarioUserId: fila.destinatario_user_id as string | null,
    activo: fila.activo as boolean,
    creadoEn: fila.creado_en as string,
  }))
}

// Sube la foto/video a Storage y devuelve la URL pública — el bucket
// `mensajes-media` es de lectura pública (política aplicada en la
// migración), así que no hace falta firmar la URL.
export async function subirMediaMensaje(archivo: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const extension = archivo.name.split('.').pop() ?? 'bin'
  const ruta = `${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('mensajes-media').upload(ruta, archivo)
  if (error) {
    console.error('Error al subir el archivo del mensaje:', error.message)
    return { ok: false, error: error.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('mensajes-media').getPublicUrl(ruta)

  return { ok: true, url: publicUrl }
}

interface NuevoMensaje {
  tipo: TipoMensajeAdmin
  texto: string | null
  mediaFile: File | null
  destinatarioUserId: string | null
}

export async function crearMensaje(input: NuevoMensaje): Promise<{ ok: boolean; error?: string }> {
  let mediaUrl: string | null = null

  if (input.mediaFile) {
    const subida = await subirMediaMensaje(input.mediaFile)
    if (!subida.ok) return { ok: false, error: 'No se pudo subir el archivo. Probá de nuevo en un momento.' }
    mediaUrl = subida.url ?? null
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('mensajes_admin').insert({
    tipo: input.tipo,
    texto: input.texto,
    media_url: mediaUrl,
    destinatario_user_id: input.destinatarioUserId,
    creado_por: user?.id ?? null,
  })

  if (error) {
    console.error('Error al crear el mensaje:', error.message)
    return { ok: false, error: 'No se pudo enviar el mensaje. Probá de nuevo en un momento.' }
  }
  return { ok: true }
}

export async function cambiarActivoMensaje(id: string, activo: boolean): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('mensajes_admin').update({ activo }).eq('id', id)
  if (error) {
    console.error('Error al actualizar el estado del mensaje:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

export async function eliminarMensaje(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('mensajes_admin').delete().eq('id', id)
  if (error) {
    console.error('Error al eliminar el mensaje:', error.message)
    return { ok: false }
  }
  return { ok: true }
}
