import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createNudge, NUDGE_MS } from '../src/course/nudge.js'

// A stand in flow: one lesson, the view built from a few fields.
function fakeFlow({ project = false } = {}) {
  const listeners = new Set()
  const state = { index: 0, passed: false, hintLevel: 0, items: [false], feedback: null }
  const raised = []
  function getView() {
    return {
      lesson: { id: '1.2', project },
      index: state.index,
      steps: [0, 1].map((i) => ({
        passed: i === state.index ? state.passed : false,
        hintLevel: i === state.index ? state.hintLevel : 0,
        result: { items: state.items.map((ok) => ({ text: 'x', ok })), feedback: state.feedback }
      }))
    }
  }
  return {
    state,
    raised,
    getView,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    raiseHint(level) {
      raised.push(level)
      if (state.hintLevel < level) state.hintLevel = level
      listeners.forEach((fn) => fn(getView()))
    },
    change(patch) {
      Object.assign(state, patch)
      listeners.forEach((fn) => fn(getView()))
    }
  }
}

describe('createNudge', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the hint after 40 s with no change', () => {
    const flow = fakeFlow()
    createNudge({ flow })
    expect(NUDGE_MS).toBe(40000)
    vi.advanceTimersByTime(NUDGE_MS - 1)
    expect(flow.raised).toEqual([])
    vi.advanceTimersByTime(1)
    expect(flow.raised).toEqual([1])
  })

  it('waits again after a checklist change or a workbench change', () => {
    const flow = fakeFlow()
    const nudge = createNudge({ flow })
    vi.advanceTimersByTime(30000)
    flow.change({ items: [true, false] })
    vi.advanceTimersByTime(30000)
    nudge.poke()
    vi.advanceTimersByTime(30000)
    expect(flow.raised).toEqual([])
    vi.advanceTimersByTime(10000)
    expect(flow.raised).toEqual([1])
  })

  it('shows the hint at once when a mistake is shown', () => {
    const flow = fakeFlow()
    createNudge({ flow })
    flow.change({ feedback: { tone: 'bad', text: 'Oops.' } })
    expect(flow.raised).toEqual([1])
  })

  it('does nothing on project lessons, passed steps or once a hint shows', () => {
    const project = fakeFlow({ project: true })
    createNudge({ flow: project })
    project.change({ feedback: { tone: 'bad', text: 'Oops.' } })
    vi.advanceTimersByTime(NUDGE_MS * 2)
    expect(project.raised).toEqual([])

    const passed = fakeFlow()
    createNudge({ flow: passed })
    passed.change({ passed: true })
    vi.advanceTimersByTime(NUDGE_MS * 2)
    expect(passed.raised).toEqual([])

    const hinted = fakeFlow()
    hinted.state.hintLevel = 2
    createNudge({ flow: hinted })
    vi.advanceTimersByTime(NUDGE_MS * 2)
    expect(hinted.raised).toEqual([])
  })

  it('starts over on a new step and stops when asked', () => {
    const flow = fakeFlow()
    const nudge = createNudge({ flow })
    vi.advanceTimersByTime(30000)
    flow.change({ index: 1 })
    vi.advanceTimersByTime(30000)
    expect(flow.raised).toEqual([])
    nudge.stop()
    vi.advanceTimersByTime(NUDGE_MS)
    expect(flow.raised).toEqual([])
  })
})
