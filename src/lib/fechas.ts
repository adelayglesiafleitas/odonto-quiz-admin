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
