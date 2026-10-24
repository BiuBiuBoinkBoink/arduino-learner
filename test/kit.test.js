import { describe, it, expect } from 'vitest'
import { kitFor } from '../src/build/kit.js'
import { circuits } from '../src/circuits/circuits.js'

const reference = {
  parts: [
    { id: 'r1', type: 'resistor', ohms: 220, from: '5c', to: '9c' },
    { id: 'led1', type: 'led', color: 'red', pin: 'D13', anode: '9e', cathode: '10e' },
    { id: 'btn1', type: 'button', at: '12e', showWhen: { param: 'pull', value: 'down' } }
  ],
  wires: [
    { id: 'w1', color: 'yellow', from: 'D13', to: '5a' },
    { id: 'w2', color: 'black', from: 'GND', to: '10a' }
  ]
}

describe('kitFor', () => {
  it('takes every reference part in order, with meta but no positions', () => {
    const kit = kitFor({ id: 'x' }, reference)
    expect(kit.parts).toEqual([
      { id: 'r1', type: 'resistor', meta: { ohms: 220 } },
      { id: 'led1', type: 'led', meta: { color: 'red', pin: 'D13' } },
      { id: 'btn1', type: 'button', meta: { showWhen: { param: 'pull', value: 'down' } } }
    ])
  })

  it('keeps ohmsParam and pins as meta', () => {
    const kit = kitFor({ id: '1.8' }, circuits['1.8'])
    expect(kit.parts[0].meta.pins).toEqual({ red: 'D9', green: 'D10', blue: 'D11' })
    const ohms = kitFor({ id: '1.3' }, circuits['1.3'])
    expect(ohms.parts.find((part) => part.id === 'led1').meta).toEqual({ color: 'red', pin: 'D9', ohmsParam: 'ohms' })
  })

  it('gives the reference wire count plus 2 wires', () => {
    expect(kitFor({ id: 'x' }, reference).wires).toBe(4)
    expect(kitFor({ id: 'P1' }, circuits.P1).wires).toBe(12)
  })

  it('prebuilds every reference part and wire by default', () => {
    expect(kitFor({ id: 'x' }, reference).prebuilt).toEqual({ parts: ['r1', 'led1', 'btn1'], wires: ['w1', 'w2'] })
  })

  it('uses lesson.kit when given', () => {
    const lesson = { id: 'x', kit: { parts: [{ id: 'led1', type: 'led', color: 'green', pin: 'D9' }], wires: 3 } }
    const kit = kitFor(lesson, reference)
    expect(kit.parts).toEqual([{ id: 'led1', type: 'led', meta: { color: 'green', pin: 'D9' } }])
    expect(kit.wires).toBe(3)
    expect(kit.prebuilt).toEqual({ parts: ['led1'], wires: ['w1', 'w2'] })
  })

  it('splits lesson.prebuilt into part and wire ids, dropping unknown ids', () => {
    const kit = kitFor({ id: 'x', prebuilt: ['led1', 'w2', 'nope'] }, reference)
    expect(kit.prebuilt).toEqual({ parts: ['led1'], wires: ['w2'] })
    expect(kitFor({ id: 'x', prebuilt: [] }, reference).prebuilt).toEqual({ parts: [], wires: [] })
  })

  it('ignores lesson.prebuilt when prebuilt lists are off', () => {
    const kit = kitFor({ id: 'x', prebuilt: [] }, reference, { prebuiltLists: false })
    expect(kit.prebuilt).toEqual({ parts: ['r1', 'led1', 'btn1'], wires: ['w1', 'w2'] })
  })

  it('gives an empty kit with 2 wires for no reference', () => {
    expect(kitFor({ id: '1.1' }, null)).toEqual({ parts: [], wires: 2, prebuilt: { parts: [], wires: [] } })
  })
})
