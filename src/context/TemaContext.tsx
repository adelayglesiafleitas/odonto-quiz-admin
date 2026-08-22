import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getTemaGuardado, guardarTema, type Tema } from '@/lib/tema'

interface TemaValue {
  tema: Tema
  toggleTema: () => void
}

const TemaContext = createContext<TemaValue | null>(null)

export function useTema(): TemaValue {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema debe usarse dentro de TemaProvider')
  return ctx
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => getTemaGuardado())

  useEffect(() => {
    const root = document.documentElement
    if (tema === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [tema])

  function toggleTema() {
    setTema((actual) => {
      const nuevo: Tema = actual === 'dark' ? 'light' : 'dark'
      guardarTema(nuevo)
      return nuevo
    })
  }

  return <TemaContext.Provider value={{ tema, toggleTema }}>{children}</TemaContext.Provider>
}
