// End to end: every lesson sketch runs through the code runtime, its board and
// the sim runner, and its goal passes only after the learner's action.
import { describe, it, expect } from 'vitest'
import { createSimRunner } from '../src/sim/runner.js'
import { sims } from '../src/sim/sims.js'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createRoom } from '../src/sim/room.js'
import { createSerial } from '../src/sim/serial.js'
import { createSession } from '../src/runner/session.js'
import { lessons } from '../src/course/lessons.js'
import { defaultValues, slotValues, fillSketch } from '../src/ui/sketch.js'

const FRAME_MS = 16

// Drives one lesson: a runner over real stores and a synchronous code runner.
// edit(source) may change the filled sketch, like a learner typing.
function drive(lessonId, overrides = {}, edit = (source) => source) {
  const lesson = lessons.find((item) => item.id === lessonId)
  const { code, params } = lesson.sketch
  let values = { ...defaultValues(params), ...overrides }
  const sourceFor = () => edit(fillSketch(code, slotValues(params, values)))
  const stores = { pins: createPins(), inputs: createInputs(), room: createRoom(), tones: createPins(), servos: createPins(), serial: createSerial() }
  stores.servos.set('D9', 90)
  let session = null
  let codeStart = 0
  let now = 0
  const codeRunner = {
    start(source) {
      session = createSession(source, { random: () => 0.5 })
      codeStart = now
    },
    stop() {
      session = null
    },
    setInputs(levels) {
      if (session) session.setInputs(levels)
    }
  }
  const goals = []
  const runner = createSimRunner({ sims, ...stores, codeRunner, onGoal: (id) => goals.push(id), uploadMs: 0 })
  expect(runner.run({ lessonId, getValues: () => ({ ...values }), source: sourceFor(), now })).toBe(true)

  function frame() {
    runner.tick(now)
    if (session) runner.receive(session.advance(now - codeStart))
    now += FRAME_MS
  }
  function wait(ms) {
    const end = now + ms
    while (now < end) frame()
  }
  // A slider move: values change and the running sketch reloads.
  function set(next) {
    values = { ...values, ...next }
    runner.reload(sourceFor(), now)
  }
  return { runner, stores, goals, wait, set, passed: () => runner.isGoalMet() }
}

