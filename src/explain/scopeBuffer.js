// Scope buffer: the recent levels of each output pin, for the scope card and
// the what if comparison. Pure module.
//
// createScopeBuffer({ windowMs = 10000 }) -> { record(event), samples(pin,
//   fromMs, toMs), has(pin), clear() }
// record takes runner output events { kind, pin, value, at }: a pin event is
// its level (0 to 1, PWM is the duty), a tone event 1 while it plays, a servo
// event its angle / 180. Events older than the window are dropped, except the
// last one before it, which still sets the level at the start of the window.
// samples gives the level at fromMs plus every change after it up to toMs, as
// [{ at, value }].
//
// summarize(samples, fromMs, toMs) -> { highMs, lowMs, periodMs, duty,
//   transitions, pwm }: digital pins average their HIGH and LOW stretches over
// complete stretches (ones that start and end with a change inside the
// window); a level strictly between 0 and 1 counts as PWM, and duty is the
// time weighted average either way.
// scopeText(pin, summary, { changed }) words it.
export const SCOPE_WINDOW_MS = 10000

export function levelOf(event) {
  if (event.kind === 'pin') return Math.min(1, Math.max(0, Number(event.value) || 0))
  if (event.kind === 'tone') return event.value > 0 ? 1 : 0
  if (event.kind === 'servo') return Math.min(1, Math.max(0, (Number(event.value) || 0) / 180))
  return null
}

export function createScopeBuffer({ windowMs = SCOPE_WINDOW_MS } = {}) {
  const byPin = new Map()

  function record(event) {
    if (!event || typeof event.pin !== 'string' || !Number.isFinite(event.at)) return
    const value = levelOf(event)
    if (value === null) return
    if (!byPin.has(event.pin)) byPin.set(event.pin, [])
    const list = byPin.get(event.pin)
    list.push({ at: event.at, value })
    // Keep the window, plus the one event before it that sets its first level.
    const start = event.at - windowMs
    let first = 0
    while (first + 1 < list.length && list[first + 1].at <= start) first++
    if (first > 0) list.splice(0, first)
  }

  function samples(pin, fromMs, toMs) {
    const list = byPin.get(pin) || []
    let level = 0
    const out = []
    for (const entry of list) {
      if (entry.at <= fromMs) level = entry.value
      else if (entry.at <= toMs) out.push({ at: entry.at, value: entry.value })
    }
    return [{ at: fromMs, value: level }, ...out]
  }

  return {
    record,
    samples,
    has: (pin) => (byPin.get(pin) || []).length > 0,
    clear: () => byPin.clear()
  }
}

const average = (list) => (list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : null)

export function summarize(samples, fromMs, toMs) {
  const merged = []
  for (const sample of samples || []) {
    if (merged.length && merged[merged.length - 1].value === sample.value) continue
    merged.push(sample)
  }
  const segments = merged.map((sample, i) => ({ start: sample.at, end: i + 1 < merged.length ? merged[i + 1].at : toMs, value: sample.value }))
  const span = toMs - fromMs
  const duty = span > 0 ? segments.reduce((sum, seg) => sum + seg.value * (seg.end - seg.start), 0) / span : merged.length ? merged[0].value : 0
  const pwm = segments.some((seg) => seg.value > 0 && seg.value < 1)
  const complete = segments.slice(1, -1)
  const highMs = average(complete.filter((seg) => seg.value >= 0.5).map((seg) => seg.end - seg.start))
  const lowMs = average(complete.filter((seg) => seg.value < 0.5).map((seg) => seg.end - seg.start))
  return {
    highMs,
    lowMs,
    periodMs: highMs !== null && lowMs !== null ? highMs + lowMs : null,
    duty,
    transitions: Math.max(0, merged.length - 1),
    pwm,
    level: merged.length ? merged[merged.length - 1].value : 0
  }
}

// ms rounded to the nearest 10 above 100, else to a whole number.
export function roundMs(ms) {
  return ms > 100 ? Math.round(ms / 10) * 10 : Math.round(ms)
}

export function scopeText(pin, summary, { changed = true } = {}) {
  if (!changed) return `${pin} has not changed since Run.`
  if (summary.pwm) return `${pin} averages ${Math.round(summary.duty * 100)}% on (analogWrite about ${Math.round(summary.duty * 255)}).`
  if (summary.transitions === 0) return `${pin} stays ${summary.level >= 0.5 ? 'HIGH' : 'LOW'}.`
  if (summary.periodMs !== null) {
    return `${pin} is HIGH for about ${roundMs(summary.highMs)} ms, then LOW for about ${roundMs(summary.lowMs)} ms: one cycle every ${roundMs(summary.periodMs)} ms.`
  }
  return `${pin} is changing. Watch a little longer for a full cycle.`
}

// The summary text for the last seconds up to toMs; when that is too short
// for a full cycle, the whole buffer window is used instead.
export function describePin(buffer, pin, toMs, seconds, windowMs = SCOPE_WINDOW_MS) {
  const changed = buffer.has(pin)
  const fromMs = toMs - seconds * 1000
  const summary = summarize(buffer.samples(pin, fromMs, toMs), fromMs, toMs)
  if (!changed || summary.pwm || summary.transitions === 0 || summary.periodMs !== null) return scopeText(pin, summary, { changed })
  const wide = summarize(buffer.samples(pin, toMs - windowMs, toMs), toMs - windowMs, toMs)
  return scopeText(pin, wide.periodMs !== null ? wide : summary)
}
