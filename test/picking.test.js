import { describe, it, expect } from 'vitest'
import { nearestHole, holePosition } from '../src/parts/breadboard.js'
import { nearestPin, unoPinPosition, PITCH } from '../src/parts/unoBoard.js'

describe('nearestHole', () => {
  it('finds holes at their exact centres, rails included', () => {
    for (const name of ['1a', '9e', '10f', '30j', 'T+1', 'T-12', 'B-30', 'B+5']) {
      const p = holePosition(name)
      expect(nearestHole(p.x, p.z)).toBe(name)
    }
  })

  it('picks the nearer hole a little off centre', () => {
    const p = holePosition('9e')
    expect(nearestHole(p.x + 0.4 * PITCH, p.z - 0.4 * PITCH)).toBe('9e')
    expect(nearestHole(p.x + 0.55 * PITCH, p.z)).toBe('10e')
  })

  it('returns null half way between rows across the channel and off the board', () => {
    const e = holePosition('9e')
    const f = holePosition('9f')
    expect(nearestHole(e.x, (e.z + f.z) / 2)).toBe(null)
    const far = holePosition('1a')
    expect(nearestHole(far.x - 2 * PITCH, far.z)).toBe(null)
    expect(nearestHole(0, 100)).toBe(null)
    expect(nearestHole(holePosition('30a').x + PITCH, holePosition('30a').z)).toBe(null)
  })

  it('takes a smaller distance', () => {
    const p = holePosition('9e')
    expect(nearestHole(p.x + 0.3 * PITCH, p.z, 0.2 * PITCH)).toBe(null)
  })
})

describe('nearestPin', () => {
  it('finds D13, GND and A0 at their centres', () => {
    for (const name of ['D13', 'GND', 'A0', '5V', 'GND.2']) {
      const p = unoPinPosition(name)
      expect(nearestPin(p.x, p.z)).toBe(name)
    }
  })

  it('picks the nearer pin and returns null away from the headers', () => {
    const p = unoPinPosition('D13')
    expect(nearestPin(p.x - 0.4 * PITCH, p.z)).toBe('D13')
    expect(nearestPin(p.x - 0.6 * PITCH, p.z)).toBe('GND')
    expect(nearestPin(p.x, p.z + 2 * PITCH)).toBe(null)
  })
})

