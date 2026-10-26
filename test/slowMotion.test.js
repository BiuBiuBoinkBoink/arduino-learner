// Slow motion: session line events and time scale, the worker client
// messages, and the runner demo mode that never meets a goal.
import { describe, it, expect } from 'vitest'
import { createSession } from '../src/runner/session.js'
import { createCodeRunner } from '../src/runner/codeRunner.js'
import { createSimRunner } from '../src/sim/runner.js'
import { createPins } from '../src/sim/pins.js'

const BLINK = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(100);
  digitalWrite(13, LOW);
  delay(100);
}`

describe('session trace and time scale', () => {
  it('emits a line event for each statement start with trace on', () => {
    const session = createSession(BLINK, { trace: true })
    const lines = session.advance(250).events.filter((event) => event[1] === 'line').map((event) => event[3])
    expect(lines.slice(0, 6)).toEqual([2, 6, 7, 8, 9, 6])
    expect(session.advance(260).events.every((event) => event[1] !== 'line' || event[2] === null)).toBe(true)
  })

  it('has no line events with trace off, and trace can change mid run', () => {
    const session = createSession(BLINK)
    expect(session.advance(250).events.some((event) => event[1] === 'line')).toBe(false)
    session.setTrace(true)
    expect(session.advance(500).events.some((event) => event[1] === 'line')).toBe(true)
    session.setTrace(false)
    expect(session.advance(750).events.some((event) => event[1] === 'line')).toBe(false)
  })

  it('runs the sketch clock at the time scale from the moment it changes', () => {
    const normal = createSession(BLINK)
    expect(normal.advance(1000).millis).toBe(1000)
    const slow = createSession(BLINK, { timeScale: 0.1 })
    expect(slow.advance(1000).millis).toBeCloseTo(100, 0)
    const mixed = createSession(BLINK)
    mixed.advance(1000)
    mixed.setTimeScale(0.25)
    expect(mixed.advance(2000).millis).toBeCloseTo(1250, 0)
    mixed.setTimeScale(1)
    expect(mixed.advance(3000).millis).toBeCloseTo(2250, 0)
  })
})

describe('code runner slow motion messages', () => {
  it('posts trace and time scale to the worker', () => {
    const posted = []
    const worker = { postMessage: (message) => posted.push(message) }
    const runner = createCodeRunner({ onBatch: () => {}, onError: () => {}, createWorker: () => worker, startTimeoutMs: 1000 })
    runner.setTimeScale(0.1)
    expect(posted).toEqual([])
    runner.start('code')
    runner.setTrace(true)
    runner.setTimeScale(0.1)
    expect(posted.slice(1)).toEqual([{ type: 'trace', on: true }, { type: 'timeScale', scale: 0.1 }])
    runner.stop()
  })
})

describe('runner slow motion', () => {
  function setup() {
    const calls = []
    const codeRunner = {
      start: () => calls.push(['start']),
      stop: () => calls.push(['stop']),
      setInputs: () => {},
      setTrace: (on) => calls.push(['trace', on]),
      setTimeScale: (scale) => calls.push(['scale', scale])
    }
    let goal = false
    const sims = { x: () => ({ levels: () => ({}), checkGoal: () => goal, progress: () => ({ blinked: true }) }) }
    const goals = []
    const runner = createSimRunner({ sims, pins: createPins(), inputs: {}, codeRunner, onGoal: (id) => goals.push(id), uploadMs: 0 })
    const run = (now) => {
      runner.run({ lessonId: 'x', getValues: () => ({}), source: 'void setup() {}\nvoid loop() {}', now })
      runner.tick(now)
    }
    return { runner, calls, goals, run, meet: () => { goal = true } }
  }

  it('needs a running sketch', () => {
    const { runner } = setup()
    expect(runner.setSlowMotion(true)).toBe(false)
    expect(runner.getSlowMotion()).toBe(null)
  })

  it('suppresses onGoal and progress for the rest of the run, even after it is turned off', () => {
    const { runner, calls, goals, run, meet } = setup()
    run(0)
    expect(runner.getProgress()).toMatchObject({ blinked: true })
    expect(runner.setSlowMotion(true)).toBe(true)
    expect(calls.slice(-2)).toEqual([['scale', 0.1], ['trace', true]])
    expect(runner.getSlowMotion()).toBe(0.1)
    expect(runner.isDemo()).toBe(true)
    meet()
    runner.tick(2000)
    expect(goals).toEqual([])
    expect(runner.isGoalMet()).toBe(false)
    expect(runner.getProgress()).toEqual({})
    expect(runner.setSlowMotion(false)).toBe(true)
    expect(calls.slice(-2)).toEqual([['scale', 1], ['trace', false]])
    runner.tick(3000)
    expect(goals).toEqual([])
    expect(runner.getProgress()).toEqual({})
    // Run again counts.
    runner.stop()
    run(4000)
    expect(runner.isDemo()).toBe(false)
    expect(goals).toEqual(['x'])
  })

  it('beginDemo pauses goals at full speed until the next Run', () => {
    const { runner, calls, goals, run, meet } = setup()
    expect(runner.beginDemo()).toBe(false)
    run(0)
    const before = calls.length
    expect(runner.beginDemo()).toBe(true)
    expect(calls.length).toBe(before)
    expect(runner.isDemo()).toBe(true)
    expect(runner.getSlowMotion()).toBe(null)
    meet()
    runner.tick(2000)
    expect(goals).toEqual([])
    expect(runner.getProgress()).toEqual({})
    runner.stop()
    run(3000)
    expect(runner.isDemo()).toBe(false)
    expect(goals).toEqual(['x'])
  })

  it('passes line events to line listeners only, and Stop ends slow motion', () => {
    const { runner, calls, run } = setup()
    run(0)
    const lines = []
    const outputs = []
    runner.subscribeLine((line) => lines.push(line))
    runner.subscribeOutput((event) => outputs.push(event))
    runner.setSlowMotion(true, 0.25)
    runner.receive({ events: [[0, 'line', null, 9], [1, 'pin', 'D13', 1], [2, 'line', null, 10]] })
    expect(lines).toEqual([9, 10])
    expect(outputs.map((event) => event.kind)).toEqual(['pin'])
    runner.stop()
    expect(runner.getSlowMotion()).toBe(null)
    expect(calls.some((call) => call[0] === 'scale' && call[1] === 1)).toBe(true)
  })

  it('moves its clock at the slow speed', () => {
    const { runner, run } = setup()
    run(1000)
    runner.tick(2000)
    expect(runner.getClock()).toBe(2000)
    runner.setSlowMotion(true)
    runner.tick(3000)
    expect(runner.getClock()).toBeCloseTo(2100)
  })
})
