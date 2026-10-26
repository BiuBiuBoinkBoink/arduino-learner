import { describe, it, expect } from 'vitest'
import { createScopeBuffer, summarize, scopeText, roundMs, levelOf, describePin } from '../src/explain/scopeBuffer.js'
import { createSimRunner } from '../src/sim/runner.js'
import { createPins } from '../src/sim/pins.js'

function blink(buffer, onMs, offMs, untilMs) {
  let at = 0
  let level = 1
  while (at <= untilMs) {
    buffer.record({ kind: 'pin', pin: 'D13', value: level, at })
    at += level ? onMs : offMs
    level = 1 - level
  }
}

describe('scope buffer', () => {
  it('summarizes a 500 / 500 blink as one cycle every 1000 ms', () => {
    const buffer = createScopeBuffer()
    blink(buffer, 500, 500, 5000)
    const summary = summarize(buffer.samples('D13', 1000, 5000), 1000, 5000)
    expect(summary).toMatchObject({ highMs: 500, lowMs: 500, periodMs: 1000, pwm: false, transitions: 8 })
    expect(summary.duty).toBeCloseTo(0.5)
    expect(scopeText('D13', summary)).toBe('D13 is HIGH for about 500 ms, then LOW for about 500 ms: one cycle every 1000 ms.')
  })

  it('says a constant pin stays at its level, and a pin with no events has not changed', () => {
    const buffer = createScopeBuffer()
    buffer.record({ kind: 'pin', pin: 'D13', value: 1, at: 0 })
    const summary = summarize(buffer.samples('D13', 1000, 4000), 1000, 4000)
    expect(summary.transitions).toBe(0)
    expect(scopeText('D13', summary)).toBe('D13 stays HIGH.')
    expect(buffer.has('D9')).toBe(false)
    expect(buffer.samples('D9', 0, 1000)).toEqual([{ at: 0, value: 0 }])
    expect(scopeText('D9', summarize(buffer.samples('D9', 0, 1000), 0, 1000), { changed: false })).toBe('D9 has not changed since Run.')
  })

  it('reads PWM at 64 as a duty cycle', () => {
    const buffer = createScopeBuffer()
    buffer.record({ kind: 'pin', pin: 'D9', value: 64 / 255, at: 10 })
    const summary = summarize(buffer.samples('D9', 1000, 3000), 1000, 3000)
    expect(summary.pwm).toBe(true)
    expect(summary.duty).toBeCloseTo(64 / 255)
    expect(scopeText('D9', summary)).toBe('D9 averages 25% on (analogWrite about 64).')
  })

  it('trims events older than the window but keeps the level at its start', () => {
    const buffer = createScopeBuffer({ windowMs: 1000 })
    buffer.record({ kind: 'pin', pin: 'D13', value: 1, at: 0 })
    buffer.record({ kind: 'pin', pin: 'D13', value: 0, at: 100 })
    buffer.record({ kind: 'pin', pin: 'D13', value: 1, at: 200 })
    buffer.record({ kind: 'pin', pin: 'D13', value: 0, at: 5000 })
    // Only the event at 200 (the level before the window) and 5000 are left.
    expect(buffer.samples('D13', 0, 6000)).toEqual([{ at: 0, value: 0 }, { at: 200, value: 1 }, { at: 5000, value: 0 }])
    expect(buffer.samples('D13', 4500, 6000)).toEqual([{ at: 4500, value: 1 }, { at: 5000, value: 0 }])
    buffer.clear()
    expect(buffer.has('D13')).toBe(false)
  })

  it('falls back to the whole window when the last seconds hold no full cycle', () => {
    const buffer = createScopeBuffer()
    blink(buffer, 500, 500, 6000)
    expect(describePin(buffer, 'D13', 6200, 1)).toBe('D13 is HIGH for about 500 ms, then LOW for about 500 ms: one cycle every 1000 ms.')
    expect(describePin(buffer, 'D9', 6200, 3)).toBe('D9 has not changed since Run.')
  })

  it('rounds ms to the nearest 10 above 100 and maps tones and servos to levels', () => {
    expect(roundMs(487)).toBe(490)
    expect(roundMs(97.4)).toBe(97)
    expect(levelOf({ kind: 'tone', value: 440 })).toBe(1)
    expect(levelOf({ kind: 'tone', value: 0 })).toBe(0)
    expect(levelOf({ kind: 'servo', value: 90 })).toBe(0.5)
    expect(levelOf({ kind: 'input', value: 1 })).toBe(null)
  })
})

describe('runner output subscription', () => {
  it('passes every applied output event, not inputs, with its time on the runner clock', () => {
    let batchStart = null
    const codeRunner = { start: () => { batchStart = true }, stop: () => {}, setInputs: () => {} }
    const sims = { x: () => ({ levels: () => ({}) }) }
    const runner = createSimRunner({ sims, pins: createPins(), inputs: {}, codeRunner, onGoal: () => {}, uploadMs: 0 })
    const seen = []
    const off = runner.subscribeOutput((event) => seen.push(event))
    runner.run({ lessonId: 'x', getValues: () => ({}), source: 'void setup() {}\nvoid loop() {}', now: 100 })
    runner.tick(100)
    expect(batchStart).toBe(true)
    runner.receive({ events: [[0, 'pin', 'D13', 1], [5, 'input', 'D2', 0], [10, 'tone', 'D8', 440]] })
    expect(seen).toEqual([{ kind: 'pin', pin: 'D13', value: 1, at: 100 }, { kind: 'tone', pin: 'D8', value: 440, at: 110 }])
    runner.tick(400)
    expect(runner.getClock()).toBe(400)
    off()
    runner.receive({ events: [[20, 'pin', 'D13', 0]] })
    expect(seen).toHaveLength(2)
  })
})
