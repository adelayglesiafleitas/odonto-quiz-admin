const DIAS_DEFAULT = 365

export function setCookie(nombre: string, valor: string, dias: number = DIAS_DEFAULT) {
  try {
    const expira = new Date()
    expira.setTime(expira.getTime() + dias * 24 * 60 * 60 * 1000)
    document.cookie = `${nombre}=${encodeURIComponent(valor)}; expires=${expira.toUTCString()}; path=/; SameSite=Lax`
  } catch {
    /* no-op: cookies no disponibles */
  }
}

export function getCookie(nombre: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + nombre + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}
