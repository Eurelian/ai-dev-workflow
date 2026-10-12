import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, Timer } from 'claude-code'

import type { CacheReading, HeldPrompt, PingLedger } from '../types'
import {
  FALLBACK,
  estimate,
  fmtClock,
  fmtSpan,
  fmtTokens,
  fmtUsd,
  parseTable,
  pingDelayMs,
  priceFor,
  ttlMs,
  usageShare,
  usageUsd,
} from './math'
import type { Prices, Ttl } from './math'

type $ = EngineInterface

const reading = atom({ plugin: 'cache-keeper', key: 'reading' } as const, null)
const ping = atom({ plugin: 'cache-keeper', key: 'ping' } as const, null)
const held = atom({ plugin: 'cache-keeper', key: 'held' } as const, null)
const offer = atom({ plugin: 'cache-keeper', key: 'offer' } as const, null)

/** The yellow phase of the meter: the last minute before the cache goes cold. */
const LAST_MINUTE = 60_000
/** A ping counts as a hit when the cache served at least this share of the prefix. */
const HIT_SHARE = 0.8
const PING_PROMPT = 'Reply with a single period and nothing else.'

type Config = {
  ttl: Ttl
  isSubscription: boolean
  table: Record<string, Prices>
  gateUsd: number
  gateTokens: number
  keepAlive: boolean
  maxIdleMs: number
  preCompact: 'offer' | 'auto' | 'off'
}

function readConfig(options: PluginOptions): Config {
  return {
    ttl: options.ttl === '1h' ? '1h' : '5m',
    isSubscription: options.billing === 'subscription',
    table: parseTable(String(options.priceTable ?? '{}')),
    gateUsd: Number(options.gateUsd ?? 0.5),
    gateTokens: Number(options.gateTokens ?? 100_000),
    keepAlive: options.keepAlive === true,
    maxIdleMs: Number(options.maxIdleMinutes ?? 120) * 60_000,
    preCompact: options.preCompact === 'auto' ? 'auto' : options.preCompact === 'off' ? 'off' : 'offer',
  }
}

/** The module's own per-load values: reset by a reload, rebuilt from `$.state` in session.start. */
let cfg: Config = readConfig({})
let ttl = ttlMs(cfg.ttl)
let isRunning = false
let pingTimer: Timer | undefined
let cwd = ''

/** The model's price row, and whether it is shown as dollars. */
function pricing(model: string): { prices: Prices; inUsd: boolean } {
  const row = priceFor(cfg.table, model)
  return { prices: row ?? FALLBACK, inUsd: row !== undefined && !cfg.isSubscription }
}

/** The cost of the next send, cold, as the meter and the gate word it. */
function coldWords(r: CacheReading): { cold: string; compact: string; isAbove: boolean } {
  const { prices, inUsd } = pricing(r.model)
  const est = estimate(r.prefixTokens, prices, cfg.ttl)
  if (inUsd) {
    return {
      cold: `≈ ${fmtUsd(est.coldUsd)}`,
      compact: `≈ ${fmtUsd(est.compactColdUsd)}`,
      isAbove: cfg.gateUsd > 0 && est.coldUsd > cfg.gateUsd,
    }
  }
  return {
    cold: `${fmtTokens(r.prefixTokens)} tokens written`,
    compact: `${fmtTokens(r.prefixTokens)} tokens read uncached`,
    isAbove: cfg.gateTokens > 0 && r.prefixTokens > cfg.gateTokens,
  }
}

async function meter($: $): Promise<void> {
  const r = await read($, reading)
  if (r === null) {
    $.ui.status(undefined)
    return
  }
  if (isRunning) {
    $.ui.status('cache 🟢 turn running')
    return
  }
  const now = await $.clock.now()
  const left = r.lastHitAt + ttl - now
  const { prices, inUsd } = pricing(r.model)
  const est = estimate(r.prefixTokens, prices, cfg.ttl)
  const cold = coldWords(r).cold
  if (left <= 0) {
    $.ui.status(`cache 🔴 cold · next ${cold}`)
    return
  }
  const dot = left <= LAST_MINUTE ? '🟡' : '🟢'
  const next = inUsd
    ? `next ≈ ${fmtUsd(est.warmUsd)} · cold ${cold}`
    : `${fmtTokens(r.prefixTokens)} cached · cold ≈ ${Math.round(1 / est.pingShare)}× a warm send`
  let keep = ''
  const l = await read($, ping)
  if (cfg.keepAlive && l !== null) {
    keep = l.stoppedBecause
      ? ' · keep-alive stopped'
      : l.count > 0
        ? ` · kept warm ×${l.count} (${Math.round(l.spentShare * 100)}% of a rewrite)`
        : ''
  }
  $.ui.status(`cache ${dot} warm ${fmtClock(left)} left · ${next}${keep}`)
}

function cancelPing(): void {
  pingTimer?.cancel()
  pingTimer = undefined
}

