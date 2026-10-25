import { describe, it, expect } from 'vitest'
import { nextSheetState, sheetHeights, SHEET_STATES, PEEK_PX } from '../src/ui/sheetState.js'

describe('sheetHeights', () => {
  it('is 132 px, half the workbench and the workbench less 8 px', () => {
    expect(sheetHeights(800)).toEqual({ peek: 132, half: 400, full: 792 })
  })

  it('never makes full shorter than peek', () => {
    expect(sheetHeights(100).full).toBe(PEEK_PX)
    expect(sheetHeights(NaN)).toEqual({ peek: 132, half: 0, full: 132 })
  })
})

describe('nextSheetState', () => {
  it('lists the states from low to high', () => {
    expect(SHEET_STATES).toEqual(['peek', 'half', 'full'])
  })

  it('expand moves one state up and stops at full', () => {
    expect(nextSheetState('peek', 'expand')).toBe('half')
    expect(nextSheetState('half', 'expand')).toBe('full')
    expect(nextSheetState('full', 'expand')).toBe('full')
  })

  it('collapse moves one state down and stops at peek', () => {
    expect(nextSheetState('full', 'collapse')).toBe('half')
    expect(nextSheetState('half', 'collapse')).toBe('peek')
    expect(nextSheetState('peek', 'collapse')).toBe('peek')
  })

  it('treats an unknown state as peek', () => {
    expect(nextSheetState('open', 'expand')).toBe('half')
    expect(nextSheetState(undefined, 'collapse')).toBe('peek')
  })

  it('keeps the state for an unknown action', () => {
    expect(nextSheetState('half', 'jump')).toBe('half')
    expect(nextSheetState('full', null)).toBe('full')
  })

  it('a small drag snaps back to where it started', () => {
    expect(nextSheetState('peek', { type: 'drag', dy: -40, height: 800 })).toBe('peek')
    expect(nextSheetState('half', { type: 'drag', dy: 30, height: 800 })).toBe('half')
    expect(nextSheetState('full', { type: 'drag', dy: 100, height: 800 })).toBe('full')
  })

  it('a drag up snaps to the nearest higher state', () => {
    // peek 132 - (-200) = 332: nearer half (400) than peek (132).
    expect(nextSheetState('peek', { type: 'drag', dy: -200, height: 800 })).toBe('half')
    expect(nextSheetState('peek', { type: 'drag', dy: -600, height: 800 })).toBe('full')
    expect(nextSheetState('half', { type: 'drag', dy: -300, height: 800 })).toBe('full')
  })

  it('a drag down snaps to the nearest lower state', () => {
    expect(nextSheetState('full', { type: 'drag', dy: 300, height: 800 })).toBe('half')
    expect(nextSheetState('full', { type: 'drag', dy: 700, height: 800 })).toBe('peek')
    expect(nextSheetState('half', { type: 'drag', dy: 200, height: 800 })).toBe('peek')
  })

  it('a drag past either end snaps to that end', () => {
    expect(nextSheetState('peek', { type: 'drag', dy: 500, height: 800 })).toBe('peek')
    expect(nextSheetState('full', { type: 'drag', dy: -500, height: 800 })).toBe('full')
  })

  it('a drag with no distance keeps the state', () => {
    expect(nextSheetState('half', { type: 'drag', height: 800 })).toBe('half')
  })
})
