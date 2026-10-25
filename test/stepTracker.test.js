import { describe, it, expect } from 'vitest'
import { createStepTracker } from '../src/course/stepTracker.js'

const KEY = 'robo-learn:steps'

// Two small lessons with their own steps, so the tests do not follow lesson content.
const lessons = [
  { id: 'a', steps: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] },
  { id: 'b', steps: [{ id: 'only' }] }
]
const stepsFor = (lesson) => lesson.steps

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) }
  }
}

function setup(storage = fakeStorage()) {
  const tracker = createStepTracker({ storage, lessons, stepsFor })
  const calls = []
  tracker.subscribe((id) => calls.push(id))
  return { tracker, calls, storage }
}

const BLANK = { current: 0, passed: [], helped: [], answers: {}, latched: {}, hintLevels: {} }

describe('createStepTracker', () => {
  it('starts every lesson at step 0 with nothing passed', () => {
    const { tracker } = setup()
    expect(tracker.get('a')).toEqual(BLANK)
    expect(tracker.has('a')).toBe(false)
  })

  it('saves every change and restores it in a new tracker', () => {
    const { tracker, storage, calls } = setup()
    tracker.answer('a', 'one', 1)
    tracker.markPassed('a', 'one')
    tracker.setCurrent('a', 1)
    tracker.latch('a', 'two', 'blinked')
    tracker.markPassed('a', 'two', { helped: true })
    tracker.setHintLevel('a', 'three', 2)
    expect(calls).toEqual(['a', 'a', 'a', 'a', 'a', 'a'])
    const again = setup(fakeStorage(storage.data)).tracker
    expect(again.has('a')).toBe(true)
    expect(again.get('a')).toEqual({
      current: 1,
      passed: ['one', 'two'],
      helped: ['two'],
      answers: { one: 1 },
      latched: { two: ['blinked'] },
      hintLevels: { three: 2 }
    })
  })

  it('does not notify when nothing changed', () => {
    const { tracker, calls } = setup()
    tracker.markPassed('a', 'one')
    tracker.markPassed('a', 'one')
    tracker.answer('a', 'one', 0)
    tracker.answer('a', 'one', 0)
    tracker.setCurrent('a', 0)
    expect(calls).toEqual(['a', 'a'])
  })

  it('treats corrupt JSON as no progress', () => {
    const { tracker } = setup(fakeStorage({ [KEY]: '{not json' }))
    expect(tracker.get('a')).toEqual(BLANK)
    expect(setup(fakeStorage({ [KEY]: '[1, 2]' })).tracker.get('a')).toEqual(BLANK)
  })

  it('drops unknown lessons, unknown steps and wrong types, and clamps current', () => {
    const stored = {
      zz: { current: 0 },
      a: {
        current: 9,
        passed: ['two', 'nope', 3, 'one'],
        helped: ['two', 'three'],
        answers: { one: 1, two: 1.5, three: -1, nope: 0 },
        latched: { one: ['x', 2, 'x'], nope: ['y'], two: 'z' },
        hintLevels: { one: 2, two: 9, three: 'a' }
      },
      b: { current: 0.5, passed: 'only' }
    }
    const { tracker } = setup(fakeStorage({ [KEY]: JSON.stringify(stored) }))
    expect(tracker.has('zz')).toBe(false)
    expect(tracker.get('a')).toEqual({
      current: 2,
      passed: ['one', 'two'],
      helped: ['two'],
      answers: { one: 1 },
      latched: { one: ['x'] },
      hintLevels: { one: 2 }
    })
    expect(tracker.get('b')).toEqual(BLANK)
  })

  it('ignores unknown lessons, unknown steps and bad values in changes', () => {
    const { tracker, calls } = setup()
    tracker.markPassed('zz', 'one')
    tracker.markPassed('a', 'nope')
    tracker.setCurrent('a', 3)
    tracker.setCurrent('a', -1)
    tracker.answer('a', 'one', 'x')
    tracker.setHintLevel('a', 'one', 4)
    expect(calls).toEqual([])
  })

  it('keeps hint levels across a reload, and reset clears them', () => {
    const { tracker, storage } = setup()
    tracker.setHintLevel('a', 'one', 1)
    tracker.setHintLevel('a', 'two', 3)
    const again = createStepTracker({ storage, lessons, stepsFor })
    expect(again.get('a').hintLevels).toEqual({ one: 1, two: 3 })
    again.reset('a')
    expect(again.get('a').hintLevels).toEqual({})
  })

  it('keeps working in memory when storage throws', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') }
    }
    const { tracker } = setup(storage)
    tracker.markPassed('a', 'one')
    expect(tracker.get('a').passed).toEqual(['one'])
  })

  it('reset starts the lesson over and keeps a record of it', () => {
    const { tracker } = setup()
    tracker.completeAll('a')
    tracker.reset('a')
    expect(tracker.get('a')).toEqual(BLANK)
    expect(tracker.has('a')).toBe(true)
    expect(tracker.get('b')).toEqual(BLANK)
  })

  it('completeAll passes every step and moves to the last', () => {
    const { tracker } = setup()
    tracker.completeAll('a')
    expect(tracker.get('a')).toMatchObject({ current: 2, passed: ['one', 'two', 'three'] })
  })

  it('latch is idempotent', () => {
    const { tracker, calls } = setup()
    tracker.latch('a', 'two', 'blinked')
    tracker.latch('a', 'two', 'blinked')
    tracker.latch('a', 'two', 'ran')
    expect(tracker.get('a').latched).toEqual({ two: ['blinked', 'ran'] })
    expect(calls).toEqual(['a', 'a'])
  })

  it('returns copies, so callers cannot change the record', () => {
    const { tracker } = setup()
    tracker.latch('a', 'one', 'x')
    tracker.get('a').latched.one.push('y')
    tracker.get('a').passed.push('one')
    expect(tracker.get('a')).toMatchObject({ passed: [], latched: { one: ['x'] } })
  })
})
