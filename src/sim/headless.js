// Headless runs: a lesson sketch through the code runtime, its board and the
// sim runner, with no worker and no screen, on a 16 ms frame clock. Used by
// test/lessonGoals.test.js and by the what if tool. Pure module.
//
// createHeadless({ lessonId, values, source, edit }) -> { started, runner,
//   stores, goals, events, wait(ms), set(values), passed(), now() }
// values override the lesson's param defaults; source replaces the filled
// sketch (else edit(filled source) is used, like a learner typing); set()
// changes values and reloads the running sketch, like a slider move. events
// are the runner's output events { kind, pin, value, at }, at in ms since Run.
//
// runHeadless({ lessonId, source, values, ms, actions }) -> { events,
//   progress, goalMet, error }
// actions: [{ at, kind: 'press' | 'release' | 'knob' | 'light' | 'temp', id, value }]
import { createSimRunner } from './runner.js'
import { sims } from './sims.js'
import { createPins } from './pins.js'
import { createInputs } from './inputs.js'
import { createRoom } from './room.js'
import { createSerial } from './serial.js'
import { createSession } from '../runner/session.js'
import { lessons } from '../course/lessons.js'
import { defaultValues, slotValues, fillSketch } from '../ui/sketch.js'

export const FRAME_MS = 16

export function createHeadless({ lessonId, values: overrides = {}, source = null, edit = (text) => text }) {
  const lesson = lessons.find((item) => item.id === lessonId)
  const { code, params } = lesson && lesson.sketch ? lesson.sketch : { code: '', params: [] }
  let values = { ...defaultValues(params), ...overrides }
  const sourceFor = () => (source !== null ? source : edit(fillSketch(code, slotValues(params, values))))
  const stores = { pins: createPins(), inputs: createInputs(), room: createRoom(), tones: createPins(), servos: createPins(), serial: createSerial() }
  stores.servos.set('D9', 90)
  let session = null
  let codeStart = 0
  let now = 0
  const codeRunner = {
    start(text) {
      session = createSession(text, { random: () => 0.5 })
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
  const events = []
  const runner = createSimRunner({ sims, ...stores, codeRunner, onGoal: (id) => goals.push(id), uploadMs: 0 })
  runner.subscribeOutput((event) => events.push(event))
  const started = runner.run({ lessonId, getValues: () => ({ ...values }), source: sourceFor(), now })

  function frame() {
    runner.tick(now)
    if (session) runner.receive(session.advance(now - codeStart))
    now += FRAME_MS
  }
  function wait(ms) {
    const end = now + ms
    while (now < end) frame()
  }
  function set(next) {
    values = { ...values, ...next }
    runner.reload(sourceFor(), now)
  }
  return { started, runner, stores, goals, events, wait, set, passed: () => runner.isGoalMet(), now: () => now }
}

function apply(stores, action) {
  if (action.kind === 'press') stores.inputs.setPressed(action.id, true)
  else if (action.kind === 'release') stores.inputs.setPressed(action.id, false)
  else if (action.kind === 'knob') stores.inputs.setValue(action.id, action.value)
  else if (action.kind === 'light') stores.room.setLight(action.value)
  else if (action.kind === 'temp') stores.room.setTempC(action.value)
}

export function runHeadless({ lessonId, source = null, values = {}, ms = 3000, actions = [] }) {
  const run = createHeadless({ lessonId, values, source })
  if (!run.started) return { events: [], progress: {}, goalMet: false, error: run.runner.getError() }
  for (const action of actions.slice().sort((a, b) => a.at - b.at)) {
    if (action.at > ms) break
    run.wait(action.at - run.now())
    apply(run.stores, action)
  }
  run.wait(ms - run.now())
  return { events: run.events, progress: run.runner.getProgress(), goalMet: run.passed(), error: run.runner.getError() }
}
