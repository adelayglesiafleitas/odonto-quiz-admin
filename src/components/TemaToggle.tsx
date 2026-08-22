import { Moon, Sun } from 'lucide-react'
import { useTema } from '@/context/TemaContext'

// Mismo mecanismo e iconografía (Moon/Sun) que SettingsToggle en
// odonto-quiz-proyecto-react — acá sin el selector de idioma porque el
// panel de admin no tiene i18n.
export function TemaToggle({ sobreOscuro = false, className = '' }: { sobreOscuro?: boolean; className?: string }) {
  const { tema, toggleTema } = useTema()

  return (
    <button
      type="button"
      onClick={toggleTema}
      aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
        sobreOscuro ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-secondary text-foreground hover:bg-secondary/70'
      } ${className}`}
    >
      {tema === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
