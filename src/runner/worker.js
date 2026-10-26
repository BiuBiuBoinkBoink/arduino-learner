// Web Worker that runs a learner sketch. Messages in: { type: 'start', source },
// { type: 'stop' }, { type: 'inputs', levels }, { type: 'serial', text },
// { type: 'trace', on } and { type: 'timeScale', scale } (slow motion; both
// carry over to the next start until changed).
// Messages out: { type: 'started' } once a sketch is running, so the client
// knows the worker is alive; { type: 'error', message, line } when the code does not parse
// or stops on a runtime error, and { type: 'batch', ...changes } after each
// TICK_MS slice of virtual time (only when something changed). The virtual
// clock follows real time from the start message.
import { createSession } from './session.js'

const TICK_MS = 16
let session = null
let timer = null
let startedAt = 0
let trace = false
let timeScale = 1

function stop() {
  clearInterval(timer)
  timer = null
  session = null
}

function step() {
  if (!session) return
  const batch = session.advance(performance.now() - startedAt)
  // Input events count too: a reaction timer needs them even in a quiet slice.
  const changed = batch.events.length || batch.serial
  if (changed) self.postMessage({ type: 'batch', ...batch, error: null })
  if (batch.error) {
    self.postMessage({ type: 'error', ...batch.error })
    stop()
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'start') {
    stop()
    try {
      session = createSession(data.source, { trace, timeScale })
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message, line: error.line || 1 })
      return
    }
    startedAt = performance.now()
    self.postMessage({ type: 'started' })
    timer = setInterval(step, TICK_MS)
    step()
  } else if (data.type === 'stop') {
    stop()
  } else if (data.type === 'inputs' && session) {
    session.setInputs(data.levels)
  } else if (data.type === 'serial' && session) {
    session.sendSerial(data.text)
  } else if (data.type === 'trace') {
    trace = Boolean(data.on)
    if (session) session.setTrace(trace)
  } else if (data.type === 'timeScale') {
    timeScale = data.scale
    if (session) session.setTimeScale(timeScale)
  }
}
