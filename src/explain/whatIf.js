// What if: a pretend copy with one change, compared with the real one. The
// learner's build and code are never changed. Pure module.
//
// whatIfCode({ lessonId, source, values, line, text }) -> { pin, before, after, error }
// runs the current source and the source with line (1 based) replaced by text
// for 3000 ms each with runHeadless, then summarizes the lesson's main output
// pin (the LED pin, the red pin of an RGB LED, D8 for the buzzer, D9 for the
// servo) for both: { summary, samples, text }. error is null or { message, line }.
//
// whatIfCircuit(build, change) -> { before, after, changed } with change
// { kind: 'flip' | 'remove' | 'ohms', target, value }: per LED and RGB LED id
// { lit, brightness, blocked, removed }, lit when the path from the LED's
// driving pin reaches GND through it, brightness ledBrightness of the
// resistors on that path (1 with none). changed is the changed part (null
// for remove). Throws nothing: a bad change gives { error }.
import { circuits } from '../circuits/circuits.js'
import { legsOf } from '../circuits/footprints.js'
import { runHeadless } from '../sim/headless.js'
import { tracePath } from './currentPath.js'
import { createScopeBuffer, summarize, scopeText, roundMs } from './scopeBuffer.js'
import { ledBrightness } from '../sim/ohm.js'

export const WHAT_IF_MS = 3000

export function mainPin(lessonId) {
  const circuit = circuits[lessonId]
  if (!circuit) return null
  const led = circuit.parts.find((part) => part.type === 'led' && part.pin)
  if (led) return led.pin
  const rgb = circuit.parts.find((part) => part.type === 'rgbLed' && part.pins)
  if (rgb) return rgb.pins.red
  if (circuit.parts.some((part) => part.type === 'buzzer')) return 'D8'
  if (circuit.parts.some((part) => part.type === 'servo')) return 'D9'
  return null
}

function measureRun({ lessonId, source, values, pin }) {
  const result = runHeadless({ lessonId, source, values, ms: WHAT_IF_MS })
  if (result.error) return { error: result.error }
  const buffer = createScopeBuffer()
  result.events.forEach(buffer.record)
  const samples = buffer.samples(pin, 0, WHAT_IF_MS)
  const summary = summarize(samples, 0, WHAT_IF_MS)
  return { summary, samples, text: scopeText(pin, summary, { changed: buffer.has(pin) }), changed: buffer.has(pin) }
}

export function whatIfCode({ lessonId, source, values = {}, line, text }) {
  const pin = mainPin(lessonId)
  if (!pin) return { pin: null, before: null, after: null, error: { message: 'This lesson has no output pin to compare.', line: null } }
  const lines = String(source).split('\n')
  if (!Number.isInteger(line) || line < 1 || line > lines.length) {
    return { pin, before: null, after: null, error: { message: `The sketch has no line ${line}.`, line: null } }
  }
  const changed = lines.slice()
  changed[line - 1] = String(text)
  const before = measureRun({ lessonId, source, values, pin })
  if (before.error) return { pin, before: null, after: null, error: before.error }
  const after = measureRun({ lessonId, source: changed.join('\n'), values, pin })
  if (after.error) return { pin, before, after: null, error: after.error }
  return { pin, before, after, error: null }
}

// 'one cycle every 1000 ms', for the what if sentence.
export function cyclePhrase(pin, run) {
  if (!run.changed) return `${pin} does not change`
  const { summary } = run
  if (summary.pwm) return `${pin} averages ${Math.round(summary.duty * 100)}% on`
  if (summary.transitions === 0) return `${pin} stays ${summary.level >= 0.5 ? 'HIGH' : 'LOW'}`
  if (summary.periodMs !== null) return `one cycle every ${roundMs(summary.periodMs)} ms`
  return `${pin} keeps changing`
}

function ledsOf(build) {
  return (build.parts || []).filter((part) => (part.type === 'led' || part.type === 'rgbLed') && legsOf(part).length > 0)
}

function ledState(build, led) {
  const pins = led.type === 'led' ? [led.pin] : Object.values(led.pins || {})
  let best = { lit: false, brightness: 0, blocked: false, removed: false }
  for (const pin of pins.filter(Boolean)) {
    const path = tracePath(build, { from: pin })
    if (path.blocked && path.blocked.id === led.id) best = { ...best, blocked: !best.lit }
    if (!path.reachesGround || !path.parts.includes(led.id)) continue
    const ohms = path.parts
      .map((id) => (build.parts || []).find((part) => part.id === id))
      .filter((part) => part.type === 'resistor')
      .reduce((sum, part) => sum + (Number(part.ohms) || 0), 0)
    const brightness = ohms > 0 ? ledBrightness(ohms) : 1
    if (!best.lit || brightness > best.brightness) best = { lit: true, brightness, blocked: false, removed: false }
  }
  return best
}

function states(build) {
  return Object.fromEntries(ledsOf(build).map((led) => [led.id, ledState(build, led)]))
}

export function whatIfCircuit(build, change = {}) {
  const parts = build.parts || []
  const part = parts.find((item) => item.id === change.target && legsOf(item).length > 0)
  if (!part) return { error: `There is no placed part called ${String(change.target)}.` }
  let next
  let changed = null
  if (change.kind === 'flip') {
    if (part.type !== 'led' && part.type !== 'rgbLed') return { error: 'Only an LED can be flipped.' }
    changed = { ...part, legs: legsOf(part).slice().reverse() }
  } else if (change.kind === 'ohms') {
    const ohms = Number(change.value)
    if (part.type !== 'resistor') return { error: 'Only a resistor has ohms to change.' }
    if (!Number.isFinite(ohms) || ohms <= 0) return { error: 'Give the ohms as a number above 0.' }
    changed = { ...part, ohms }
  } else if (change.kind !== 'remove') {
    return { error: `There is no change called ${String(change.kind)}.` }
  }
  next = { ...build, parts: changed ? parts.map((item) => (item.id === part.id ? changed : item)) : parts.filter((item) => item.id !== part.id) }
  const before = states(build)
  const after = states(next)
  if (change.kind === 'remove' && Object.hasOwn(before, part.id)) after[part.id] = { lit: false, brightness: 0, blocked: false, removed: true }
  return { before, after, changed }
}
