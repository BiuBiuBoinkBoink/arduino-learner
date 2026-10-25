import { describe, it, expect } from 'vitest'
import { layoutFor, LAYOUTS } from '../src/ui/layoutMode.js'

describe('layoutFor', () => {
  it('is wide from 1200 px up', () => {
    expect(layoutFor(1200)).toBe('wide')
    expect(layoutFor(1440)).toBe('wide')
    expect(layoutFor(3000)).toBe('wide')
  })

  it('is medium from 900 to 1199 px', () => {
    expect(layoutFor(900)).toBe('medium')
    expect(layoutFor(1024)).toBe('medium')
    expect(layoutFor(1199)).toBe('medium')
    expect(layoutFor(1199.5)).toBe('medium')
  })

  it('is compact under 900 px', () => {
    expect(layoutFor(899)).toBe('compact')
    expect(layoutFor(899.9)).toBe('compact')
    expect(layoutFor(768)).toBe('compact')
    expect(layoutFor(390)).toBe('compact')
    expect(layoutFor(0)).toBe('compact')
  })

  it('treats a width that is not a number as wide', () => {
    expect(layoutFor(undefined)).toBe('wide')
    expect(layoutFor(NaN)).toBe('wide')
    expect(layoutFor('abc')).toBe('wide')
  })

  it('accepts numeric strings', () => {
    expect(layoutFor('1024')).toBe('medium')
  })

  it('lists every layout it can return', () => {
    expect(LAYOUTS).toEqual(['wide', 'medium', 'compact'])
  })
})
