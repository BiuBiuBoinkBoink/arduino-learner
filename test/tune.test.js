import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createTuneSim, TARGET, NOTES, noteName } from '../src/sim/tune.js'

function setup(start = { note1: 262, note2: 294, note3: 330 }) {
  const tones = createPins()
  const values = { ...start }
  const sim = createTuneSim({ tones, getValues: () => ({ ...values }), startedAt: 0 })
  return { tones, values, sim }
}

describe('notes', () => {
  it('names C to B and targets E D C', () => {
    expect(NOTES.map((note) => note.name).join('')).toBe('CDEFGAB')
    expect(TARGET.map(noteName)).toEqual(['E', 'D', 'C'])
    expect(noteName(123)).toBe('123 Hz')
  })
})

describe('createTuneSim', () => {
  it('plays each note for 300 ms every 350 ms on D8, then pauses 1000 ms', () => {
    const { tones, sim } = setup()
    const at = (now) => {
      sim.update(now)
      return tones.get('D8')
    }
    expect(at(0)).toBe(262)
    expect(at(299)).toBe(262)
    expect(at(320)).toBe(0)
    expect(at(360)).toBe(294)
    expect(at(710)).toBe(330)
    expect(at(1100)).toBe(0)
    expect(at(2000)).toBe(0)
    expect(at(2060)).toBe(262)
  })

  it('reads out the tone and the target, and stop silences D8', () => {
    const { tones, sim } = setup()
    sim.update(10)
    expect(sim.readout()).toBe('tone(8, 262), note C. Target tune E D C')
    sim.update(320)
    expect(sim.readout()).toBe('Silent. Target tune E D C')
    sim.stop()
    expect(tones.get('D8')).toBe(0)
  })

  it('goal passes only after a loop plays E, D, C in order', () => {
    const { values, sim } = setup()
    for (let now = 0; now < 4100; now += 16) sim.update(now)
    expect(sim.checkGoal()).toBe(false)
    Object.assign(values, { note1: 330, note2: 294, note3: 262 })
    for (let now = 4100; now < 4900; now += 16) sim.update(now)
    expect(sim.checkGoal()).toBe(true)
  })

  it('a note change mid loop applies from the next note it starts', () => {
    const { tones, values, sim } = setup()
    sim.update(10)
    values.note1 = 494
    values.note2 = 440
    sim.update(100)
    expect(tones.get('D8')).toBe(262)
    sim.update(400)
    expect(tones.get('D8')).toBe(440)
  })

  it('keeps the note order when frames are slow', () => {
    const { values, sim } = setup({ note1: 330, note2: 294, note3: 262 })
    for (let now = 0; now < 2100; now += 500) sim.update(now)
    expect(sim.checkGoal()).toBe(true)
    expect(values.note1).toBe(330)
  })
})
