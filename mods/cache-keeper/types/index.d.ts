/** The cached prefix as the last main-loop response left it. */
export type CacheReading = {
  /** When the last main-loop response arrived, ms since the epoch. */
  lastHitAt: number
  /** Input tokens that response was answered over: the prefix a warm send reads. */
  prefixTokens: number
  /** The model id that answered. */
  model: string
}

/** The keep-alive pings of the current idle stretch. */
export type PingLedger = {
  count: number
  /** What the pings cost, in USD (0 when the model has no price row). */
  spentUsd: number
  /** What the pings cost, in cold-rewrite equivalents (0..1+). */
  spentShare: number
  /** When the idle stretch began. */
  idleSince: number
  /** Why pinging stopped, once it has. */
  stoppedBecause?: string
}

/** A prompt the cold-send gate is holding. */
export type HeldPrompt = {
  text: string
  /** How long ago the cache went cold, in ms, when the prompt was held. */
  coldForMs: number
  prefixTokens: number
  /** The estimated cost of sending it cold, as the meter words it. */
  coldCost: string
  /** The estimated cost of compacting it cold, as the meter words it. */
  compactCost: string
  hadAttachments: boolean
}

/** The pre-emptive compaction offer, while the cache is still warm. */
export type CompactOffer = {
  /** When the cache goes cold. */
  coldAt: number
  why: string
}

declare module 'claude-code' {
  interface PluginState {
    'cache-keeper': {
      reading: CacheReading | null
      ping: PingLedger | null
      held: HeldPrompt | null
      offer: CompactOffer | null
    }
  }
}
