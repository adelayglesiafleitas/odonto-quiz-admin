// Un color por asignatura, reutilizado en toda la app admin (columna
// "Asignatura" de AtencionCliente.tsx, rankings de "Reportes de errores" en
// Estadisticas.tsx) — para que la misma materia se vea siempre del mismo
// color en cualquier pantalla. Mapa a mano (mismo patrón que ETIQUETA_ORIGEN
// en AtencionCliente.tsx): la clave es el string exacto que guarda cada
// banco de preguntas en `pregunta_asignatura`/`preguntas.asignatura`. Al
// cargar una asignatura nueva alcanza con sumar una línea acá — mientras
// tanto cae en COLOR_ASIGNATURA_DEFAULT, no rompe nada, solo no se distingue
// todavía. Ver claude/atencion-cliente-diseno.md.
//
// Clases completas (no armadas con template strings) a propósito: Tailwind
// purga por contenido literal en el código fuente — una clase construida en
// runtime (ej. `bg-${color}`) puede desaparecer del CSS compilado sin avisar
// (bug real ya visto del lado del cliente, ver claude/tema-acqua-estilo-app.md).
export interface ColorAsignatura {
  text: string
  bg: string
}

export const COLOR_ASIGNATURA: Record<string, ColorAsignatura> = {
  'Pacientes Especiales': { text: 'text-accent', bg: 'bg-accent' },
  Ortodoncia: { text: 'text-violet-400', bg: 'bg-violet-400' },
  'Psicología general': { text: 'text-amber-400', bg: 'bg-amber-400' },
}

// Color de reserva, ya elegido para cuando se confirme el string exacto de
// "asignatura" de la próxima materia que se sume (candidata: Materiales
// Odontológicos, ver claude/materiales-carga-6-excel-biomateriales.md) —
// todavía no se agregó al mapa de arriba porque no se verificó ese string.
export const COLOR_ASIGNATURA_RESERVA: ColorAsignatura = { text: 'text-pink-400', bg: 'bg-pink-400' }

export const COLOR_ASIGNATURA_DEFAULT: ColorAsignatura = { text: 'text-muted-foreground', bg: 'bg-muted-foreground' }

export function colorAsignatura(asignatura: string | null | undefined): ColorAsignatura {
  if (!asignatura) return COLOR_ASIGNATURA_DEFAULT
  return COLOR_ASIGNATURA[asignatura] ?? COLOR_ASIGNATURA_DEFAULT
}
