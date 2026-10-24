import { describe, it, expect } from 'vitest'
import { createCourse } from '../src/course/state.js'
import { idFromHash, hashForId } from '../src/course/hash.js'
import { lessons } from '../src/course/lessons.js'

const KEY = 'robo-learn:progress'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) }
  }
}

function setup(storage = fakeStorage()) {
  const course = createCourse({ lessons, storage })
  const calls = []
  course.subscribe((state) => calls.push(state))
  return { course, calls, storage }
}

describe('lessons', () => {
  it('has 12 entries with unique ids', () => {
    expect(lessons.length).toBe(12)
    expect(new Set(lessons.map((l) => l.id)).size).toBe(12)
  })
})

describe('createCourse', () => {
  it('starts on the first lesson', () => {
    const { course } = setup()
    const state = course.getState()
    expect(state.lesson.id).toBe('1.1')
    expect(state.index).toBe(0)
    expect(state.completed).toEqual([])
    expect(state.total).toBe(12)
  })

  it('goTo a known id changes lesson and notifies', () => {
    const { course, calls } = setup()
    expect(course.goTo('1.3')).toBe(true)
    expect(course.getState().lesson.id).toBe('1.3')
    expect(course.getState().index).toBe(2)
    expect(calls.length).toBe(1)
    expect(calls[0].lesson.id).toBe('1.3')
  })

  it('goTo an unknown id or the current id does nothing', () => {
    const { course, calls } = setup()
    expect(course.goTo('9.9')).toBe(false)
    expect(course.goTo(null)).toBe(false)
    expect(course.goTo('1.1')).toBe(false)
    expect(course.getState().lesson.id).toBe('1.1')
    expect(calls.length).toBe(0)
  })

  it('next and prev move and stop at the ends', () => {
    const { course, calls } = setup()
    course.prev()
    expect(course.getState().lesson.id).toBe('1.1')
    expect(calls.length).toBe(0)
    course.next()
    expect(course.getState().lesson.id).toBe('1.2')
    course.prev()
    expect(course.getState().lesson.id).toBe('1.1')
    course.goTo('1.12')
    const before = calls.length
    course.next()
    expect(course.getState().lesson.id).toBe('1.12')
    expect(calls.length).toBe(before)
    course.prev()
    expect(course.getState().lesson.id).toBe('1.11')
  })

  it('markComplete saves a JSON array without duplicates and notifies', () => {
    const { course, calls, storage } = setup()
    course.markComplete('1.2')
    course.markComplete('1.1')
    course.markComplete('1.2')
    expect(JSON.parse(storage.data[KEY])).toEqual(['1.1', '1.2'])
    expect(course.getState().completed).toEqual(['1.1', '1.2'])
    expect(calls.length).toBe(3)
  })

  it('markComplete ignores unknown ids', () => {
    const { course, calls, storage } = setup()
    course.markComplete('9.9')
    expect(storage.data[KEY]).toBeUndefined()
    expect(calls.length).toBe(0)
  })

  it('restores completed ids from storage', () => {
    const storage = fakeStorage()
    createCourse({ lessons, storage }).markComplete('1.4')
    const again = createCourse({ lessons, storage })
    expect(again.getState().completed).toEqual(['1.4'])
  })

  it('ignores invalid JSON, non arrays and unknown ids in storage', () => {
    expect(createCourse({ lessons, storage: fakeStorage({ [KEY]: 'not json' }) }).getState().completed).toEqual([])
    expect(createCourse({ lessons, storage: fakeStorage({ [KEY]: '{"a":1}' }) }).getState().completed).toEqual([])
    const mixed = fakeStorage({ [KEY]: JSON.stringify(['9.9', '1.2', 3]) })
    expect(createCourse({ lessons, storage: mixed }).getState().completed).toEqual(['1.2'])
  })

  it('does not throw when storage throws', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') }
    }
    let course
    expect(() => { course = createCourse({ lessons, storage: broken }) }).not.toThrow()
    expect(course.getState().completed).toEqual([])
    expect(() => course.markComplete('1.1')).not.toThrow()
    expect(course.getState().completed).toEqual(['1.1'])
  })

  it('unsubscribe stops notifications', () => {
    const course = createCourse({ lessons, storage: fakeStorage() })
    let count = 0
    const off = course.subscribe(() => { count++ })
    course.goTo('1.2')
    off()
    course.goTo('1.3')
    course.markComplete('1.3')
    expect(count).toBe(1)
  })
})

describe('hash helpers', () => {
  it('round trip between ids and hashes', () => {
    expect(idFromHash('#1.3')).toBe('1.3')
    expect(hashForId('1.3')).toBe('#1.3')
    expect(idFromHash(hashForId('1.12'))).toBe('1.12')
    expect(hashForId(idFromHash('#1.7'))).toBe('#1.7')
  })

  it('returns null for an empty hash', () => {
    expect(idFromHash('')).toBe(null)
    expect(idFromHash('#')).toBe(null)
  })
})