describe('lesson goals through the code runner', () => {
  it('1.2 passes with a blink under 500 ms, not at 500 + 500', () => {
    const slow = drive('1.2')
    slow.wait(3000)
    expect(slow.passed()).toBe(false)
    const fast = drive('1.2', { onMs: 200, offMs: 200 })
    fast.wait(1000)
    expect(fast.passed()).toBe(true)
    expect(fast.goals).toEqual(['1.2'])
  })

  it('1.2 passes after a slider change while running', () => {
    const lesson = drive('1.2')
    lesson.wait(1200)
    lesson.set({ onMs: 150, offMs: 150 })
    lesson.wait(800)
    expect(lesson.passed()).toBe(true)
  })

  it('1.3 passes after measuring with all three resistors', () => {
    const lesson = drive('1.3')
    lesson.wait(200)
    expect(lesson.runner.getReadout()).toBe('Meter: pick a part to measure')
    lesson.stores.inputs.setProbe('led')
    for (const ohms of [220, 1000]) {
      lesson.set({ ohms })
      lesson.wait(100)
    }
    expect(lesson.runner.getReadout()).toBe('Meter on LED: 3.0 mA')
    expect(lesson.passed()).toBe(false)
    lesson.set({ ohms: 10000 })
    lesson.wait(100)
    expect(lesson.passed()).toBe(true)
  })

  it('1.4 counts three presses with the LED following the button', () => {
    const lesson = drive('1.4')
    lesson.wait(100)
    for (let i = 0; i < 3; i++) {
      expect(lesson.passed()).toBe(false)
      lesson.stores.inputs.setPressed('btn1', true)
      lesson.wait(100)
      expect(lesson.stores.pins.get('D13')).toBe(1)
      lesson.stores.inputs.setPressed('btn1', false)
      lesson.wait(100)
      expect(lesson.stores.pins.get('D13')).toBe(0)
    }
    expect(lesson.passed()).toBe(true)
  })

  it('1.4 times how fast the LED reacts, on the sketch clock', () => {
    const quick = drive('1.4')
    quick.wait(100)
    quick.stores.inputs.setPressed('btn1', true)
    quick.wait(100)
    expect(quick.runner.getReadout()).toBe('D2 LOW, LED on, reacts in under 1 ms. Presses: 0 of 3')
    // A learner adds a slow delay to the loop, so the LED lags the button.
    const slow = drive('1.4', {}, (source) => source.replace(/(digitalWrite\(ledPin[^;]*;)/, '$1 delay(200);'))
    slow.wait(500)
    slow.stores.inputs.setPressed('btn1', true)
    slow.wait(400)
    const reacts = Number(/reacts in (\d+) ms/.exec(slow.runner.getReadout())[1])
    expect(reacts).toBeGreaterThan(50)
    expect(reacts).toBeLessThanOrEqual(220)
  })

  it('1.5 counts presses only with the pull down fitted, and floats without it', () => {
    const lesson = drive('1.5', { pull: 'none' })
    lesson.wait(400)
    for (let i = 0; i < 3; i++) {
      lesson.stores.inputs.setPressed('btn1', true)
      lesson.wait(100)
      lesson.stores.inputs.setPressed('btn1', false)
      lesson.wait(100)
    }
    expect(lesson.passed()).toBe(false)
    lesson.set({ pull: 'down' })
    lesson.wait(100)
    expect(lesson.stores.pins.get('D13')).toBe(0)
    for (let i = 0; i < 3; i++) {
      lesson.stores.inputs.setPressed('btn1', true)
      lesson.wait(100)
      lesson.stores.inputs.setPressed('btn1', false)
      lesson.wait(100)
    }
    expect(lesson.passed()).toBe(true)
  })

  it('1.6 prints the volts and passes after both ends of the knob', () => {
    const lesson = drive('1.6')
    lesson.wait(500)
    expect(lesson.stores.serial.getLines()[0]).toBe('2.50')
    lesson.stores.inputs.setValue('pot1', 0)
    lesson.wait(300)
    expect(lesson.passed()).toBe(false)
    lesson.stores.inputs.setValue('pot1', 1)
    lesson.wait(300)
    expect(lesson.stores.serial.getLines().at(-1)).toBe('5.00')
    expect(lesson.passed()).toBe(true)
  })

  it('1.7 passes with a 3 ms step, not at the default 10 ms', () => {
    const slow = drive('1.7')
    slow.wait(12000)
    expect(slow.passed()).toBe(false)
    const fast = drive('1.7', { stepMs: 3 })
    fast.wait(1400)
    expect(fast.passed()).toBe(false)
    fast.wait(400)
    expect(fast.passed()).toBe(true)
  })

  it('1.8 passes on orange, not at the default sky blue', () => {
    const lesson = drive('1.8')
    lesson.wait(300)
    expect(lesson.passed()).toBe(false)
    lesson.set({ red: 255, green: 128, blue: 0 })
    lesson.wait(300)
    expect(lesson.runner.getReadout()).toBe('Now 255, 128, 0. Target orange 255, 128, 0')
    expect(lesson.passed()).toBe(true)
  })

  it('1.9 passes when the night light turns on in the dark and off again', () => {
    const lesson = drive('1.9')
    lesson.wait(300)
    lesson.stores.room.setLight(0.2)
    lesson.wait(300)
    expect(lesson.stores.pins.get('D13')).toBe(1)
    expect(lesson.passed()).toBe(false)
    lesson.stores.room.setLight(0.9)
    lesson.wait(300)
    expect(lesson.passed()).toBe(true)
  })

  it('1.10 prints deg C and passes after cool and warm', () => {
    const lesson = drive('1.10')
    lesson.wait(1200)
    expect(lesson.stores.serial.getLines()[0]).toBe('21.85 deg C')
    lesson.stores.room.setTempC(14)
    lesson.wait(100)
    expect(lesson.passed()).toBe(false)
    lesson.stores.room.setTempC(31)
    lesson.wait(100)
    expect(lesson.passed()).toBe(true)
  })

  it('1.11 passes on E D C, not on the default C D E', () => {
    const wrong = drive('1.11')
    wrong.wait(5000)
    expect(wrong.stores.tones.get('D8')).toBeGreaterThanOrEqual(0)
    expect(wrong.passed()).toBe(false)
    const right = drive('1.11', { note1: 330, note2: 294, note3: 262 })
    right.wait(1000)
    expect(right.passed()).toBe(true)
  })

  it('1.12 passes after resting at 45, 90 and 135 deg', () => {
    const lesson = drive('1.12')
    lesson.wait(500)
    expect(lesson.stores.servos.get('D9')).toBe(0)
    for (const angle of [45, 90]) {
      lesson.set({ angle })
      lesson.wait(500)
    }
    expect(lesson.passed()).toBe(false)
    lesson.set({ angle: 135 })
    lesson.wait(500)
    expect(lesson.passed()).toBe(true)
  })

  it('P1 passes a whole day with good thresholds, not with the defaults', () => {
    const wrong = drive('P1')
    wrong.wait(25000)
    expect(wrong.passed()).toBe(false)
    const right = drive('P1', { darkLevel: 150, alarmC: 30 })
    right.wait(23000)
    expect(right.passed()).toBe(false)
    right.wait(2000)
    expect(right.passed()).toBe(true)
  }, 20000)

  it('every lesson with a sim has a sketch the runner accepts', () => {
    for (const id of Object.keys(sims)) {
      const lesson = lessons.find((item) => item.id === id)
      expect(lesson.sketch, id).toBeTruthy()
    }
  })
})
