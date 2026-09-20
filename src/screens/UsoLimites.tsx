import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panelito, Pildora, Segmentado, fechaCorta } from '@/components/ui/extra'
import { cn } from '@/lib/utils'
import {
  LIMITES,
  crecimientoDiario,
  diasHastaLimite,
  formatoBytes,
  guardarConfigUso,
  nivelDe,
  obtenerConfigUso,
  obtenerUso,
  type ConfigUso,
  type Nivel,
  type Plan,
  type UsoActual,
} from '@/lib/uso'

const COLOR: Record<Nivel, string> = {
  ok: 'bg-success',
  aviso: 'bg-amber-500',
  alerta: 'bg-orange-500',
  critico: 'bg-destructive',
}
const TEXTO: Record<Nivel, string> = { ok: 'Bien', aviso: 'Atención', alerta: 'Alerta', critico: 'Crítico' }
const TONO: Record<Nivel, 'ok' | 'aviso' | 'error'> = { ok: 'ok', aviso: 'aviso', alerta: 'aviso', critico: 'error' }

function Medidor({
  titulo,
  usado,
  limite,
  etiqueta,
  config,
  nota,
}: {
  titulo: string
  usado: number | null
  limite: number
  etiqueta: string
  config: ConfigUso
  nota?: string
}) {
  const pct = usado === null ? 0 : Math.min(100, (usado / limite) * 100)
  const nivel = nivelDe(pct, config)
  return (
    <Panelito className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-extrabold text-foreground">{titulo}</p>
        {usado !== null && <Pildora tono={TONO[nivel]}>{TEXTO[nivel]}</Pildora>}
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-foreground">
        {usado === null ? '—' : `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full', COLOR[nivel])} style={{ width: `${Math.max(pct, usado ? 1 : 0)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </Panelito>
  )
}

export function UsoLimites() {
  const [uso, setUso] = useState<UsoActual | null>(null)
  const [config, setConfig] = useState<ConfigUso | null>(null)
  const [cargando, setCargando] = useState(true)
  const [egress, setEgress] = useState('')
  const [rt, setRt] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [u, c] = await Promise.all([obtenerUso(), obtenerConfigUso()])
    setUso(u)
    setConfig(c)
    setEgress(c.egressGb === null ? '' : String(c.egressGb))
    setRt(c.realtimeConexiones === null ? '' : String(c.realtimeConexiones))
    setCargando(false)
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  if (cargando || !config) return <p className="text-sm text-muted-foreground">Calculando uso…</p>
  if (!uso) return <p className="text-sm text-destructive">No se pudo leer el uso (¿tu cuenta es admin completo?).</p>

  const lim = LIMITES[config.plan]
  const dbPct = (uso.dbBytes / lim.dbBytes) * 100
  const gDb = crecimientoDiario(uso.historial, 'dbBytes')
  const dias = diasHastaLimite(uso.dbBytes, lim.dbBytes * (config.umbralAlerta / 100), gDb)
  const egressN = egress.trim() === '' ? null : Number(egress)
  const rtN = rt.trim() === '' ? null : Number(rt)
  const maxTabla = Math.max(1, ...uso.tablas.map((t) => t.bytes))

  async function guardarManual() {
    const e = await guardarConfigUso({
      egressGb: egressN !== null && !Number.isNaN(egressN) ? egressN : null,
      realtimeConexiones: rtN !== null && !Number.isNaN(rtN) ? Math.round(rtN) : null,
    })
    setMsg(e ?? 'Guardado')
    if (!e) cargar()
  }

  const peor = nivelDe(dbPct, config)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Plan de Supabase</span>
          <Segmentado
            valor={config.plan}
            opciones={[
              { valor: 'free' as Plan, etiqueta: 'Free' },
              { valor: 'pro' as Plan, etiqueta: 'Pro' },
            ]}
            onChange={async (p) => {
              await guardarConfigUso({ plan: p })
              cargar()
            }}
          />
        </div>
        <Button size="sm" variant="outline" onClick={cargar}>
          <RefreshCw /> Actualizar
        </Button>
      </div>

      {peor !== 'ok' && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            La base de datos está al <strong>{Math.round(dbPct)}%</strong> del límite del plan {config.plan === 'free' ? 'Free' : 'Pro'}.
            {dias !== null && ` Al ritmo actual llegarás al ${config.umbralAlerta}% en unos ${dias} días.`}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Medidor titulo="Base de datos" usado={uso.dbBytes} limite={lim.dbBytes} config={config} etiqueta={`${formatoBytes(uso.dbBytes)} de ${formatoBytes(lim.dbBytes)}`} />
        <Medidor titulo="Almacenamiento" usado={uso.storageBytes} limite={lim.storageBytes} config={config} etiqueta={`${formatoBytes(uso.storageBytes)} de ${formatoBytes(lim.storageBytes)} · ${uso.storageObjs} archivos`} />
        <Medidor titulo="Usuarios activos (MAU)" usado={uso.mau} limite={lim.mau} config={config} etiqueta={`${uso.mau} de ${lim.mau.toLocaleString('es-ES')} · ${uso.usuarios} registrados`} />
        <Medidor
          titulo="Transferencia (egress)"
          usado={egressN}
          limite={lim.egressGb}
          config={config}
          etiqueta={egressN === null ? 'Sin dato: introdúcelo abajo' : `${egressN} GB de ${lim.egressGb} GB este mes`}
          nota="Dato manual (Supabase → Usage)."
        />
        <Medidor
          titulo="Conexiones Realtime"
          usado={rtN}
          limite={lim.realtime}
          config={config}
          etiqueta={rtN === null ? 'Sin dato: introdúcelo abajo' : `${rtN} de ${lim.realtime} simultáneas (pico)`}
          nota="Dato manual (Supabase → Reports)."
        />
      </div>

      <Panelito className="space-y-3">
        <h3 className="text-sm font-extrabold text-foreground">Datos manuales</h3>
        <p className="text-xs text-muted-foreground">
          Supabase no expone estos dos números por SQL. Cópialos del panel de Supabase de vez en cuando.
          {config.manualActualizadoEn && ` Última actualización: ${fechaCorta(config.manualActualizadoEn)}.`}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs font-bold">Egress del mes (GB)</span>
            <Input id="egress" inputMode="decimal" className="w-36" value={egress} onChange={(e) => setEgress(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold">Realtime (pico)</span>
            <Input id="realtime" inputMode="numeric" className="w-36" value={rt} onChange={(e) => setRt(e.target.value)} />
          </label>
          <Button variant="accent" onClick={guardarManual}>
            Guardar
          </Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </Panelito>

      <Panelito className="space-y-3">
        <h3 className="text-sm font-extrabold text-foreground">Qué ocupa espacio en la base</h3>
        <ul className="space-y-2">
          {uso.tablas.slice(0, 10).map((t) => (
            <li key={t.tabla} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate font-semibold text-foreground">{t.tabla}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(t.bytes / maxTabla) * 100}%` }} />
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatoBytes(t.bytes)} · {t.filas.toLocaleString('es-ES')} filas
              </span>
            </li>
          ))}
        </ul>
      </Panelito>

      <Panelito className="space-y-2">
        <h3 className="text-sm font-extrabold text-foreground">Previsión</h3>
        {uso.historial.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Guardo una foto del uso cada día que abres esta pantalla. Con 2 o más días podré calcular el ritmo de crecimiento.
          </p>
        ) : (
          <p className="text-sm text-foreground">
            Crecimiento medio: <strong>{formatoBytes(gDb ?? 0)}/día</strong> en la base ({uso.historial.length} fotos desde {uso.historial[0].dia}).
            {dias !== null && <> Llegarías al {config.umbralAlerta}% en unos <strong>{dias} días</strong>.</>}
          </p>
        )}
      </Panelito>

      <Panelito className="space-y-2">
        <h3 className="text-sm font-extrabold text-foreground">GitHub</h3>
        <p className="text-sm text-muted-foreground">
          Para ver los minutos de Actions y el almacenamiento hace falta un token de GitHub guardado en una función segura del servidor.
          Si el repositorio es público, Actions es gratis y no hay nada que vigilar. Queda pendiente hasta saber si es público o privado.
        </p>
      </Panelito>
    </div>
  )
}
