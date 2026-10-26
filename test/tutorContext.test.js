import { describe, it, expect } from 'vitest'
import { buildState, formatState, numberedCode, MAX_CODE_LINES } from '../src/tutor/context.js'
import { describeNets } from '../src/explain/connections.js'
import { lessons } from '../src/course/lessons.js'
import { circuits } from '../src/circuits/circuits.js'

const lesson = lessons.find((item) => item.id === '1.2')
const step = lesson.steps.find((item) => item.kind === 'build')
const build = {
  parts: [
    { id: 'r1', type: 'resistor', ohms: 220, legs: ['5c', '9c'] },
    { id: 'led1', type: 'led', color: 'red', legs: [] }
  ],
  wires: [{ id: 'u1', from: 'D13', to: '5a', color: 'yellow' }]
}

describe('buildState', () => {
  it('describes the lesson, the step, the hints and the mistake', () => {
    const view = {
      passed: false,
      result: { passed: false, items: [{ text: 'Place the resistor', ok: true }, { text: 'Place the LED', ok: false }], feedback: { tone: 'bad', text: 'The LED is in backwards.' } }
    }
    const state = buildState({ lesson, step, view, hintLevel: 1 })
    expect(state.lesson).toEqual({ id: '1.2', title: 'Blink', project: false })
    expect(state.step).toMatchObject({ id: step.id, kind: 'build', title: step.title, passed: false })
    expect(state.step.text).toBe(step.body.join('\n'))
    expect(state.step.checklist).toEqual([{ text: 'Place the resistor', ok: true }, { text: 'Place the LED', ok: false }])
    expect(state.hints).toEqual({ level: 1, exact_positions_allowed: false })
    expect(state.mistake).toBe('The LED is in backwards.')
  })

  it('allows exact positions from Show me on', () => {
    expect(buildState({ lesson, step, hintLevel: 2 }).hints).toEqual({ level: 2, exact_positions_allowed: true })
    expect(buildState({ lesson, step, hintLevel: 3 }).hints.exact_positions_allowed).toBe(true)
  })

  it('only counts bad feedback as a mistake', () => {
    const view = { passed: false, result: { items: [], feedback: { tone: 'info', text: 'Now press Run and watch.' } } }
    expect(buildState({ lesson, step, view }).mistake).toBe(null)
  })

  it('lists the parts with labels and legs, the wires and the connections', () => {
    const connections = describeNets(build, circuits['1.2'])
    const state = buildState({ lesson, step, build, connections })
    expect(state.circuit.parts).toEqual([
      { id: 'r1', label: 'resistor', legs: ['5c', '9c'] },
      { id: 'led1', label: 'LED', legs: [] }
    ])
    expect(state.circuit.wires).toEqual([{ from: 'D13', to: '5a' }])
    expect(state.circuit.connections).toEqual(connections.map((row) => row.things))
    expect(state.circuit.connections.flat()).toContain('D13')
  })

  it('has no circuit and no code when the lesson has none', () => {
    const state = buildState({ lesson, step })
    expect(state.circuit).toBe(null)
    expect(state.code).toBe(null)
    expect(state.code_error).toBe(null)
    expect(state.run).toEqual({ phase: 'idle', readout: '', progress: {} })
  })

  it('numbers the code and keeps the error and the run', () => {
    const state = buildState({
      lesson,
      step,
      code: 'void setup() {\n}\n',
      codeError: { line: 2, message: 'Line 2: expected ;', extra: true },
      run: { phase: 'running', readout: 'D13 blinks', progress: { ran: true, blinked: false } }
    })
    expect(state.code).toBe('1: void setup() {\n2: }\n3: ')
    expect(state.code_error).toEqual({ line: 2, message: 'Line 2: expected ;' })
    expect(state.run).toEqual({ phase: 'running', readout: 'D13 blinks', progress: { ran: true, blinked: false } })
  })

  it('keeps its keys in a fixed order', () => {
    expect(Object.keys(buildState({ lesson, step }))).toEqual(['lesson', 'step', 'hints', 'mistake', 'circuit', 'code', 'code_error', 'run'])
  })
})

describe('numberedCode', () => {
  it('cuts long sketches to 150 lines', () => {
    const source = Array.from({ length: 160 }, (_, i) => `// ${i}`).join('\n')
    const lines = numberedCode(source).split('\n')
    expect(lines).toHaveLength(MAX_CODE_LINES + 1)
    expect(lines[149]).toBe('150: // 149')
    expect(lines[150]).toBe('(10 more lines)')
  })
})

describe('formatState', () => {
  it('wraps the JSON in the workbench_state tags', () => {
    const state = buildState({ lesson, step })
    const text = formatState(state)
    expect(text.startsWith('<workbench_state>\n{')).toBe(true)
    expect(text.endsWith('}\n</workbench_state>')).toBe(true)
    expect(JSON.parse(text.split('\n')[1])).toEqual(state)
  })
})
