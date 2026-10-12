import type { ModelUsage } from 'claude-code'

/** USD per million tokens for one model family. */
export type Prices = { input: number; write5m: number; write1h: number; read: number }

export type Ttl = '5m' | '1h'

/** The relative weights used where a model has no price row (shares only, never shown as dollars). */
export const FALLBACK: Prices = { input: 4, write5m: 5, write1h: 8, read: 0.2 }

/** Output is priced at this multiple of input when estimating a summary or a ping reply. */
const OUTPUT_MULTIPLE = 5
/** Rough size of a compaction summary, in output tokens. */
const SUMMARY_TOKENS = 2_000

/** Parses the `priceTable` option; a malformed table is treated as empty. */
export function parseTable(json: string): Record<string, Prices> {
  try {
    const raw: unknown = JSON.parse(json)
    if (raw === null || typeof raw !== 'object') return {}
    const table: Record<string, Prices> = {}
    for (const [key, row] of Object.entries(raw as Record<string, unknown>)) {
      const r = row as Partial<Prices>
      if ([r.input, r.write5m, r.write1h, r.read].every(n => typeof n === 'number')) {
        table[key.toLowerCase()] = r as Prices
      }
    }
    return table
  } catch {
    return {}
  }
}

/** The row whose key is the longest substring of the model id. */
export function priceFor(table: Record<string, Prices>, model: string): Prices | undefined {
  const id = model.toLowerCase()
  const key = Object.keys(table)
    .filter(k => id.includes(k))
    .sort((a, b) => b.length - a.length)[0]
  return key === undefined ? undefined : table[key]
}

export const ttlMs = (ttl: Ttl): number => (ttl === '1h' ? 3_600_000 : 300_000)

/** When to ping after the last hit: a minute early for 5m, five minutes early for 1h. */
export const pingDelayMs = (ttl: Ttl): number => (ttl === '1h' ? 55 * 60_000 : 4 * 60_000)

const writeRate = (p: Prices, ttl: Ttl): number => (ttl === '1h' ? p.write1h : p.write5m)

export type Estimate = {
  /** The next send while warm: the prefix read from cache. */
  warmUsd: number
  /** The next send once cold: the prefix written again. */
  coldUsd: number
  /** Compacting once cold: the prefix read uncached plus a summary. */
  compactColdUsd: number
  /** Compacting while warm: the prefix read from cache plus a summary. */
  compactWarmUsd: number
  /** One keep-alive ping as a share of one cold rewrite. */
  pingShare: number
}

export function estimate(prefixTokens: number, prices: Prices, ttl: Ttl): Estimate {
  const m = prefixTokens / 1e6
  const summary = (SUMMARY_TOKENS / 1e6) * prices.input * OUTPUT_MULTIPLE
  return {
    warmUsd: m * prices.read,
    coldUsd: m * writeRate(prices, ttl),
    compactColdUsd: m * prices.input + summary,
    compactWarmUsd: m * prices.read + summary,
    pingShare: prices.read / writeRate(prices, ttl),
  }
}

/** What a call cost, in USD at these prices (cache writes at the TTL's rate). */
export function usageUsd(u: ModelUsage, prices: Prices, ttl: Ttl): number {
  return (
    (u.input_tokens * prices.input +
      u.output_tokens * prices.input * OUTPUT_MULTIPLE +
      u.cache_read_input_tokens * prices.read +
      u.cache_creation_input_tokens * writeRate(prices, ttl)) /
    1e6
  )
}

/** What a call cost as a share of one cold rewrite of the prefix. */
export function usageShare(u: ModelUsage, prefixTokens: number, prices: Prices, ttl: Ttl): number {
  const cold = (prefixTokens / 1e6) * writeRate(prices, ttl)
  return cold > 0 ? usageUsd(u, prices, ttl) / cold : 1
}

export function fmtUsd(usd: number): string {
  return usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(Math.round(n))
}

/** A countdown: `3:12`, or `54:10`, or `1:02:03`. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

/** A duration in words: `40s`, `14 min`, `1h40m`. */
export function fmtSpan(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return `${Math.max(0, Math.round(ms / 1000))}s`
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}m`
}
