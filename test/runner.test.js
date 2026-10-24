import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createSerial } from '../src/sim/serial.js'
import { createSimRunner, checkCode, UPLOAD_MS } from '../src/sim/runner.js'

const SKETCH = 'void setup() {}\nvoid loop() {}'

// A code runner that records calls, and a board that records what it sees.
function setup({ goal = () => false, readout } = {}) {
  const calls = []
  const codeRunner = {
    start: (source) => calls.push(['start', source]),
    stop: () => calls.push(['stop']),
    setInputs: (levels) => calls.push(['inputs', levels])
  }
  const seen = { created: [], outputs: [], updates: [], reloads: 0, stops: 0 }
  let level = 0
  const board = (args) => {
    seen.created.push(args)
    const sim = {
      levels: () => ({ A0: level }),
      update: (now) => seen.updates.push(now),
      output: (event) => seen.outputs.push(event),
      reload: () => { seen.reloads += 1 },
      stop: () => { seen.stops += 1 },
      checkGoal: goal
    }
    if (readout) sim.readout = readout
    return sim
  }
  const pins = createPins()
  const tones = createPins()
  const serial = createSerial()
  const goals = []
  const runner = createSimRunner({ sims: { '1.2': board }, pins, tones, serial, codeRunner, onGoal: (id) => goals.push(id), uploadMs: 1000 })
  const values = () => ({})
  return { runner, calls, seen, pins, tones, serial, goals, values, setLevel: (v) => { level = v } }
}

describe('checkCode', () => {
  it('returns null for good code and the first error with its line', () => {
    expect(checkCode(SKETCH)).toBe(null)
    expect(checkCode('void setup() {\n  int x = 1\n}\nvoid loop() {}')).toEqual({ message: "Line 2: expected ';' after the declaration", line: 2 })
    expect(checkCode('void setup() {}')).toMatchObject({ line: 1 })
  })
})

describe('createSimRunner', () => {
  it('exports a 1500 ms upload time and knows which lessons have a sim', () => {
    const { runner } = setup()
    expect(UPLOAD_MS).toBe(1500)
    expect(runner.hasSim('1.2')).toBe(true)
    expect(runner.hasSim('1.1')).toBe(false)
    expect(runner.hasSim('toString')).toBe(false)
  })

  it('refuses code that does not compile and reports the error', () => {
    const { runner, calls, values } = setup()
    expect(runner.run({ lessonId: '1.2', getValues: values, source: 'void setup() {', now: 0 })).toBe(false)
    expect(runner.getPhase()).toBe('error')
    expect(runner.getError().line).toBe(1)
    expect(calls).toEqual([])
    expect(runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })).toBe(true)
    expect(runner.getError()).toBe(null)
  })

  it('uploads, then starts the code and the board, and sends input levels when they change', () => {
    const { runner, calls, seen, values, setLevel } = setup()
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 100 })
    expect(runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 110 })).toBe(false)
    runner.tick(1099)
    expect(runner.getPhase()).toBe('uploading')
    expect(calls).toEqual([])
    runner.tick(1100)
    expect(runner.getPhase()).toBe('running')
    expect(seen.created[0].startedAt).toBe(1100)
    expect(calls).toEqual([['start', SKETCH], ['inputs', { A0: 0 }]])
    runner.tick(1116)
    expect(calls).toHaveLength(2)
    setLevel(0.5)
    runner.tick(1132)
    expect(calls[2]).toEqual(['inputs', { A0: 0.5 }])
    expect(seen.updates).toEqual([1100, 1116, 1132])
  })

  it('applies output events in order, then passes them to the board on the same clock', () => {
    const { runner, seen, pins, tones, serial, values } = setup()
    runner.receive({ events: [[0, 'pin', 'D13', 1]] })
    expect(pins.get('D13')).toBe(0)
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })
    runner.tick(1000)
    runner.receive({ events: [[5, 'pin', 'D13', 1], [7, 'tone', 'D8', 440], [9, 'servo', 'D9', 45]], serial: 'hi\n' })
    expect(pins.get('D13')).toBe(1)
    expect(tones.get('D8')).toBe(440)
    expect(serial.getLines()).toEqual(['hi'])
    expect(seen.outputs.map((event) => [event.kind, event.at])).toEqual([['pin', 1005], ['tone', 1007], ['servo', 1009]])
  })

  it('calls onGoal once per run when the board goal first passes', () => {
    let passed = false
    const { runner, goals, values } = setup({ goal: () => passed })
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })
    runner.tick(1000)
    expect(goals).toEqual([])
    passed = true
    runner.tick(1016)
    runner.tick(1032)
    expect(goals).toEqual(['1.2'])
    expect(runner.isGoalMet()).toBe(true)
  })

  it('stops the code, the board and the outputs on stop', () => {
    const { runner, calls, seen, pins, tones, values } = setup()
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })
    runner.tick(1000)
    runner.receive({ events: [[1, 'pin', 'D13', 1], [1, 'tone', 'D8', 262]] })
    runner.stop()
    expect(calls.at(-1)).toEqual(['stop'])
    expect(seen.stops).toBe(1)
    expect([pins.get('D13'), tones.get('D8')]).toEqual([0, 0])
    expect(runner.getPhase()).toBe('idle')
  })

  it('a runtime error stops the run and keeps it for the code panel', () => {
    const { runner, calls, values } = setup()
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })
    runner.tick(1000)
    runner.receive({ events: [], error: { message: 'Line 3: division by zero', line: 3 } })
    expect(runner.getPhase()).toBe('error')
    expect(runner.getError()).toEqual({ message: 'Line 3: division by zero', line: 3 })
    expect(calls.at(-1)).toEqual(['stop'])
  })

  it('reloads new code while running, keeping the board, and resends the levels', () => {
    const { runner, calls, seen, values } = setup()
    expect(runner.reload(SKETCH, 0)).toBe(false)
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })
    runner.tick(1000)
    const next = 'void setup() {}\nvoid loop() { delay(1); }'
    expect(runner.reload('void setup() {', 1200)).toBe(false)
    expect(runner.reload(next, 1200)).toBe(true)
    expect(calls.slice(-2)).toEqual([['start', next], ['inputs', { A0: 0 }]])
    expect(seen.created).toHaveLength(1)
    expect(seen.reloads).toBe(1)
    runner.receive({ events: [[10, 'pin', 'D13', 1]] })
    expect(seen.outputs.at(-1).at).toBe(1210)
  })

  it('reads out the board while running, else nothing', () => {
    const { runner, values } = setup({ readout: () => 'A0 reads 512' })
    expect(runner.getReadout()).toBe('')
    runner.run({ lessonId: '1.2', getValues: values, source: SKETCH, now: 0 })
    runner.tick(1000)
    expect(runner.getReadout()).toBe('A0 reads 512')
  })
})
