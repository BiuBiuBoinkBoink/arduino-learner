// Explain tools through fake deps: argument checks, reasons and the texts.
import { describe, it, expect } from 'vitest'
import { createExplainTools, XRAY_ON, XRAY_OFF } from '../src/explain/tools.js'

function setup(overrides = {}) {
  const calls = []
  const deps = {
    setXray: (on) => calls.push(['xray', on]),
    ...overrides
  }
  return { tools: createExplainTools(deps), calls }
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
})
