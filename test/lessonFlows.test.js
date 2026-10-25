// Every lesson played by a perfect learner through the real course, step
// tracker, flow, checks, workbench and sims: each step must pass in order and
// the lesson must be marked done exactly once, by the flow.
import { describe, it, expect } from 'vitest'
import { createCourse } from '../src/course/state.js'
import { createStepTracker } from '../src/course/stepTracker.js'
import { createFlow } from '../src/course/flow.js'
import { stepsFor, scopeFor } from '../src/course/steps.js'
import { evaluate } from '../src/course/checks.js'
import { lessons } from '../src/course/lessons.js'
import { circuits } from '../src/circuits/circuits.js'
import { legsOf } from '../src/circuits/footprints.js'
import { holeName, parseHole } from '../src/circuits/holes.js'
import { joinPlaces, suggest } from '../src/circuits/suggest.js'
import { kitFor } from '../src/build/kit.js'
import { createWorkbench } from '../src/build/workbench.js'
import { createSimRunner } from '../src/sim/runner.js'
import { sims } from '../src/sim/sims.js'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createRoom } from '../src/sim/room.js'
import { createSerial } from '../src/sim/serial.js'
import { createSession } from '../src/runner/session.js'
import { defaultValues, slotValues, fillSketch } from '../src/ui/sketch.js'

const FRAME_MS = 16

function memory() {
  const data = {}
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) }
  }
}

// The drive pattern of lessonGoals.test.js: the lesson sketch through the code
// runtime, its board and the sim runner, on a fake clock.
function drive(lesson, overrides = {}) {
  const { code, params } = lesson.sketch
  let values = { ...defaultValues(params), ...overrides }
  const sourceFor = () => fillSketch(code, slotValues(params, values))
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
  const runner = createSimRunner({ sims, ...stores, codeRunner, onGoal: () => {}, uploadMs: 0 })
  expect(runner.run({ lessonId: lesson.id, getValues: () => ({ ...values }), source: sourceFor(), now })).toBe(true)
  function wait(ms) {
    const end = now + ms
    while (now < end) {
      runner.tick(now)
      if (session) runner.receive(session.advance(now - codeStart))
      now += FRAME_MS
    }
  }
  function set(next) {
    values = { ...values, ...next }
    runner.reload(sourceFor(), now)
  }
  function press(times) {
    for (let i = 0; i < times; i++) {
      stores.inputs.setPressed('btn1', true)
      wait(100)
      stores.inputs.setPressed('btn1', false)
      wait(100)
    }
  }
  return { runner, stores, wait, set, press }
}

// What the learner does on each run, predict and code step, by lesson and step
// id. run(d, sync) acts on the running sketch; sync() sends the progress so far
// to the flow, as main.js does every run frame. The overrides start the sketch
// with the values the goal needs, like lessonGoals.test.js.
const RUNS = {
  '1.2': {
    guess: (d) => d.wait(1700),
    faster: (d) => {
      d.set({ onMs: 200, offMs: 200 })
      d.wait(1000)
    }
  },
  '1.3': {
    'measure-220': (d) => {
      d.stores.inputs.setProbe('led')
      d.wait(100)
    },
    swap: (d, sync) => {
      d.set({ ohms: 1000 })
      d.wait(100)
      sync()
      d.set({ ohms: 10000 })
      d.wait(100)
    }
  },
  '1.4': {
    guess: (d) => {
      d.wait(100)
      d.press(1)
    },
    'three-presses': (d) => d.press(3)
  },
  '1.5': {
    overrides: { pull: 'none' },
    'see-float': (d) => d.wait(2000),
    'three-presses': (d) => {
      d.set({ pull: 'down' })
      d.wait(100)
      d.press(3)
    }
  },
  '1.6': {
    turn: (d, sync) => {
      d.stores.inputs.setValue('pot1', 0)
      d.wait(300)
      sync()
      d.stores.inputs.setValue('pot1', 1)
      d.wait(300)
    }
  },
  '1.7': {
    guess: (d) => d.wait(3000),
    'speed-up': (d) => {
      d.set({ stepMs: 3 })
      d.wait(2500)
    }
  },
  '1.8': {
    mix: (d) => {
      d.wait(300)
      d.set({ red: 255, green: 128, blue: 0 })
      d.wait(300)
    }
  },
  '1.9': {
    dark: (d, sync) => {
      d.wait(300)
      d.stores.room.setLight(0.2)
      d.wait(300)
      sync()
      d.stores.room.setLight(0.9)
      d.wait(300)
    }
  },
  '1.10': {
    guess: (d) => d.wait(1200),
    'hot-cold': (d, sync) => {
      d.stores.room.setTempC(14)
      d.wait(100)
      sync()
      d.stores.room.setTempC(31)
      d.wait(100)
    }
  },
  '1.11': {
    overrides: { note1: 330, note2: 294, note3: 262 },
    tune: (d) => d.wait(2500)
  },
  '1.12': {
    angles: (d, sync) => {
      d.wait(500)
      for (const angle of [45, 90, 135]) {
        d.set({ angle })
        d.wait(500)
        sync()
      }
    }
  },
  P1: {
    overrides: { darkLevel: 150, alarmC: 30 },
    day: (d) => d.wait(25000)
  }
}

