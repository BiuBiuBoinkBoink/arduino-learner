// Explain tools through fake deps: argument checks, reasons and the texts.
import { describe, it, expect } from 'vitest'
import { createExplainTools, wiredPins, XRAY_ON, XRAY_OFF, NO_CIRCUIT, WIRE_FIRST, RUN_FIRST } from '../src/explain/tools.js'
import { circuits } from '../src/circuits/circuits.js'

const withPart = (circuit, id, change) => ({ ...circuit, parts: circuit.parts.map((part) => (part.id === id ? { ...part, ...change } : part)) })

function setup(overrides = {}) {
  const calls = []
  let build = overrides.build || circuits['1.2']
  const deps = {
    setXray: (on) => calls.push(['xray', on]),
    getBuild: () => build,
    hasReference: () => true,
    getPressed: () => ({}),
    showTrace: (path) => calls.push(['trace', path]),
    isRunning: () => true,
    openScope: (pin, seconds) => {
      calls.push(['scope', pin, seconds])
      return `${pin} stays LOW.`
    },
    ...overrides
  }
  return { tools: createExplainTools(deps), calls, setBuild: (next) => { build = next } }
}

describe('explain tools', () => {
  it('x-ray turns on and off with its texts', async () => {
    const { tools, calls } = setup()
    expect(await tools.xray(true)).toEqual({ ok: true, text: XRAY_ON })
    expect(await tools.xray(false)).toEqual({ ok: true, text: XRAY_OFF })
    expect(calls).toEqual([['xray', true], ['xray', false]])
    expect(XRAY_ON).toBe('The breadboard is see-through. Each metal bar joins the holes above it.')
    expect(tools.reasons().xray).toBe(null)
  })

  it('traces the current with the phase texts', async () => {
    const { tools, calls, setBuild } = setup()
    expect(await tools.trace('D13')).toEqual({ ok: true, text: 'Current flows from D13 through the resistor, then the LED, to GND.' })
    expect(calls[0][0]).toBe('trace')
    setBuild(withPart(circuits['1.2'], 'led1', { anode: '10e', cathode: '9e' }))
    expect((await tools.trace('D13')).text).toBe('Current reaches the LED but cannot get through: the LED is in backwards.')
    setBuild(withPart(circuits['1.2'], 'r1', { to: '8c' }))
    expect((await tools.trace('D13')).text).toBe('The current stops at strip 8 (rows a to e). Nothing there leads on to GND.')
    expect((await tools.trace('D7')).text).toBe('Nothing is wired to D7 yet.')
  })

  it('checks the trace pin and says so plainly without a lesson circuit', async () => {
    const { tools } = setup()
    expect(await tools.trace('X9')).toEqual({ ok: false, text: 'There is no pin called X9 to trace from.' })
    expect((await tools.trace('GND')).ok).toBe(false)
    const none = setup({ hasReference: () => false })
    expect(await none.tools.trace('D13')).toEqual({ ok: false, text: NO_CIRCUIT })
    expect(none.tools.reasons().trace).toBe(NO_CIRCUIT)
    const empty = setup({ build: { parts: [], wires: [] } })
    expect(empty.tools.reasons().trace).toBe(WIRE_FIRST)
  })

  it('opens the scope on a running sketch and checks its arguments', async () => {
    const { tools, calls } = setup()
    expect(await tools.scope('D13', 3)).toEqual({ ok: true, text: 'D13 stays LOW.' })
    expect(calls.at(-1)).toEqual(['scope', 'D13', 3])
    expect((await tools.scope('D13')).ok).toBe(true)
    expect(calls.at(-1)).toEqual(['scope', 'D13', 5])
    expect((await tools.scope('5V', 3)).ok).toBe(false)
    expect(await tools.scope('D13', 9)).toEqual({ ok: false, text: 'Pick 1 to 5 seconds for the scope.' })
    expect(tools.reasons().scope).toBe(null)
    const stopped = setup({ isRunning: () => false })
    expect(await stopped.tools.scope('D13', 3)).toEqual({ ok: false, text: RUN_FIRST })
    expect(stopped.tools.reasons().scope).toBe('Run the sketch first.')
  })

  it('lists the wired pins without GND', () => {
    expect(wiredPins(circuits['1.4'])).toEqual(['D13', 'D2'])
  })
})
