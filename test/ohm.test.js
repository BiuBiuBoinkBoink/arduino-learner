import { describe, it, expect } from 'vitest'
import { ledCurrentMa, ledBrightness } from '../src/sim/ohm.js'

describe('ledCurrentMa', () => {
  it('is (5 - 2) / R in mA', () => {
    expect(ledCurrentMa(220)).toBeCloseTo(13.64, 2)
    expect(ledCurrentMa(1000)).toBeCloseTo(3, 6)
    expect(ledCurrentMa(10000)).toBeCloseTo(0.3, 6)
  })
})

describe('ledBrightness', () => {
  it('is 1 at 220 ohm, scales with the current and clamps to 1', () => {
    expect(ledBrightness(220)).toBe(1)
    expect(ledBrightness(1000)).toBeCloseTo(0.22, 6)
    expect(ledBrightness(10000)).toBeCloseTo(0.022, 6)
    expect(ledBrightness(100)).toBe(1)
  })
})
