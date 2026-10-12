# Cache Keeper

A Claude Code mod that shows whether the prompt cache is still warm, can keep it warm while that is cheaper, and asks before a send that would rewrite the whole cache.

## What it does

1. **Meter** (status line, ticks every second):
   `cache 🟢 warm 3:12 left · next ≈ $0.08 · cold ≈ $2.00` → 🟡 in the last minute → `cache 🔴 cold · next ≈ $2.00`.
   The prefix size comes from the last main-loop response (`$.session.usage().context.tokens`).
2. **Cold-send gate** (`prompt.submit`): when the cache is cold and the rewrite would cost more than `gateUsd` (or more than `gateTokens` tokens on a subscription), the prompt is held. A band above the prompt offers **Send anyway**, **Compact first**, **Handoff to new session** and **Cancel**.
   - Handoff writes `STATE.md` from the transcript without calling the model. It puts `Read @STATE.md and continue: …` in the input and asks you to run `/clear`.
   - Cancel puts your text back in the input.
   - The gate fails open: if the hook errors, the prompt is sent as usual.
3. **Keep-alive ping** (off by default, `keepAlive`): after each turn it sets a timer for TTL − 1 min (5m) or TTL − 5 min (1h). The timer runs `$.model.fork`, which replays the cached prefix and resets its TTL. It stops when either of these is true:
   - the pings so far plus the next one would cost more than one cold rewrite;
   - the next ping would come after `maxIdleMinutes` of idle time.
   It also stops if a ping finds less than 80% of the prefix cached.
4. **Compact while warm** (`preCompact`: `offer` | `auto` | `off`): when the keep-alive stops, it offers a compaction right away (or runs it with `auto`). The cache still has a full TTL left at that point, so the compaction reads the context at the cache-read rate.

## Settings (`userConfig`)

| Field | Default | Meaning |
| --- | --- | --- |
| `ttl` | `5m` | `5m` or `1h`. The engine doesn't say which write tier was used, so you set it here. |
| `billing` | `api` | `subscription` shows tokens and "× a warm send" instead of dollars. |
| `priceTable` | Opus row from the design note | JSON, USD per million tokens, keyed by a substring of the model id. **Check these against current pricing.** A model with no row is shown in tokens. |
| `gateUsd` | `0.5` | Gate threshold in dollars; `0` turns it off. |
| `gateTokens` | `100000` | Gate threshold in tokens (subscription or unpriced model); `0` turns it off. |
| `keepAlive` | `false` | Turns on the ping. |
| `maxIdleMinutes` | `120` | Longest idle stretch the ping covers. |
| `preCompact` | `offer` | What happens when the keep-alive stops. |

## Known limits (v1)

- Subagents' caches are not tracked.
- The gate doesn't run on `--resume`, because the reading lives in session state.
- Attachments in a held prompt are not re-sent; the band warns you about this.
- Output and summary costs are rough estimates (output priced at 5× input, summary about 2k tokens).
- Open question from the design: check in `/usage` that a fork's ping refreshes the same prefix the next main turn reads. The mod checks this itself: if a ping's `cache_read_input_tokens` is below 80% of the prefix, it stops and says so.

## Develop

```
claude plugin validate mods/cache-keeper
claude plugin test mods/cache-keeper
claude --plugin-dir mods/cache-keeper
```
