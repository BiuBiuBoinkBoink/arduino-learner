// End to end: every lesson sketch runs through the code runtime, its board and
// the sim runner, and its goal passes only after the learner's action.
import { describe, it, expect } from 'vitest'
import { sims } from '../src/sim/sims.js'
import { lessons } from '../src/course/lessons.js'
import { createHeadless, runHeadless } from '../src/sim/headless.js'

// Drives one lesson through src/sim/headless.js: a runner over real stores and
// a synchronous code runner. edit(source) may change the filled sketch, like a
// learner typing; set(values) is a slider move.
function drive(lessonId, overrides = {}, edit = (source) => source) {
  const run = createHeadless({ lessonId, values: overrides, edit })
  expect(run.started).toBe(true)
  return run
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

describe('runHeadless', () => {
  it('runs a sketch for a time with timed actions and reports the events, progress and goal', () => {
    const lesson = lessons.find((item) => item.id === '1.4')
    const actions = []
    for (let i = 0; i < 3; i++) actions.push({ at: 200 + i * 300, kind: 'press', id: 'btn1' }, { at: 350 + i * 300, kind: 'release', id: 'btn1' })
    const result = runHeadless({ lessonId: '1.4', ms: 1400, actions })
    expect(lesson.sketch).toBeTruthy()
    expect(result.error).toBe(null)
    expect(result.goalMet).toBe(true)
    expect(result.events.filter((event) => event.pin === 'D13' && event.value === 1).length).toBeGreaterThanOrEqual(3)
    expect(result.progress).toMatchObject({ ran: true, goal: true, pressedOnce: true })
  })

  it('reports a sketch that does not compile', () => {
    const result = runHeadless({ lessonId: '1.2', source: 'void loop() {', ms: 100 })
    expect(result.goalMet).toBe(false)
    expect(result.error.line).toBeGreaterThan(0)
  })
})

describe('lesson progress names through the code runner', () => {
  const progress = (lesson) => lesson.runner.getProgress()

  it('1.2 reports blinked after a full blink and fast with the goal', () => {
    const lesson = drive('1.2')
    lesson.wait(500)
    expect(progress(lesson)).toMatchObject({ ran: false, goal: false, blinked: false, fast: false })
    lesson.wait(1200)
    expect(progress(lesson)).toMatchObject({ ran: true, blinked: true, fast: false })
    lesson.set({ onMs: 200, offMs: 200 })
    lesson.wait(1000)
    expect(progress(lesson)).toMatchObject({ goal: true, fast: true })
  })

  it('1.3 reports each measured resistor', () => {
    const lesson = drive('1.3')
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ measured220: false, measured1000: false, measured10000: false })
    lesson.stores.inputs.setProbe('led')
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ measured220: true, measured1000: false, measured10000: false })
    lesson.set({ ohms: 10000 })
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ measured220: true, measured1000: false, measured10000: true })
  })

  it('1.4 reports pressedOnce after one full press', () => {
    const lesson = drive('1.4')
    lesson.wait(100)
    lesson.stores.inputs.setPressed('btn1', true)
    lesson.wait(100)
    expect(progress(lesson).pressedOnce).toBe(false)
    lesson.stores.inputs.setPressed('btn1', false)
    lesson.wait(100)
    expect(progress(lesson).pressedOnce).toBe(true)
  })

  it('1.5 reports floated without the pull down and pressedOnce with it', () => {
    const fitted = drive('1.5')
    fitted.wait(2000)
    expect(progress(fitted)).toMatchObject({ floated: false, pressedOnce: false })
    const lesson = drive('1.5', { pull: 'none' })
    lesson.wait(2000)
    expect(progress(lesson)).toMatchObject({ floated: true, pressedOnce: false })
    lesson.set({ pull: 'down' })
    lesson.stores.inputs.setPressed('btn1', true)
    lesson.wait(100)
    lesson.stores.inputs.setPressed('btn1', false)
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ floated: true, pressedOnce: true })
  })

  it('1.6 reports seenLow and seenHigh separately', () => {
    const lesson = drive('1.6')
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ seenLow: false, seenHigh: false })
    lesson.stores.inputs.setValue('pot1', 0)
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ seenLow: true, seenHigh: false })
    lesson.stores.inputs.setValue('pot1', 1)
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ seenLow: true, seenHigh: true })
  })

  it('1.7 reports rampSeen after one end then the other, at any speed', () => {
    const lesson = drive('1.7')
    lesson.wait(1000)
    expect(progress(lesson).rampSeen).toBe(false)
    lesson.wait(2000)
    expect(progress(lesson).rampSeen).toBe(true)
    expect(progress(lesson).goal).toBe(false)
  })

  it('1.8 and P1 report only ran and goal', () => {
    for (const id of ['1.8', 'P1']) {
      const lesson = drive(id)
      lesson.wait(1100)
      expect(progress(lesson), id).toEqual({ ran: true, goal: false })
    }
  })

  it('1.9 reports turnedOn once the night light changes', () => {
    const lesson = drive('1.9')
    lesson.wait(300)
    expect(progress(lesson).turnedOn).toBe(false)
    lesson.stores.room.setLight(0.2)
    lesson.wait(300)
    expect(progress(lesson).turnedOn).toBe(true)
    expect(progress(lesson).goal).toBe(false)
  })

  it('1.10 reports seenCool and seenWarm separately', () => {
    const lesson = drive('1.10')
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ seenCool: false, seenWarm: false })
    lesson.stores.room.setTempC(14)
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ seenCool: true, seenWarm: false })
    lesson.stores.room.setTempC(31)
    lesson.wait(100)
    expect(progress(lesson)).toMatchObject({ seenCool: true, seenWarm: true })
  })

  it('1.11 reports played after three notes, even the wrong tune', () => {
    const lesson = drive('1.11')
    lesson.wait(100)
    expect(progress(lesson).played).toBe(false)
    lesson.wait(2000)
    expect(progress(lesson)).toMatchObject({ played: true, goal: false })
  })

  it('1.12 reports each angle reached', () => {
    const lesson = drive('1.12')
    lesson.wait(100)
    lesson.set({ angle: 45 })
    lesson.wait(500)
    expect(progress(lesson)).toMatchObject({ reached45: true, reached90: false, reached135: false })
    lesson.set({ angle: 135 })
    lesson.wait(500)
    expect(progress(lesson)).toMatchObject({ reached45: true, reached90: false, reached135: true })
  })
})
