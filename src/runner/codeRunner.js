// Main thread client for the sketch worker. createCodeRunner({ onBatch, onError,
// createWorker, startTimeoutMs }) -> { start(source), stop(), setInputs(levels),
// sendSerial(text), setTrace(on), setTimeScale(scale) }. One worker is made on first start and reused; stop
// leaves it idle. A worker that fails to load, or does not confirm a start
// within startTimeoutMs, reports an error with line null instead of leaving
// Run silently doing nothing. createWorker is injectable for tests.
export const START_TIMEOUT_MS = 4000
export const START_FAILED = 'The code runner could not start in this browser. Reload the page and press Run again.'

function moduleWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
}

export function createCodeRunner({ onBatch, onError, createWorker = moduleWorker, startTimeoutMs = START_TIMEOUT_MS }) {
  let worker = null
  let startTimer = null

  function clearStartTimer() {
    clearTimeout(startTimer)
    startTimer = null
  }

  function failStart() {
    clearStartTimer()
    onError({ message: START_FAILED, line: null })
  }

  function ensureWorker() {
    if (worker) return worker
    try {
      worker = createWorker()
    } catch {
      worker = null
      return null
    }
    worker.onmessage = ({ data }) => {
      if (data.type === 'started') clearStartTimer()
      else if (data.type === 'batch') onBatch(data)
      else if (data.type === 'error') {
        clearStartTimer()
        onError({ message: data.message, line: data.line })
      }
    }
    // A worker script that cannot load, or a message that cannot be read.
    worker.onerror = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      worker = null
      failStart()
    }
    worker.onmessageerror = failStart
    return worker
  }

  return {
    start(source) {
      clearStartTimer()
      const target = ensureWorker()
      if (!target) {
        failStart()
        return
      }
      target.postMessage({ type: 'start', source })
      startTimer = setTimeout(failStart, startTimeoutMs)
    },
    stop() {
      clearStartTimer()
      if (worker) worker.postMessage({ type: 'stop' })
    },
    setInputs(levels) {
      if (worker) worker.postMessage({ type: 'inputs', levels })
    },
    sendSerial(text) {
      if (worker) worker.postMessage({ type: 'serial', text })
    },
    // Slow motion: line events on or off, and the sketch clock speed.
    setTrace(on) {
      if (worker) worker.postMessage({ type: 'trace', on: Boolean(on) })
    },
    setTimeScale(scale) {
      if (worker) worker.postMessage({ type: 'timeScale', scale })
    }
  }
}
