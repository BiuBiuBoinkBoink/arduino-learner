// Web Worker that runs a learner sketch. Messages in: { type: 'start', source },
// { type: 'stop' }, { type: 'inputs', levels }, { type: 'serial', text }.
// Messages out: { type: 'error', message, line } when the code does not parse
// or stops on a runtime error, and { type: 'batch', ...changes } after each
// TICK_MS slice of virtual time (only when something changed). The virtual
// clock follows real time from the start message.
import { createSession } from './session.js'

const TICK_MS = 16
let session = null
let timer = null
let startedAt = 0

function stop() {
  clearInterval(timer)
  timer = null
  session = null
}

function step() {
  if (!session) return
  const batch = session.advance(performance.now() - startedAt)
  const changed = Object.keys(batch.pins).length || Object.keys(batch.tones).length ||
    Object.keys(batch.servos).length || batch.serial
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
      session = createSession(data.source)
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message, line: error.line || 1 })
      return
    }
    startedAt = performance.now()
    timer = setInterval(step, TICK_MS)
    step()
  } else if (data.type === 'stop') {
    stop()
  } else if (data.type === 'inputs' && session) {
    session.setInputs(data.levels)
  } else if (data.type === 'serial' && session) {
    session.sendSerial(data.text)
  }
}