/** Stops the keep-alive for this idle stretch, says why, and offers a warm compaction. */
async function stopPinging($: $, why: string, r: CacheReading): Promise<void> {
  cancelPing()
  await update($, ping, l => (l === null ? l : { ...l, stoppedBecause: why }))
  $.ui.toast(`Stopped keeping the cache warm: ${why}.`)
  const now = await $.clock.now()
  const coldAt = r.lastHitAt + ttl
  if (cfg.preCompact === 'off' || coldAt <= now) return
  if (cfg.preCompact === 'auto') {
    await compactWarm($)
    return
  }
  await update($, offer, () => ({ coldAt, why }))
}

async function compactWarm($: $): Promise<void> {
  await update($, offer, () => null)
  try {
    const done = await $.session.compact()
    if (done.skip !== undefined) $.ui.toast(`Compaction skipped: ${done.skip}`)
  } catch {
    $.ui.toast('Could not compact now (a turn is running).')
  }
}

/** Whether one more ping after this moment would go past a stop: the reason, or undefined. */
function stopReason(r: CacheReading, l: PingLedger, now: number, extraShare: number): string | undefined {
  const idle = now + pingDelayMs(cfg.ttl) - l.idleSince
  if (idle > cfg.maxIdleMs) return `you've been away ${fmtSpan(now - l.idleSince)}`
  const { prices } = pricing(r.model)
  const next = estimate(r.prefixTokens, prices, cfg.ttl).pingShare
  if (l.spentShare + extraShare + next > 1) return 'more pings would cost more than one cold rewrite'
  return undefined
}

async function armPing($: $): Promise<void> {
  cancelPing()
  if (!cfg.keepAlive || isRunning) return
  const r = await read($, reading)
  const l = await read($, ping)
  if (r === null || l === null || l.stoppedBecause !== undefined) return
  const now = await $.clock.now()
  if (now >= r.lastHitAt + ttl) return
  const wait = Math.max(1_000, r.lastHitAt + pingDelayMs(cfg.ttl) - now)
  pingTimer = $.clock.after(wait, () => void firePing($))
}

async function firePing($: $): Promise<void> {
  pingTimer = undefined
  const r = await read($, reading)
  const l = await read($, ping)
  if (isRunning || r === null || l === null || l.stoppedBecause !== undefined) return
  const now = await $.clock.now()
  if (now >= r.lastHitAt + ttl) return
  const before = stopReason(r, l, now, 0)
  if (before !== undefined) {
    await stopPinging($, before, r)
    return
  }
  const res = await $.model.fork({ prompt: PING_PROMPT })
  if (isRunning) return
  if (!res.isAnswered && res.reason === 'nothing-to-fork') {
    await stopPinging($, 'there is nothing to keep warm', r)
    return
  }
  const { prices } = pricing(r.model)
  const share = usageShare(res.usage, r.prefixTokens, prices, cfg.ttl)
  const usd = usageUsd(res.usage, prices, cfg.ttl)
  const ledger = await update($, ping, old =>
    old === null ? old : { ...old, count: old.count + 1, spentShare: old.spentShare + share, spentUsd: old.spentUsd + usd },
  )
  const isHit = res.usage.cache_read_input_tokens >= HIT_SHARE * r.prefixTokens
  if (!isHit) {
    await stopPinging($, `a ping found only ${fmtTokens(res.usage.cache_read_input_tokens)} of ${fmtTokens(r.prefixTokens)} tokens cached`, r)
    return
  }
  const hitAt = await $.clock.now()
  const fresh = await update($, reading, old => (old === null ? old : { ...old, lastHitAt: hitAt }))
  if (fresh === null || ledger === null) return
  // Stop after this ping, not at the next one, so a warm compaction has the whole TTL.
  const after = stopReason(fresh, ledger, hitAt, 0)
  if (after !== undefined) {
    await stopPinging($, after, fresh)
    return
  }
  await armPing($)
}

async function handoffNotes($: $, text: string): Promise<string> {
  const found = await $.session.messages()
  const rows = 'deny' in found ? [] : found
  const asks = rows.filter(m => m.role === 'user' && m.text.trim() !== '').slice(-5)
  const lastAnswer = [...rows].reverse().find(m => m.role === 'assistant' && m.text.trim() !== '')
  const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s)
  return [
    '# STATE',
    '',
    'Written by Cache Keeper as a handoff from a session whose prompt cache had gone cold.',
    '',
    '## Recent requests',
    ...asks.map(m => `- ${clip(m.text.replace(/\s+/g, ' '), 400)}`),
    '',
    '## Last answer',
    clip(lastAnswer?.text ?? '(none)', 3_000),
    '',
    '## Next request',
    text,
    '',
  ].join('\n')
}

