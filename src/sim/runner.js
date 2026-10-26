// Sim runner: idle -> uploading (fake upload) -> running -> idle on stop, or
// stopped on a code error. Pure module: time only comes in through now, and
// the learner's code runs in the injected code runner ({ start(source), stop(),
// setInputs(levels) }), whose batches come back through receive(batch).
//
// The lesson sim is a board: the circuit around the sketch and the goal. Each
// tick it gives the input levels the sketch reads (levels(now)), which go to
// the code runner when they change. Each output event of the sketch is applied
// first (pins and tones to their stores; servos are left to the board), then
// passed to the board's output(event) with at on the same clock as now. The
// runner never marks progress itself: it calls onGoal(lessonId) once per run
// when checkGoal() first passes. Boards also get getCode(), the analyzeCode
// result for the code now running, for goals that inspect the code itself.
// 'input' events (the circuit changing an input) reach the board only. reload(source, now) swaps the running code
// without a new upload; the board may reset timing in its own reload(now).
// subscribeOutput(fn) calls fn({ kind, pin, value, at }) for every output event
// it applies (the scope listens); getClock() is the clock those at times are on,
// as of the last tick or the latest event, whichever is later.
// getInputLevels() is what the board last sent to the sketch's input pins
// ({} unless running).
// setSlowMotion(on, speed = 0.1), while running: the code runner's clock runs
// at speed with line events on (subscribeLine(fn) hears each running line),
// and the run becomes a demo: onGoal is not called and getProgress() is {} for
// the rest of the run. Off: speed 1, no line events; the run stays a demo
// until the next Run. Stop and Run turn it off.
// beginDemo(), while running: the same demo flag without slowing down (the
// help chat's demo_input); false when not running.
import { createProgram } from '../runner/interpreter.js'
import { analyzeCode } from '../runner/codeChecks.js'

export const UPLOAD_MS = 1500
export const RAN_MS = 1000

// Compiles without running: null, or { message, line } for the first error.
export function checkCode(source) {
  try {
    createProgram(source, {})
    return null
  } catch (error) {
    return { message: error.message, line: error.line || 1 }
  }
}

