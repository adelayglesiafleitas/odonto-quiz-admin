import { supabase } from './supabase'

// Uso y límites de Supabase. La parte automática viene de la RPC admin_uso()
// (tamaño de la base, storage, usuarios). Egress y conexiones Realtime no se
// pueden medir desde SQL: se cargan a mano y quedan en admin_uso_config.

export type Plan = 'free' | 'pro' | 'otro'

export interface LimitesPlan {
  dbBytes: number
  storageBytes: number
  mau: number
  egressGb: number
  realtime: number
}

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

export const LIMITES: Record<Plan, LimitesPlan> = {
  free: { dbBytes: 500 * MB, storageBytes: 1 * GB, mau: 50000, egressGb: 5, realtime: 200 },
  pro: { dbBytes: 8 * GB, storageBytes: 100 * GB, mau: 100000, egressGb: 250, realtime: 500 },
  otro: { dbBytes: 8 * GB, storageBytes: 100 * GB, mau: 100000, egressGb: 250, realtime: 500 },
}

export interface TablaUso {
  tabla: string
  bytes: number
  filas: number
}
export interface PuntoUso {
  dia: string
  dbBytes: number
  storageBytes: number
  usuarios: number
}
export interface UsoActual {
  dbBytes: number
  storageBytes: number
  storageObjs: number
  usuarios: number
  mau: number
  tablas: TablaUso[]
  historial: PuntoUso[]
}
export interface ConfigUso {
  plan: Plan
  egressGb: number | null
  realtimeConexiones: number | null
  manualActualizadoEn: string | null
  umbralAviso: number
  umbralAlerta: number
  umbralCritico: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function obtenerUso(): Promise<UsoActual | null> {
  const { data, error } = await supabase.rpc('admin_uso')
  if (error || !data) return null
  const d = data as any
  return {
    dbBytes: Number(d.db_bytes ?? 0),
    storageBytes: Number(d.storage_bytes ?? 0),
    storageObjs: Number(d.storage_objs ?? 0),
    usuarios: Number(d.usuarios ?? 0),
    mau: Number(d.mau ?? 0),
    tablas: ((d.tablas ?? []) as any[]).map((t) => ({ tabla: t.tabla, bytes: Number(t.bytes), filas: Number(t.filas) })),
    historial: ((d.historial ?? []) as any[]).map((h) => ({
      dia: h.dia,
      dbBytes: Number(h.db_bytes),
      storageBytes: Number(h.storage_bytes),
      usuarios: Number(h.usuarios),
    })),
  }
}

export async function obtenerConfigUso(): Promise<ConfigUso> {
  const { data } = await supabase.from('admin_uso_config').select('*').eq('id', true).maybeSingle()
  return {
    plan: (data?.plan as Plan) ?? 'free',
    egressGb: data?.egress_gb ?? null,
    realtimeConexiones: data?.realtime_conexiones ?? null,
    manualActualizadoEn: data?.manual_actualizado_en ?? null,
    umbralAviso: data?.umbral_aviso ?? 70,
    umbralAlerta: data?.umbral_alerta ?? 85,
    umbralCritico: data?.umbral_critico ?? 95,
  }
}

export async function guardarConfigUso(p: Partial<ConfigUso>): Promise<string | null> {
  const f: Record<string, unknown> = {}
  if (p.plan !== undefined) f.plan = p.plan
  if (p.egressGb !== undefined) {
    f.egress_gb = p.egressGb
    f.manual_actualizado_en = new Date().toISOString()
  }
  if (p.realtimeConexiones !== undefined) {
    f.realtime_conexiones = p.realtimeConexiones
    f.manual_actualizado_en = new Date().toISOString()
  }
  const { error } = await supabase.from('admin_uso_config').update(f).eq('id', true)
  return error?.message ?? null
}

export type Nivel = 'ok' | 'aviso' | 'alerta' | 'critico'

export function nivelDe(pct: number, c: Pick<ConfigUso, 'umbralAviso' | 'umbralAlerta' | 'umbralCritico'>): Nivel {
  if (pct >= c.umbralCritico) return 'critico'
  if (pct >= c.umbralAlerta) return 'alerta'
  if (pct >= c.umbralAviso) return 'aviso'
  return 'ok'
}

export function formatoBytes(b: number): string {
  if (b >= GB) return `${(b / GB).toFixed(2)} GB`
  if (b >= MB) return `${(b / MB).toFixed(b >= 100 * MB ? 0 : 1)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} kB`
  return `${b} B`
}

// Crecimiento medio diario (bytes/día) con el historial; null si hay < 2 puntos.
export function crecimientoDiario(h: PuntoUso[], campo: 'dbBytes' | 'storageBytes'): number | null {
  if (h.length < 2) return null
  const a = h[0]
  const b = h[h.length - 1]
  const dias = (new Date(b.dia).getTime() - new Date(a.dia).getTime()) / 86400000
  if (dias <= 0) return null
  return Math.max(0, (b[campo] - a[campo]) / dias)
}

export function diasHastaLimite(actual: number, limite: number, porDia: number | null): number | null {
  if (!porDia || porDia <= 0) return null
  return Math.max(0, Math.round((limite - actual) / porDia))
}
