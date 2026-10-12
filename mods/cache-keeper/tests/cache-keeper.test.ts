import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { estimate, parseTable, priceFor } from '../hooks/math'

const PREFIX = 400_000
const MODEL = 'claude-opus-5-5'
const BAND = {
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 100, scroll: { offset: 0, bodyRows: 8 }, view: {} },
} as const

type World = { statuses: string[]; toasts: string[]; sent: string[]; forks: number; compactions: number }

/** The engine beneath the plugin: usage, fork, compaction and the prompt's bottom, recorded. */
function world(on: On): World {
  const w: World = { statuses: [], toasts: [], sent: [], forks: 0, compactions: 0 }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: PREFIX, window: 1_000_000 }, rateLimits: [] } }))
  on('ui.status', ($, e) => {
    if (e.text !== undefined) w.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    w.sent.push(e.text)
    return { text: e.text }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer, usage: e.usage }))
  on('model.fork', () => {
    w.forks += 1
    return {
      value: {
        isAnswered: true as const,
        text: '.',
        usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: PREFIX, cache_creation_input_tokens: 0 },
      },
    }
  })
  on('session.compact', () => {
    w.compactions += 1
    return { messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }
  })
  // The engine's own band: empty.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => h($.ui.resolve(e).Box, {}) as never)
  return w
}

async function finishTurn($: Engine): Promise<void> {
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete({
    answer: 'done',
    durationMs: 1_000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: { model: MODEL, input_tokens: 5, output_tokens: 50, cache_read_input_tokens: PREFIX, cache_creation_input_tokens: 0 },
  })
}

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } as const })

test('the maths matches the worked example for Opus at 400k tokens', () => {
  const prices = priceFor(parseTable('{"opus":{"input":4,"write5m":5,"write1h":8,"read":0.2}}'), MODEL)
  expect(prices).toBeDefined()
  if (prices === undefined) return
  const five = estimate(PREFIX, prices, '5m')
  expect(Math.abs(five.warmUsd - 0.08) < 1e-9).toBe(true)
  expect(Math.abs(five.coldUsd - 2.0) < 1e-9).toBe(true)
  expect(Math.abs(five.compactColdUsd - 1.64) < 1e-9).toBe(true)
  expect(Math.abs(estimate(PREFIX, prices, '1h').coldUsd - 3.2) < 1e-9).toBe(true)
  expect(priceFor(parseTable('not json'), MODEL)).toBeUndefined()
})

test('the meter counts down warm, turns yellow, then cold', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(1_000)
  expect(w.statuses.at(-1)).toContain('cache 🟢 warm 4:59 left · next ≈ $0.08 · cold ≈ $2.00')
  await clock.advance(4 * 60_000 + 30_000)
  expect(w.statuses.at(-1)).toContain('🟡')
  await clock.advance(60_000)
  expect(w.statuses.at(-1)).toBe('cache 🔴 cold · next ≈ $2.00')
})

test('a warm prompt goes straight through', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(60_000)
  const sent = await $.prompt.submit(typed('next step'))
  expect(sent.drop).toBeUndefined()
  expect(w.sent).toEqual(['next step'])
})

test('a cold prompt is held, and Send anyway sends it', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(20 * 60_000)
  const held = await $.prompt.submit(typed('next step'))
  expect(held.drop).toContain('went cold 15 min ago')
  expect(w.sent).toEqual([])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cache-keeper', surface, ...BAND })
    expect(await ui.find({ key: 'send' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ plugin: 'cache-keeper', surface: 'terminal', ...BAND })
  await ui.press({ key: 'send' })
  expect(w.sent).toEqual(['next step'])
  await ui.unmount()
})

test('Compact first compacts, then sends', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(20 * 60_000)
  await $.prompt.submit(typed('next step'))
  const ui = await $.ui.mount({ plugin: 'cache-keeper', surface: 'terminal', ...BAND })
  await ui.press({ key: 'compact' })
  expect(w.compactions).toBe(1)
  expect(w.sent).toEqual(['next step'])
  await ui.unmount()
})

test('the gate stays out of the way below its threshold', { options: { gateUsd: 5 } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(20 * 60_000)
  const sent = await $.prompt.submit(typed('next step'))
  expect(sent.drop).toBeUndefined()
  expect(w.sent).toEqual(['next step'])
})

test('no ping unless keep-alive is on', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(30 * 60_000)
  expect(w.forks).toBe(0)
})

test('keep-alive pings until one cold rewrite is spent, then offers a warm compaction', { timeoutMs: 60_000, options: { keepAlive: true, maxIdleMinutes: 600 } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(4 * 60_000 + 1_000)
  expect(w.forks).toBe(1)
  expect(w.statuses.at(-1)).toContain('kept warm ×1')
  for (let i = 0; i < 4; i += 1) await clock.advance(50 * 60_000)
  expect(w.forks).toBeGreaterThanOrEqual(22)
  expect(w.forks).toBeLessThanOrEqual(25)
  expect(w.toasts.some(t => t.includes('cold rewrite'))).toBe(true)
  // The offer was made while warm; by now it is cold, but the band still shows it until dismissed.
  const ui = await $.ui.mount({ plugin: 'cache-keeper', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'compact-warm' })).toBeDefined()
  await ui.press({ key: 'let-go' })
  expect(await ui.find({ key: 'compact-warm' })).toBeUndefined()
  await ui.unmount()
})

test('keep-alive stops at the max-idle cap', { timeoutMs: 60_000, options: { keepAlive: true, maxIdleMinutes: 30, preCompact: 'off' } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  for (let i = 0; i < 3; i += 1) await clock.advance(40 * 60_000)
  expect(w.forks).toBeLessThanOrEqual(7)
  expect(w.toasts.some(t => t.includes("you've been away"))).toBe(true)
})

test('a new prompt cancels the pending ping', { options: { keepAlive: true } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const w = world(on)
  await finishTurn($)
  await clock.advance(60_000)
  await $.turn.start({ text: 'again', turnId: 't2' })
  await clock.advance(10 * 60_000)
  expect(w.forks).toBe(0)
})