// Lesson 1.1 has no reference circuit: its build steps place by hand.
const BY_HAND = {
  '1.1': {
    'place-resistor': (bench) => bench.place('r1', ['5c', '9c']),
    'power-wires': (bench) => {
      bench.addWire('5V', 'T+3')
      bench.addWire('GND', 'T-3')
    },
    practice: (bench) => {
      bench.place('r1', ['12c', '16c'])
      bench.remove('r1')
    }
  }
}

function setup(lesson) {
  const storage = memory()
  const course = createCourse({ lessons: [lesson], storage })
  const completions = []
  const markComplete = course.markComplete
  course.markComplete = (id) => {
    completions.push(id)
    markComplete(id)
  }
  const tracker = createStepTracker({ storage, lessons: [lesson], stepsFor })
  const flow = createFlow({ course, tracker, stepsFor, evaluate })
  const reference = circuits[lesson.id] || null
  const bench = createWorkbench({ storage })
  bench.load(lesson.id, { kit: kitFor(lesson, reference, { prebuiltLists: true }), reference })
  return { course, tracker, flow, reference, bench, completions }
}

describe('every lesson played by a perfect learner', () => {
  for (const lesson of lessons) {
    it(lesson.id + ' passes every step in order and completes once', () => {
      const { tracker, flow, reference, bench, completions } = setup(lesson)
      const steps = stepsFor(lesson)
      const runs = RUNS[lesson.id] || {}
      let driver = null
      let tourComplete = false
      let attempts = 0
      // The event counts main.js keeps for the current step.
      let events = { 'strip-hover': new Set(), 'part-moved': 0, 'part-returned': 0 }
      bench.subscribe((event) => {
        attempts += 1
        if (event.type === 'move') events['part-moved'] += 1
        if (event.type === 'remove') events['part-returned'] += 1
      })
      const sync = () => flow.update({
        sim: driver ? { phase: 'running', progress: driver.runner.getProgress() } : { phase: 'idle', progress: {} },
        code: { error: null },
        tour: { complete: tourComplete },
        events,
        build: bench.getBuild(),
        reference,
        scope: scopeFor(lesson, tracker.get(lesson.id).current),
        attempts,
        busy: false
      })
      sync()
      expect(steps.length).toBeGreaterThan(0)

      steps.forEach((step, index) => {
        expect(flow.getView().index, step.id).toBe(index)
        expect(flow.getView().steps[index].passed, step.id + ' passed too early').toBe(false)
        const check = step.check
        if (check.type === 'quiz' || check.type === 'predict') flow.answer(step.id, check.answer)
        if (check.type === 'tour') tourComplete = true
        if (step.kind === 'explore' && check.type === 'event') {
          for (const place of ['strip:3-top', 'strip:3-bottom', 'rail:T+']) events['strip-hover'].add(place)
        }
        if (step.kind === 'build' || step.kind === 'wire') {
          const hand = BY_HAND[lesson.id] && BY_HAND[lesson.id][step.id]
          if (hand) hand(bench)
          else if (step.kind === 'build') expect(bench.placeReference(step.parts), step.id).toBe(true)
          else {
            const placed = bench.getBuild().wires.map((wire) => wire.id)
            expect(bench.placeReference(reference.wires.map((wire) => wire.id).filter((id) => !placed.includes(id))), step.id).toBe(true)
          }
        }
        if (runs[step.id]) {
          if (!driver) driver = drive(lesson, runs.overrides)
          runs[step.id](driver, sync)
        }
        sync()
        expect(flow.getView().steps[index].passed, step.id).toBe(true)
        expect(tracker.get(lesson.id).helped).toEqual([])
        if (index === steps.length - 1) return
        expect(completions).toEqual([])
        flow.next()
        attempts = 0
        events = { 'strip-hover': new Set(), 'part-moved': 0, 'part-returned': 0 }
        sync()
      })

      expect(flow.getView().lessonDone).toBe(true)
      sync()
      expect(completions).toEqual([lesson.id])
    }, 30000)
  }
})

