// Main thread client for the sketch worker. createCodeRunner({ onBatch, onError })
// -> { start(source), stop(), setInputs(levels), sendSerial(text) }. One
// worker is made on first start and reused; stop leaves it idle.
export function createCodeRunner({ onBatch, onError }) {
  let worker = null

  function ensureWorker() {
    if (worker) return worker
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      if (data.type === 'batch') onBatch(data)
      else if (data.type === 'error') onError({ message: data.message, line: data.line })
    }
    return worker
  }

  return {
    start(source) {
      ensureWorker().postMessage({ type: 'start', source })
    },
    stop() {
      if (worker) worker.postMessage({ type: 'stop' })
    },
    setInputs(levels) {
      if (worker) worker.postMessage({ type: 'inputs', levels })
    },
    sendSerial(text) {
      if (worker) worker.postMessage({ type: 'serial', text })
    }
  }
}
