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
  mostrarSiempre: boolean
  creadoEn: string
}

export async function listarMensajes(): Promise<MensajeAdmin[]> {
  const { data, error } = await supabase
    .from('mensajes_admin')
    .select('id, tipo, texto, media_url, destinatario_user_id, activo, mostrar_siempre, creado_en')
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
    mostrarSiempre: fila.mostrar_siempre as boolean,
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
  mostrarSiempre: boolean
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
    mostrar_siempre: input.mostrarSiempre,
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

// Borra un archivo del bucket `mensajes-media` a partir de su URL pública.
// No falla ruidosamente: un archivo huérfano en Storage es preferible a
// bloquear al admin por un error de borrado.
async function borrarArchivoStorage(mediaUrl: string): Promise<void> {
  const marcador = '/mensajes-media/'
  const indice = mediaUrl.indexOf(marcador)
  if (indice === -1) return
  const ruta = mediaUrl.slice(indice + marcador.length)
  const { error } = await supabase.storage.from('mensajes-media').remove([ruta])
  if (error) console.error('Error al borrar el archivo del mensaje:', error.message)
}

// Antes de borrar la fila, intenta borrar también el archivo en Storage (si
// tenía uno) para no dejar fotos/videos huérfanos en el bucket. Si el
// borrado del archivo falla, igual sigue y borra la fila — un archivo
// huérfano es preferible a un mensaje que el admin no puede eliminar.
export async function eliminarMensaje(id: string): Promise<{ ok: boolean }> {
  const { data: fila } = await supabase.from('mensajes_admin').select('media_url').eq('id', id).maybeSingle()

  if (fila?.media_url) {
    await borrarArchivoStorage(fila.media_url as string)
  }

  const { error } = await supabase.from('mensajes_admin').delete().eq('id', id)
  if (error) {
    console.error('Error al eliminar el mensaje:', error.message)
    return { ok: false }
  }
  return { ok: true }
}

interface EdicionMensaje {
  tipo: TipoMensajeAdmin
  texto: string | null
  mediaFile: File | null
  // true = si no se eligió un archivo nuevo, conservar el mediaUrl que ya
  // tenía la fila (mismo tipo de antes). false = el tipo cambió a algo que
  // no lleva archivo, o a un tipo de archivo distinto — no tiene sentido
  // reusar el anterior.
  mantenerMediaActual: boolean
  destinatarioUserId: string | null
  mostrarSiempre: boolean
}

// Edita un mensaje ya enviado. No pide confirmación de "a todos" de nuevo
// (no es un envío nuevo) y no toca `mensajes_admin_descartados`: a quien ya
// cerró el mensaje no le vuelve a aparecer solo por haberse editado — mismo
// criterio que ya rige `mostrar_siempre` hoy.
export async function editarMensaje(
  mensajeId: string,
  mediaUrlActual: string | null,
  input: EdicionMensaje,
): Promise<{ ok: boolean; error?: string }> {
  const necesitaMedia = input.tipo === 'texto_foto' || input.tipo === 'video'
  let mediaUrl: string | null = input.mantenerMediaActual ? mediaUrlActual : null

  if (necesitaMedia && input.mediaFile) {
    const subida = await subirMediaMensaje(input.mediaFile)
    if (!subida.ok) return { ok: false, error: 'No se pudo subir el archivo. Probá de nuevo en un momento.' }
    mediaUrl = subida.url ?? null
  } else if (!necesitaMedia) {
    mediaUrl = null
  }

  // Si el archivo final quedó distinto del que tenía la fila, el anterior
  // se borra del bucket para no dejarlo huérfano.
  if (mediaUrlActual && mediaUrlActual !== mediaUrl) {
    await borrarArchivoStorage(mediaUrlActual)
  }

  const { error } = await supabase
    .from('mensajes_admin')
    .update({
      tipo: input.tipo,
      texto: input.texto,
      media_url: mediaUrl,
      destinatario_user_id: input.destinatarioUserId,
      mostrar_siempre: input.mostrarSiempre,
    })
    .eq('id', mensajeId)

  if (error) {
    console.error('Error al editar el mensaje:', error.message)
    return { ok: false, error: 'No se pudo guardar los cambios. Probá de nuevo en un momento.' }
  }
  return { ok: true }
}
