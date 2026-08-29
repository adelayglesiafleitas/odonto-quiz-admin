import { ShieldCheck, Users, Inbox, Megaphone, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TemaToggle } from './TemaToggle'

export type Vista = 'usuarios' | 'atencion' | 'mensajes'

interface Props {
  vista: Vista
  onCambiarVista: (vista: Vista) => void
  correo: string
  pendientes: number
}

const NAV: { target: Vista; label: string; icon: typeof Users }[] = [
  { target: 'usuarios', label: 'Usuarios', icon: Users },
  { target: 'atencion', label: 'Atención al cliente', icon: Inbox },
  { target: 'mensajes', label: 'Mensajes', icon: Megaphone },
]

export function AdminSidebar({ vista, onCambiarVista, correo, pendientes }: Props) {
  const inicial = correo.charAt(0).toUpperCase() || '?'

  return (
    <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-60 md:border-b-0 md:border-r md:py-5">
      <div className="hidden items-center gap-2.5 px-1 md:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-[18px] w-[18px]" />
        </span>
        <div className="leading-tight">
          <p className="text-[0.92rem] font-extrabold text-foreground">ExamPrep · Admin</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-row gap-1 md:flex-none md:flex-col">
        {NAV.map(({ target, label, icon: Icon }) => {
          const activo = vista === target
          return (
            <button
              key={target}
              type="button"
              onClick={() => onCambiarVista(target)}
              aria-current={activo}
              className={`flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors md:flex-none ${
                activo ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden flex-1 md:inline">{label}</span>
              {target === 'atencion' && pendientes > 0 && (
                <span className="min-w-[1.15rem] rounded-full bg-accent px-1.5 py-0.5 text-center text-[0.68rem] font-extrabold text-accent-foreground">
                  {pendientes}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1 md:hidden">
        <TemaToggle />
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="mt-auto hidden border-t border-border pt-3.5 md:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-extrabold text-accent">
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{correo}</p>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3 w-3" />
              Cerrar sesión
            </button>
          </div>
          <TemaToggle className="h-8 w-8" />
        </div>
      </div>
    </aside>
  )
}
