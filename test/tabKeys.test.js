import { describe, it, expect } from 'vitest'
import { nextTabIndex } from '../src/ui/tabKeys.js'

describe('nextTabIndex', () => {
  it('ArrowRight moves to the next tab and wraps last to first', () => {
    expect(nextTabIndex('ArrowRight', 0, 4)).toBe(1)
    expect(nextTabIndex('ArrowRight', 2, 4)).toBe(3)
    expect(nextTabIndex('ArrowRight', 3, 4)).toBe(0)
  })

  it('ArrowLeft moves to the previous tab and wraps first to last', () => {
    expect(nextTabIndex('ArrowLeft', 3, 4)).toBe(2)
    expect(nextTabIndex('ArrowLeft', 1, 4)).toBe(0)
    expect(nextTabIndex('ArrowLeft', 0, 4)).toBe(3)
  })

  it('Home goes to the first tab and End to the last', () => {
    expect(nextTabIndex('Home', 2, 4)).toBe(0)
    expect(nextTabIndex('Home', 0, 4)).toBe(0)
    expect(nextTabIndex('End', 1, 4)).toBe(3)
    expect(nextTabIndex('End', 3, 4)).toBe(3)
  })

  it('returns null for other keys', () => {
    expect(nextTabIndex('Enter', 1, 4)).toBe(null)
    expect(nextTabIndex('a', 1, 4)).toBe(null)
    expect(nextTabIndex('ArrowDown', 1, 4)).toBe(null)
  })
})
