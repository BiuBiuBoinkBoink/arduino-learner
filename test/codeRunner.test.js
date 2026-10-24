import { describe, it, expect, vi, afterEach } from 'vitest'
import { createCodeRunner, START_FAILED } from '../src/runner/codeRunner.js'

// A stand in for the Worker: records posted messages and lets tests reply.
function fakeWorker() {
  const worker = {
    posted: [],
    postMessage(message) {
      worker.posted.push(message)
    },
    reply(data) {
      worker.onmessage({ data })
    }
  }
  return worker
}

function setup(createWorker) {
  const batches = []
  const errors = []
  const runner = createCodeRunner({
    onBatch: (batch) => batches.push(batch),
    onError: (error) => errors.push(error),
    createWorker,
    startTimeoutMs: 1000
  })
  return { runner, batches, errors }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createCodeRunner', () => {
  it('starts the worker once, forwards batches and errors, and reports nothing once started', () => {
    vi.useFakeTimers()
    const worker = fakeWorker()
    const create = vi.fn(() => worker)
    const { runner, batches, errors } = setup(create)
    runner.start('code')
    worker.reply({ type: 'started' })
    worker.reply({ type: 'batch', events: [] })
    runner.setInputs({ D2: 0 })
    runner.sendSerial('hi')
    runner.start('again')
    worker.reply({ type: 'started' })
    vi.advanceTimersByTime(5000)
    expect(create).toHaveBeenCalledTimes(1)
    expect(worker.posted.map((message) => message.type)).toEqual(['start', 'inputs', 'serial', 'start'])
    expect(batches).toHaveLength(1)
    expect(errors).toEqual([])
    worker.reply({ type: 'error', message: 'Line 2: oops', line: 2 })
    expect(errors).toEqual([{ message: 'Line 2: oops', line: 2 }])
  })

  it('reports a start that the worker never confirms', () => {
    vi.useFakeTimers()
    const { runner, errors } = setup(() => fakeWorker())
    runner.start('code')
    vi.advanceTimersByTime(999)
    expect(errors).toEqual([])
    vi.advanceTimersByTime(1)
    expect(errors).toEqual([{ message: START_FAILED, line: null }])
  })

  it('does not report a timeout after stop', () => {
    vi.useFakeTimers()
    const { runner, errors } = setup(() => fakeWorker())
    runner.start('code')
    runner.stop()
    vi.advanceTimersByTime(5000)
    expect(errors).toEqual([])
  })

  it('reports a worker that cannot be made or fails to load, then tries a new one', () => {
    const { runner, errors } = setup(() => {
      throw new Error('module workers are not supported')
    })
    runner.start('code')
    expect(errors).toEqual([{ message: START_FAILED, line: null }])

    vi.useFakeTimers()
    const workers = []
    const loading = setup(() => {
      const worker = fakeWorker()
      workers.push(worker)
      return worker
    })
    loading.runner.start('code')
    workers[0].onerror({ preventDefault() {} })
    expect(loading.errors).toEqual([{ message: START_FAILED, line: null }])
    loading.runner.start('code')
    expect(workers).toHaveLength(2)
  })
})
