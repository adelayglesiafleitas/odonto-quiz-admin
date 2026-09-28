// Formato de "Último acceso": tiempo relativo para leer rápido en la tabla
// ("hace 5 min", "hace 3 h", "Ayer") y fecha + hora exactas para el tooltip.

const formatoCompleto = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const formatoFecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

export function formatoUltimoAcceso(valor: string | null | undefined): { label: string; full: string } {
  if (!valor) return { label: 'Nunca', full: 'Sin accesos registrados' }

  const fecha = new Date(valor)
  const seg = (Date.now() - fecha.getTime()) / 1000
  const full = formatoCompleto.format(fecha)

  let label: string
  if (seg < 60) label = 'Ahora mismo'
  else if (seg < 3600) label = `hace ${Math.floor(seg / 60)} min`
  else if (seg < 86400) label = `hace ${Math.floor(seg / 3600)} h`
  else if (seg < 172800) label = 'Ayer'
  else if (seg < 604800) label = `hace ${Math.floor(seg / 86400)} días`
  else label = formatoFecha.format(fecha)

  return { label, full }
}

// "Última apertura" de la app: día y hora explícitos ("Hoy · 14:55",
// "Ayer · 22:10", "25 sep · 09:12") más el relativo y un nivel para el punto
// de color (ahora = últimos 5 min, hoy, antes).
export const MIN_EN_LA_APP = 5
const formatoHora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const formatoDiaMes = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

export type NivelApertura = 'ahora' | 'hoy' | 'antes' | 'nunca'

export function formatoApertura(valor: string | null | undefined): {
  dia: string
  hora: string
  relativo: string
  full: string
  nivel: NivelApertura
} {
  if (!valor) return { dia: 'Sin datos', hora: '', relativo: 'Todavía no ha abierto la app', full: 'Sin aperturas registradas', nivel: 'nunca' }
  const fecha = new Date(valor)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const ayer = new Date(hoy.getTime() - 86_400_000)
  const dia = fecha >= hoy ? 'Hoy' : fecha >= ayer ? 'Ayer' : formatoDiaMes.format(fecha).replace('.', '')
  const seg = (Date.now() - fecha.getTime()) / 1000
  const nivel: NivelApertura = seg < MIN_EN_LA_APP * 60 ? 'ahora' : fecha >= hoy ? 'hoy' : 'antes'
  return {
    dia,
    hora: formatoHora.format(fecha),
    relativo: seg < 60 ? 'ahora mismo' : formatoUltimoAcceso(valor).label.toLowerCase(),
    full: formatoCompleto.format(fecha),
    nivel,
  }
}

export const COLOR_NIVEL_APERTURA: Record<NivelApertura, string> = {
  ahora: 'bg-success',
  hoy: 'bg-accent',
  antes: 'bg-muted-foreground/40',
  nunca: 'bg-transparent border border-border',
}
