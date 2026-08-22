import { getCookie, setCookie } from './cookies'

export type Tema = 'dark' | 'light'

// Cookie propia (no la misma que odonto-quiz-proyecto-react) porque son dos
// apps distintas — el criterio de "oscuro por defecto" y el mecanismo de
// guardado sí son los mismos que la app de examen (ver src/lib/settings.ts allá).
const TEMA_COOKIE = 'examprep_admin_tema'

export function getTemaGuardado(): Tema {
  const valor = getCookie(TEMA_COOKIE)
  return valor === 'light' ? 'light' : 'dark'
}

export function guardarTema(tema: Tema) {
  setCookie(TEMA_COOKIE, tema)
}
