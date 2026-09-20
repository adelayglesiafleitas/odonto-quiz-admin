import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Interruptor({
  activo,
  onChange,
  etiqueta,
  disabled,
}: {
  activo: boolean
  onChange: (v: boolean) => void
  etiqueta: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
        activo ? 'bg-accent' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          activo ? 'left-[1.375rem]' : 'left-0.5',
        )}
      />
    </button>
  )
}

export function Panelito({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('card-elevated rounded-2xl border border-border bg-card p-5', className)}>{children}</section>
}

export function Pildora({
  children,
  tono = 'neutro',
}: {
  children: ReactNode
  tono?: 'neutro' | 'ok' | 'aviso' | 'error' | 'info'
}) {
  const t = {
    neutro: 'bg-muted text-muted-foreground',
    ok: 'bg-success/15 text-success',
    aviso: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    error: 'bg-destructive/15 text-destructive',
    info: 'bg-info/15 text-info',
  }[tono]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-bold', t)}>{children}</span>
  )
}

export function Cajon({
  abierto,
  titulo,
  onCerrar,
  children,
  pie,
}: {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/40" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[0.95rem] font-extrabold text-foreground">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
        {pie && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{pie}</footer>}
      </aside>
    </div>
  )
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-foreground">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-[0.72rem] text-muted-foreground">{ayuda}</span>}
    </label>
  )
}

export const selectCls =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function Segmentado<T extends string | number>({
  valor,
  opciones,
  onChange,
}: {
  valor: T
  opciones: { valor: T; etiqueta: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
            o.valor === valor ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
