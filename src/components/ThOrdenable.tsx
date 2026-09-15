import { ChevronDown } from 'lucide-react'

export interface EstadoOrden<Col extends string> {
  col: Col | null
  dir: 'asc' | 'desc'
}

// 1er clic en una columna: ordena ascendente. 2do clic en la misma columna:
// invierte a descendente. Clic en otra columna: vuelve a ascendente sobre
// la columna nueva. Un solo criterio de orden a la vez (no multi-columna).
export function cambiarOrden<Col extends string>(actual: EstadoOrden<Col>, col: Col): EstadoOrden<Col> {
  return actual.col === col ? { col, dir: actual.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }
}

/**
 * Encabezado de columna ordenable, reusado en las tablas de Usuarios y
 * Atención al cliente (panel admin) — mismo patrón de interacción en las
 * dos. Mockup aprobado: https://claude.ai/artifact/Me6eARexJJpYkkju5FbWXA
 * Ver claude/atencion-cliente-diseno.md y claude/preguntas-tabla-editor-admin.md
 * para el resto de las decisiones de tabla de este panel.
 */
export function ThOrdenable<Col extends string>({
  col,
  activo,
  label,
  align,
  onOrdenar,
}: {
  col: Col
  activo: EstadoOrden<Col>
  label: string
  align?: 'right'
  onOrdenar: (col: Col) => void
}) {
  const esActiva = activo.col === col
  return (
    <th
      onClick={() => onOrdenar(col)}
      aria-sort={esActiva ? (activo.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`group cursor-pointer select-none whitespace-nowrap px-4 py-3 transition hover:text-accent ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${esActiva ? 'text-accent' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-opacity ${
            esActiva ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
          } ${esActiva && activo.dir === 'desc' ? 'rotate-180' : ''}`}
        />
      </span>
    </th>
  )
}
