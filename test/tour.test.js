import { describe, it, expect } from 'vitest'
import { createTour } from '../src/sim/tour.js'

const IDS = ['a', 'b', 'c']

describe('createTour', () => {
  it('starts with nothing opened', () => {
    const tour = createTour(IDS)
    expect(tour.total).toBe(3)
    expect(tour.openedCount()).toBe(0)
    expect(tour.isComplete()).toBe(false)
    expect(tour.isOpened('a')).toBe(false)
  })

  it('opens a zone and counts it', () => {
    const tour = createTour(IDS)
    expect(tour.open('a')).toBe(false)
    expect(tour.isOpened('a')).toBe(true)
    expect(tour.openedCount()).toBe(1)
  })

  it('ignores repeat opens', () => {
    const tour = createTour(IDS)
    tour.open('a')
    expect(tour.open('a')).toBe(false)
    expect(tour.openedCount()).toBe(1)
  })

  it('ignores unknown ids', () => {
    const tour = createTour(IDS)
    expect(tour.open('x')).toBe(false)
    expect(tour.isOpened('x')).toBe(false)
    expect(tour.openedCount()).toBe(0)
  })

  it('returns true exactly once, on the open that completes the tour', () => {
    const tour = createTour(IDS)
    const results = ['a', 'a', 'b', 'x', 'c', 'c', 'b', 'a'].map((id) => tour.open(id))
    expect(results).toEqual([false, false, false, false, true, false, false, false])
    expect(tour.isComplete()).toBe(true)
    expect(tour.openedCount()).toBe(3)
  })
})