/** Acts on a held prompt: the gate band's four buttons. */
async function resolveHeld($: $, choice: 'send' | 'compact' | 'handoff' | 'cancel'): Promise<void> {
  const prompt: HeldPrompt | null = await read($, held)
  await update($, held, () => null)
  if (prompt === null) return
  if (choice === 'cancel') {
    await $.prompt.fill({ text: prompt.text })
    return
  }
  if (choice === 'handoff') {
    const path = `${cwd || (await $.session.cwd())}/STATE.md`
    await $.fs.write(path, await handoffNotes($, prompt.text))
    await $.prompt.fill({ text: `Read @STATE.md and continue: ${prompt.text}` })
    $.ui.toast('Wrote STATE.md. Run /clear, then send the prompt waiting in the input.')
    return
  }
  if (choice === 'compact') {
    $.ui.toast('Compacting, then sending your prompt.')
    try {
      const done = await $.session.compact()
      if (done.skip !== undefined) $.ui.toast(`Compaction skipped: ${done.skip}`)
    } catch {
      $.ui.toast('Could not compact now; sending as is.')
    }
  }
  await $.prompt.submit({ text: prompt.text, asUser: true })
}

export const register: Register = (on, options) => {
  cfg = readConfig(options)
  ttl = ttlMs(cfg.ttl)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    cwd = e.cwd
    $.clock.every(1_000, () => void meter($))
    await armPing($)

    return result
  })

  on('turn.start', async ($, e, next) => {
    isRunning = true
    cancelPing()
    await update($, offer, () => null)
    await update($, held, () => null)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    isRunning = false
    if (e.usage === undefined) return result
    const { context } = await $.session.usage()
    if (context.tokens === undefined) return result
    const now = await $.clock.now()
    await update($, reading, () => ({ lastHitAt: now, prefixTokens: context.tokens ?? 0, model: e.usage?.model ?? '' }))
    await update($, ping, () => ({ count: 0, spentUsd: 0, spentShare: 0, idleSince: now }))
    await armPing($)

    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && result.skip === undefined) {
      // The compacted prefix is not cached until the next response writes it; that write is small.
      cancelPing()
      await update($, reading, () => null)
      await update($, ping, () => null)
      await update($, offer, () => null)
    }

    return result
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    cancelPing()
    await update($, reading, () => null)
    await update($, ping, () => null)
    await update($, held, () => null)
    await update($, offer, () => null)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const isPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (!isPerson || e.turnId !== undefined) return next(e)
    const r = await read($, reading)
    if (r === null) return next(e)
    const now = await $.clock.now()
    const coldFor = now - (r.lastHitAt + ttl)
    if (coldFor <= 0) return next(e)
    const words = coldWords(r)
    if (!words.isAbove) return next(e)
    await update($, held, () => ({
      text: e.text,
      coldForMs: coldFor,
      prefixTokens: r.prefixTokens,
      coldCost: words.cold,
      compactCost: words.compact,
      hadAttachments: (e.attachments?.length ?? 0) > 0,
    }))

    return {
      drop: `Cache Keeper held this prompt: the cache went cold ${fmtSpan(coldFor)} ago and sending now rewrites ${fmtTokens(r.prefixTokens)} tokens (${words.cold}). Choose above the prompt.`,
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const hp = await read($, held)
    const o = await read($, offer)
    const { Box, Button, Text } = $.ui.resolve(e)

    if (hp !== null) {
      const tok = fmtTokens(hp.prefixTokens)
      return (
        <Box flexDirection="column">
          <Text>
            Cache is cold (went cold {fmtSpan(hp.coldForMs)} ago). Sending now rewrites {tok} tokens{' '}
            <Text bold>{hp.coldCost}</Text>.
          </Text>
          <Text dimColor>
            Send cold: {hp.coldCost} now, then warm turns on {tok}. Compact cold: {hp.compactCost} now, then turns on a
            much smaller context.
          </Text>
          {hp.hadAttachments ? <Text color="warning">Attachments in the held prompt are not re-sent.</Text> : null}
          <Box flexDirection="row">
            <Button key="send" label="Send anyway" hotkey="s" variant="primary" onPress={() => resolveHeld($, 'send')} />
            <Text> </Text>
            <Button key="compact" label="Compact first" hotkey="c" onPress={() => resolveHeld($, 'compact')} />
            <Text> </Text>
            <Button key="handoff" label="Handoff to new session" hotkey="h" onPress={() => resolveHeld($, 'handoff')} />
            <Text> </Text>
            <Button key="cancel" label="Cancel" hotkey="x" role="dismiss" onPress={() => resolveHeld($, 'cancel')} />
          </Box>
        </Box>
      )
    }

    if (o !== null) {
      const r = await read($, reading)
      const est = r === null ? undefined : estimate(r.prefixTokens, pricing(r.model).prices, cfg.ttl)
      const cost = r !== null && est !== undefined && pricing(r.model).inUsd ? ` (≈ ${fmtUsd(est.compactWarmUsd)})` : ''
      return (
        <Box flexDirection="column">
          <Text>
            Keep-alive stopped ({o.why}). Compacting now, while the cache is warm, reads it at the cache rate{cost}.
          </Text>
          <Box flexDirection="row">
            <Button key="compact-warm" label="Compact now" hotkey="c" variant="primary" onPress={() => compactWarm($)} />
            <Text> </Text>
            <Button
              key="let-go"
              label="Let it go cold"
              hotkey="x"
              role="dismiss"
              onPress={() => update($, offer, () => null)}
            />
          </Box>
        </Box>
      )
    }

    return next(e)
  })
}
