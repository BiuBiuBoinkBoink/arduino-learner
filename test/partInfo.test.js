import { describe, it, expect } from 'vitest'
import { PART_INFO } from '../src/course/partInfo.js'
import { PART_TYPES } from '../src/circuits/footprints.js'

describe('part info', () => {
  it('has a card for every part type, covering each terminal once', () => {
    expect(Object.keys(PART_INFO).sort()).toEqual(Object.keys(PART_TYPES).sort())
    for (const [type, info] of Object.entries(PART_INFO)) {
      expect(info.name, type).toBeTruthy()
      expect(info.summary, type).toMatch(/\.$/)
      expect(info.legs.flatMap((leg) => leg.terminals).sort(), type).toEqual(PART_TYPES[type].terminals.slice().sort())
      expect(info.facts.length, type).toBeGreaterThan(0)
    }
  })

  it('is plain ASCII with no exclamation marks', () => {
    const text = JSON.stringify(PART_INFO)
    expect(/^[\x20-\x7e]*$/.test(text)).toBe(true)
    expect(text.includes('!')).toBe(false)
  })

  it('names the LED legs as the phase gives them', () => {
    expect(PART_INFO.led.legs.map((leg) => leg.label)).toEqual(['Long leg (anode)', 'Short leg (cathode)'])
    expect(PART_INFO.led.facts[0]).toEqual({ label: 'Forward voltage', value: 'about 2 V (red)' })
  })
})
