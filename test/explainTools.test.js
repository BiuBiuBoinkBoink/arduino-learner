// Explain tools through fake deps: argument checks, reasons and the texts.
import { describe, it, expect } from 'vitest'
import { createExplainTools, wiredPins, XRAY_ON, XRAY_OFF, NO_CIRCUIT, WIRE_FIRST, RUN_FIRST } from '../src/explain/tools.js'
import { circuits } from '../src/circuits/circuits.js'

const withPart = (circuit, id, change) => ({ ...circuit, parts: circuit.parts.map((part) => (part.id === id ? { ...part, ...change } : part)) })

function setup(overrides = {}) {
  const calls = []
  let build = overrides.build || circuits['1.2']
  let levels = { pinLevels: { D13: 1 }, inputLevels: {} }
  const deps = {
    setXray: (on) => calls.push(['xray', on]),
    getBuild: () => build,
    getReference: () => circuits['1.2'],
    getPressed: () => ({}),
    showTrace: (path) => calls.push(['trace', path]),
    isRunning: () => true,
    openScope: (pin, seconds) => {
      calls.push(['scope', pin, seconds])
      return `${pin} stays LOW.`
    },
    showConnections: (rows) => calls.push(['connections', rows]),
    getKit: () => [{ id: 'r1', type: 'resistor', label: 'resistor' }, { id: 'led1', type: 'led', label: 'LED' }],
    openPartCard: (type) => calls.push(['part', type]),
    hasCircuit: () => true,
    getLevels: () => levels,
    showMeasure: (label) => calls.push(['measure', label]),
    setSlowMotion: (speed) => {
      calls.push(['slow', speed])
      return true
    },
    getSlowMotion: () => null,
    runWhatIfCode: () => ({ pin: 'D13', before: { changed: true, summary: { pwm: false, transitions: 4, periodMs: 1000, level: 0 }, text: 'a', samples: [] }, after: { changed: true, summary: { pwm: false, transitions: 6, periodMs: 700, level: 0 }, text: 'b', samples: [] }, error: null }),
    showWhatIf: (view) => calls.push(['whatif', view]),
    ...overrides
  }
  return { tools: createExplainTools(deps), calls, setBuild: (next) => { build = next }, setLevels: (next) => { levels = next } }
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
    const none = setup({ getReference: () => null })
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

  it('lists the connections with or without the lesson circuit', async () => {
    const { tools, calls, setBuild } = setup()
    expect(await tools.connections(true)).toEqual({ ok: true, text: '3 connections. 3 match the lesson circuit.' })
    setBuild(withPart(circuits['1.2'], 'r1', { to: '8c' }))
    expect((await tools.connections()).text).toBe('4 connections. 2 match the lesson circuit.')
    expect(await tools.connections(false)).toEqual({ ok: true, text: '4 connections.' })
    expect(calls.at(-1)[1].every((row) => row.match === null)).toBe(true)
    const none = setup({ getReference: () => null })
    expect(await none.tools.connections()).toEqual({ ok: false, text: NO_CIRCUIT })
  })

  it('opens a part card from a kit id or a type, with the summary', async () => {
    const { tools, calls } = setup()
    expect(await tools.part_card('led1')).toEqual({ ok: true, text: 'A light that lets current through one way only.' })
    expect(calls.at(-1)).toEqual(['part', 'led'])
    expect((await tools.part_card('servo')).text).toBe('A motor that turns its arm to an angle from 0 to 180 deg and holds it.')
    expect(await tools.part_card('flux')).toEqual({ ok: false, text: 'There is no part called flux.' })
    expect(tools.reasons().part).toBe(null)
    expect(setup({ getKit: () => [] }).tools.reasons().part).toBe('This lesson has no parts.')
  })

  it('measures a hole, a pin or a leg with the phase texts', async () => {
    const { tools, calls, setLevels } = setup()
    expect(await tools.measure('9e')).toEqual({ ok: true, text: '9e reads 2.0 V.' })
    expect(calls.at(-1)).toEqual(['measure', { at: '9e', text: '9e: 2.0 V' }])
    expect((await tools.measure('D13')).text).toBe('D13 reads 5.0 V.')
    expect(await tools.measure('led1.anode')).toEqual({ ok: true, text: 'Long leg of the LED reads 2.0 V.' })
    expect(calls.at(-1)).toEqual(['measure', { at: '9e', text: 'long leg of the LED: 2.0 V' }])
    expect((await tools.measure('5V')).text).toBe('5V reads 5.0 V.')
    expect(await tools.measure('20a')).toEqual({ ok: true, text: '20a has no fixed voltage right now.' })
    expect(calls.at(-1)).toEqual(['measure', { at: '20a', text: '20a: not set' }])
    setLevels({ pinLevels: { D13: 0 }, inputLevels: {} })
    expect((await tools.measure('9e')).text).toBe('9e reads 0.0 V.')
    expect(await tools.measure('led1.leg')).toEqual({ ok: false, text: 'There is no hole, pin or leg called led1.leg.' })
    expect((await setup({ hasCircuit: () => false }).tools.measure('9e')).ok).toBe(false)
  })

  it('slows a running sketch to 0.1 or 0.25 and turns it off with 1', async () => {
    const { tools, calls } = setup()
    expect(await tools.slow_motion(0.1)).toEqual({ ok: true, text: 'The sketch now runs at a tenth of its speed, with the running line lit up. Goals are paused.' })
    expect(calls.at(-1)).toEqual(['slow', 0.1])
    expect((await tools.slow_motion(0.25)).text).toBe('The sketch now runs at a quarter of its speed, with the running line lit up. Goals are paused.')
    expect(await tools.slow_motion(1)).toEqual({ ok: true, text: 'Slow motion is off. Goals stay paused until you press Run again.' })
    expect(calls.at(-1)).toEqual(['slow', null])
    expect((await tools.slow_motion(0.5)).ok).toBe(false)
    const stopped = setup({ isRunning: () => false })
    expect(await stopped.tools.slow_motion(0.1)).toEqual({ ok: false, text: RUN_FIRST })
    expect(stopped.tools.reasons().slow).toBe(RUN_FIRST)
  })

  it('compares a pretend change with the phase texts and never touches the build', async () => {
    const { tools, calls } = setup()
    expect(await tools.what_if('flip', 'led1')).toEqual({ ok: true, text: 'Now: the LED lights. With the change: the LED stays dark, because the current cannot get through it backwards.' })
    expect(calls.at(-1)[1]).toMatchObject({ kind: 'flip', title: 'Flip the LED', changed: { id: 'led1', legs: ['10e', '9e'] } })
    expect((await tools.what_if('ohms', 'r1', '10000')).text).toBe('Now: the LED lights. With the change: the LED lights very dimly.')
    expect(calls.at(-1)[1].title).toBe('Use 10 kohm')
    expect((await tools.what_if('remove', 'r1')).text).toBe('Now: the LED lights. With the change: the LED stays dark, because the current has no way through it to GND.')
    expect(await tools.what_if('code', '10', '  delay(200);')).toEqual({ ok: true, text: 'Now: one cycle every 1000 ms. With line 10 changed: one cycle every 700 ms.' })
    expect((await tools.what_if('flip', 'r1')).ok).toBe(false)
    expect(circuits['1.2'].parts[1].anode).toBe('9e')
    expect(tools.whatIfChoices().map((choice) => choice.label)).toEqual(['Flip the LED', 'Use 1 kohm', 'Use 10 kohm', 'Take out the resistor', 'Take out the LED'])
    expect(tools.reasons().whatif).toBe(null)
    expect(setup({ getReference: () => null }).tools.reasons().whatif).toBe(NO_CIRCUIT)
  })

  it('lists the wired pins without GND', () => {
    expect(wiredPins(circuits['1.4'])).toEqual(['D13', 'D2'])
  })
})