// The first part of a step moved 3 columns right of its reference legs, rails
// keeping their row.
function shiftedLegs(part) {
  const legs = legsOf(part).map((hole) => {
    const { column, row } = parseHole(hole)
    return holeName(column + 3, row)
  })
  return legs.every(Boolean) ? legs : null
}

describe('the first build step of every lesson', () => {
  for (const lesson of lessons) {
    const steps = stepsFor(lesson)
    const index = steps.findIndex((step) => step.kind === 'build' && step.check.type === 'circuit')
    if (index === -1) continue
    const step = steps[index]
    const ctxFor = (build, reference) => ({
      answers: {},
      latched: [],
      build,
      reference,
      scope: scopeFor(lesson, index),
      attempts: 1,
      busy: false
    })

    it(lesson.id + ' fails on the starting build', () => {
      const { reference, bench } = setup(lesson)
      expect(evaluate(step, ctxFor(bench.getBuild(), reference)).passed).toBe(false)
    })

    it(lesson.id + ' passes with its parts 3 columns to the right', () => {
      const { reference, bench } = setup(lesson)
      if (!reference) {
        // 1.1: any two strips do.
        expect(bench.place('r1', ['8c', '12c'])).toBe(true)
        expect(evaluate(step, ctxFor(bench.getBuild(), reference)).passed).toBe(true)
        return
      }
      // A part that must join an earlier part cannot move on its own.
      if (joinPlaces(bench.getBuild(), reference, step, scopeFor(lesson, index)).length > 0) return
      for (const id of step.parts) {
        const legs = shiftedLegs(reference.parts.find((part) => part.id === id))
        expect(legs, id).not.toBe(null)
        expect(bench.place(id, legs), id + ' at ' + legs).toBe(true)
      }
      expect(evaluate(step, ctxFor(bench.getBuild(), reference)).passed).toBe(true)
    })
  }
})

// Do it for me: from the build a learner has after the earlier steps, the
// suggestion applied through the workbench passes the step.
describe('do it for me on every build and wire step', () => {
  for (const lesson of lessons.filter((item) => circuits[item.id])) {
    it(lesson.id + ' passes each step from the suggestion alone', () => {
      const { reference, bench } = setup(lesson)
      const steps = stepsFor(lesson)
      steps.forEach((step, index) => {
        if (step.kind !== 'build' && step.kind !== 'wire') return
        const scope = scopeFor(lesson, index)
        for (const item of suggest(bench.getBuild(), reference, step, scope)) {
          if (item.kind === 'unwire') expect(bench.removeWire(item.id)).toBe(true)
          else if (item.kind === 'part') expect(bench.place(item.id, item.legs), item.id).toBe(true)
          else expect(bench.addWire(item.from, item.to), item.from + ' to ' + item.to).toBeTruthy()
        }
        const ctx = { answers: {}, latched: [], build: bench.getBuild(), reference, scope, attempts: 1, busy: false }
        expect(evaluate(step, ctx).passed, step.id).toBe(true)
      })
    })
  }
})