export function createSimRunner({ sims, pins, inputs, room, tones, servos, serial, codeRunner, onGoal, uploadMs = UPLOAD_MS }) {
  let phase = 'idle'
  let lessonId = null
  let getValues = null
  let source = ''
  let runStart = 0
  let startedAt = 0
  // When the code runner last started: output event times count from here.
  let codeStart = 0
  let sim = null
  let goalMet = false
  let error = null
  let sentLevels = {}
  let analysis = null
  // Time of the last tick, for how long the board has been running.
  let lastTick = 0
  // The clock output event times are on: anchored at a real time and moving at timeScale.
  let anchorReal = 0
  let anchorClock = 0
  let timeScale = 1
  let lastEventAt = -Infinity
  const outputListeners = new Set()
  const lineListeners = new Set()
  // Slow motion speed, or null; a demo run never meets its goal.
  let slow = null
  let demo = false

  function setAnchor(now) {
    anchorClock = clockAt(now)
    anchorReal = now
  }

  function clockAt(now) {
    return anchorClock + (now - anchorReal) * timeScale
  }

  function hasSim(id) {
    return Object.prototype.hasOwnProperty.call(sims, id)
  }

  // Returns true, or false when there is no sim, the runner is busy or the code
  // does not compile (then getError() says why).
  function run(options) {
    if (phase === 'uploading' || phase === 'running' || !hasSim(options.lessonId)) return false
    error = checkCode(options.source)
    if (error) {
      phase = 'error'
      return false
    }
    endSlowMotion()
    demo = false
    lessonId = options.lessonId
    getValues = options.getValues
    source = options.source
    runStart = options.now
    goalMet = false
    phase = 'uploading'
    return true
  }

  // Restarts the running sketch with new code at once (a slider moved), keeping
  // the board and its goal progress. False if not running or it does not compile.
  function reload(nextSource, now) {
    if (phase !== 'running') return false
    if (checkCode(nextSource)) return false
    source = nextSource
    analysis = analyzeCode(source)
    codeStart = now
    anchorReal = now
    anchorClock = now
    sentLevels = {}
    if (typeof sim.reload === 'function') sim.reload(now)
    codeRunner.start(source)
    sendLevels(now)
    return true
  }

  function sendLevels(now) {
    const levels = sim.levels(now) || {}
    const changed = {}
    for (const [pin, level] of Object.entries(levels)) {
      if (sentLevels[pin] !== level) changed[pin] = level
    }
    if (Object.keys(changed).length === 0) return
    sentLevels = { ...sentLevels, ...changed }
    codeRunner.setInputs(changed)
  }

  function tick(now) {
    lastTick = now
    if (phase === 'uploading') {
      if (now - runStart < uploadMs) return
      startedAt = now
      codeStart = now
      anchorReal = now
      anchorClock = now
      lastEventAt = -Infinity
      sentLevels = {}
      analysis = analyzeCode(source)
      sim = sims[lessonId]({ pins, inputs, room, tones, servos, serial, getValues, startedAt, getCode: () => analysis })
      codeRunner.start(source)
      phase = 'running'
    }
    if (phase !== 'running') return
    sendLevels(now)
    if (typeof sim.update === 'function') sim.update(now)
    checkGoal()
  }

  function checkGoal() {
    if (!goalMet && !demo && typeof sim.checkGoal === 'function' && sim.checkGoal()) {
      goalMet = true
      onGoal(lessonId)
    }
  }

  // Applies a batch from the code runner: { events, serial, error }. A batch
  // without events (a worker from before events existed, still open in a tab)
  // falls back to its last value per pin, so outputs still reach the parts.
  function receive(batch) {
    if (phase !== 'running') return
    for (const [ms, kind, pin, value] of batch.events || eventsFromLastValues(batch)) {
      if (kind === 'line') {
        lineListeners.forEach((fn) => fn(value))
        continue
      }
      if (kind === 'input') {
        // Seen by the board only; the stores hold the sketch's outputs.
      } else if (kind === 'pin') pins.set(pin, value)
      else if (kind === 'tone' && tones) tones.set(pin, value)
      const event = { kind, pin, value, at: codeStart + ms }
      lastEventAt = Math.max(lastEventAt, event.at)
      if (typeof sim.output === 'function') sim.output(event)
      if (kind !== 'input') outputListeners.forEach((fn) => fn({ ...event }))
    }
    if (batch.serial && serial) serial.print(batch.serial)
    checkGoal()
    if (batch.error) fail(batch.error)
  }

  function eventsFromLastValues(batch) {
    const at = batch.millis || 0
    return [
      ...Object.entries(batch.pins || {}).map(([pin, value]) => [at, 'pin', pin, value]),
      ...Object.entries(batch.tones || {}).map(([pin, value]) => [at, 'tone', pin, value]),
      ...Object.entries(batch.servos || {}).map(([pin, value]) => [at, 'servo', pin, value])
    ]
  }

  // A runtime error stops the run and keeps the pins as they were. An error
  // that is not about a line of code (the runner could not start) has line null.
  function fail(codeError) {
    if (phase !== 'running' && phase !== 'uploading') return
    error = { message: codeError.message, line: codeError.line || null }
    endSlowMotion()
    halt()
    phase = 'error'
  }

  function halt() {
    codeRunner.stop()
    if (sim && typeof sim.stop === 'function') sim.stop()
    pins.reset()
    if (tones) tones.reset()
    sim = null
  }

  // Slow motion back to normal speed, without ending the demo.
  function endSlowMotion() {
    if (slow === null) return
    setAnchor(lastTick)
    timeScale = 1
    slow = null
    if (typeof codeRunner.setTimeScale === 'function') codeRunner.setTimeScale(1)
    if (typeof codeRunner.setTrace === 'function') codeRunner.setTrace(false)
  }

  // True when the speed changed.
  function setSlowMotion(on, speed = 0.1) {
    if (!on) {
      const was = slow !== null
      endSlowMotion()
      return was
    }
    if (phase !== 'running') return false
    demo = true
    setAnchor(lastTick)
    timeScale = speed
    slow = speed
    if (typeof codeRunner.setTimeScale === 'function') codeRunner.setTimeScale(speed)
    if (typeof codeRunner.setTrace === 'function') codeRunner.setTrace(true)
    return true
  }

  // A demo run without slow motion: goals paused until the next Run.
  function beginDemo() {
    if (phase !== 'running') return false
    demo = true
    return true
  }

  function stop() {
    endSlowMotion()
    if (phase === 'running') halt()
    else if (phase === 'uploading') sim = null
    phase = 'idle'
    error = null
  }

  // Named sub goals for lesson steps: {} unless running; ran once the board has
  // run for RAN_MS, goal the lesson goal, plus the board's own progress().
  function getProgress() {
    if (phase !== 'running' || demo) return {}
    const own = typeof sim.progress === 'function' ? sim.progress() : {}
    return { ran: lastTick - startedAt >= RAN_MS, goal: goalMet, ...own }
  }

  return {
    hasSim,
    run,
    reload,
    tick,
    receive,
    fail,
    stop,
    getPhase: () => phase,
    getError: () => error,
    isGoalMet: () => goalMet,
    getProgress,
    getClock: () => Math.max(clockAt(lastTick), lastEventAt),
    getInputLevels: () => (phase === 'running' ? { ...sentLevels } : {}),
    setSlowMotion,
    getSlowMotion: () => slow,
    isDemo: () => demo,
    beginDemo,
    subscribeLine(fn) {
      lineListeners.add(fn)
      return () => lineListeners.delete(fn)
    },
    subscribeOutput(fn) {
      outputListeners.add(fn)
      return () => outputListeners.delete(fn)
    },
    getReadout: () => (phase === 'running' && typeof sim.readout === 'function' ? sim.readout() : '')
  }
}
