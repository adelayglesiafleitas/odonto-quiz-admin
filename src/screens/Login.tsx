import { useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react'

// Sin registro a propósito: los admins no se dan de alta desde acá. La
// cuenta ya tiene que existir en auth.users (se crea desde la app de examen,
// o directo en Supabase Studio) y además tener una fila en `admins` — eso
// último se chequea después de iniciar sesión, en App.tsx.
function traducirErrorAuth(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.'
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
  }
  return mensaje
}

export function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
    setCargando(false)
    if (err) setError(traducirErrorAuth(err.message))
    // Si no hay error, el listener de sesión en App.tsx se encarga del resto
    // (incluido el chequeo de si esta cuenta está en `admins`).
  }

  return (
    <div className="brand-gradient app-shell relative flex flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[#1fc6c6]/10 blur-3xl" />

      <div className="mb-8 flex flex-col items-center gap-3 animate-float-up">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <div className="text-center">
          <h1 className="text-xl font-extrabold tracking-tight text-white">ExamPrep · Admin</h1>
          <p className="text-xs font-medium text-white/60">Panel de revisión</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-elevated w-full max-w-sm animate-float-up rounded-3xl bg-card p-7"
        style={{ animationDelay: '0.1s' }}
      >
        <h2 className="text-lg font-bold text-foreground">Iniciar sesión</h2>
        <p className="mt-1 text-sm text-muted-foreground">Solo cuentas autorizadas como admin.</p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="correo" className="text-xs font-semibold text-foreground/80">
              Correo electrónico
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="correo"
                type="email"
                placeholder="tu@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="h-11 rounded-xl pl-9"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clave" className="text-xs font-semibold text-foreground/80">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="clave"
                type={verClave ? 'text' : 'password'}
                placeholder="••••••"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="h-11 rounded-xl pl-9 pr-9"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={cargando}
            className="h-11 w-full rounded-xl bg-primary text-[15px] font-semibold hover:bg-primary/90"
          >
            {cargando ? 'Ingresando…' : 'Iniciar sesión'}
          </Button>
        </div>
      </form>
    </div>
  )
}
