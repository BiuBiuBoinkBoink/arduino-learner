import { describe, it, expect } from 'vitest'
import { createTutorTools, checkInput, plainText, SHOW_ME_FIRST, HINT_FIRST, WAIT_FOR_ANSWER } from '../src/tutor/tools.js'
import { lessons } from '../src/course/lessons.js'
import { stepsFor } from '../src/course/steps.js'

const NO_CIRCUIT = 'This lesson has no circuit to explain.'

function stubs(overrides = {}) {
  const calls = []
  const timers = []
  const log = (name) => (...args) => {
    calls.push([name, ...args])
  }
  let step = { lesson: lessons[1], step: { id: 'add-resistor', kind: 'build' }, hintLevel: 0, passed: false, scope: ['r1', 'led1'], canSuggest: true }
  const inputs = { btn1: false, pot1: 0.5, 'room-light': 0.8 }
  const explainTool = (name, text = name + ' done', okFlag = true) => async (...args) => {
    calls.push([name, ...args])
    return { ok: okFlag, text }
  }
  const deps = {
    explain: {
      xray: explainTool('xray', 'The breadboard is see-through. Each metal bar joins the holes above it.'),
      trace: explainTool('trace', NO_CIRCUIT, false),
      connections: explainTool('connections'),
      part_card: explainTool('part_card'),
      scope: explainTool('scope'),
      measure: explainTool('measure'),
      what_if: explainTool('what_if'),
      slow_motion: explainTool('slow_motion')
    },
    getBuild: () => ({ parts: [{ id: 'r1', type: 'resistor', ohms: 220, legs: ['5c', '9c'] }, { id: 'led1', type: 'led', legs: [] }], wires: [] }),
    getStep: () => step,
    lessons,
    stepsFor,
    raiseHint: log('raiseHint'),
    showPlacement: log('showPlacement'),
    highlight: log('highlight'),
    pinLabel: log('pinLabel'),
    moveCamera: log('moveCamera'),
    codeLineCount: () => 12,
    pointToCode: log('pointToCode'),
    offerLine: log('offerLine'),
    isRunning: () => false,
    beginDemo: log('beginDemo'),
    inputTargets: () => ({ buttons: ['btn1'], knobs: ['pot1'], light: true, temp: false }),
    getInput: (name) => inputs[name],
    setInput: (name, value) => {
      calls.push(['setInput', name, value])
      inputs[name] = value
    },
    openReference: log('openReference'),
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    ...overrides
  }
  return { tools: createTutorTools(deps), calls, timers, setStep: (next) => { step = { ...step, ...next } } }
}

describe('checkInput', () => {
  it('names what is wrong in one sentence', () => {
    expect(checkInput('nope', {})).toBe('There is no tool called nope.')
    expect(checkInput('xray', null)).toBe('The input for xray must be an object.')
    expect(checkInput('xray', {})).toBe('xray needs on.')
    expect(checkInput('xray', { on: 'yes' })).toBe('xray needs on as true or false.')
    expect(checkInput('xray', { on: true, colour: 'red' })).toBe('xray has no input called colour.')
    expect(checkInput('move_camera', { target: 'uno', view: 'side' })).toBe('move_camera needs view to be one of top, 3d.')
    expect(checkInput('scope', { pin: 'D13', seconds: 2.5 })).toBe('scope needs seconds as a whole number.')
    expect(checkInput('quick_check', { question: 'q', options: [1, 2], answer: 0, why: 'w' })).toBe('quick_check needs options as a list of texts.')
    expect(checkInput('next_hint', {})).toBe(null)
  })
})

describe('plainText', () => {
  it('keeps printable ASCII and cuts to length', () => {
    expect(plainText('  Long leg \u2192 here \u{1F600}  ', 40)).toBe('Long leg here')
    expect(plainText('x'.repeat(50), 40)).toHaveLength(40)
  })
})

describe('createTutorTools', () => {
  it('returns an error result for a bad input, without running anything', async () => {
    const { tools, calls } = stubs()
    expect(await tools.run('xray', { on: 1 })).toEqual({ content: 'xray needs on as true or false.', isError: true })
    expect(await tools.run('highlight', { target: 'zz' })).toMatchObject({ isError: true })
    expect(calls).toEqual([])
  })

  it('passes the explain text back, and a reason as a normal result', async () => {
    const { tools, calls } = stubs()
    expect(await tools.run('xray', { on: true })).toEqual({ content: 'The breadboard is see-through. Each metal bar joins the holes above it.', isError: false, chip: 'X-ray' })
    expect(await tools.run('trace_current', { from: 'D13' })).toEqual({ content: NO_CIRCUIT, isError: false })
    await tools.run('slow_motion', { speed: '0.25' })
    await tools.run('what_if', { kind: 'code', target: '7', value: 'delay(200);' })
    await tools.run('scope', { pin: 'D13', seconds: 3 })
    expect(calls).toContainEqual(['slow_motion', 0.25])
    expect(calls).toContainEqual(['what_if', 'code', '7', 'delay(200);'])
    expect(calls).toContainEqual(['scope', 'D13', 3])
  })

  it('turns a thrown error into an error result', async () => {
    const { tools } = stubs({ highlight: () => { throw new Error('boom') } })
    expect(await tools.run('highlight', { target: '9e' })).toEqual({ content: 'highlight did not work right now.', isError: true })
  })

  it('highlights holes as their strip, strips, rails, pins and placed parts', async () => {
    const { tools, calls } = stubs()
    expect((await tools.run('highlight', { target: '9e' })).content).toBe('Lit up strip 9 (rows a to e), which holds 9e, for 4 seconds.')
    await tools.run('highlight', { target: '9-top' })
    await tools.run('highlight', { target: 'rail-T+' })
    await tools.run('highlight', { target: 'D13' })
    await tools.run('highlight', { target: 'r1' })
    expect(calls).toEqual([
      ['highlight', { kind: 'place', value: 'strip:9-top' }],
      ['highlight', { kind: 'place', value: 'strip:9-top' }],
      ['highlight', { kind: 'place', value: 'rail:T+' }],
      ['highlight', { kind: 'pin', value: 'D13' }],
      ['highlight', { kind: 'part', value: 'r1' }]
    ])
    // An unplaced part, a strip off the board and a pin the Uno does not have.
    for (const target of ['led1', '31-top', 'D20']) expect((await tools.run('highlight', { target })).isError).toBe(true)
  })

  it('pins ASCII labels of 40 characters at most', async () => {
    const { tools, calls } = stubs()
    const result = await tools.run('pin_label', { target: '9e', text: 'Long leg here \u2192 ' + 'x'.repeat(40) })
    expect(result.isError).toBe(false)
    const text = calls[0][1].text
    expect(text).toHaveLength(40)
    expect(/^[\x20-\x7e]+$/.test(text)).toBe(true)
    expect((await tools.run('pin_label', { target: '9e', text: '\u2192' })).isError).toBe(true)
    expect((await tools.run('pin_label', { target: '9-top', text: 'x' })).isError).toBe(true)
  })

  it('moves the camera to boards, holes, pins and parts', async () => {
    const { tools, calls } = stubs()
    await tools.run('move_camera', { target: 'uno', view: 'top' })
    await tools.run('move_camera', { target: 'r1', view: '3d' })
    expect(calls).toEqual([['moveCamera', { kind: 'board', value: 'uno', view: 'top' }], ['moveCamera', { kind: 'part', value: 'r1', view: '3d' }]])
  })

  it('points to lines that exist', async () => {
    const { tools, calls } = stubs()
    expect((await tools.run('point_to_code', { line: 13, note: 'x' })).content).toBe('The sketch has lines 1 to 12.')
    expect((await tools.run('point_to_code', { line: 4, note: 'The pin goes HIGH here' })).isError).toBe(false)
    expect(calls).toEqual([['pointToCode', 4, 'The pin goes HIGH here']])
    const none = stubs({ codeLineCount: () => 0 })
    expect((await none.tools.run('point_to_code', { line: 1, note: '' })).isError).toBe(true)
  })

  describe('show_placement', () => {
    it('is refused before any hint', async () => {
      const { tools, calls } = stubs()
      expect(await tools.run('show_placement', { part: 'r1' })).toEqual({ content: SHOW_ME_FIRST, isError: true })
      expect(calls).toEqual([])
    })

    it('works after a hint, for a part of the step, raising the level to 2', async () => {
      const { tools, calls, setStep } = stubs()
      setStep({ hintLevel: 1 })
      expect((await tools.run('show_placement', { part: 'servo1' })).isError).toBe(true)
      const result = await tools.run('show_placement', { part: 'r1' })
      expect(result.isError).toBe(false)
      expect(calls).toEqual([['raiseHint', 2], ['showPlacement']])
    })

    it('is refused in the same learner turn that next_hint raised the hint in', async () => {
      const { tools, calls, setStep } = stubs()
      expect((await tools.run('next_hint', {}, { turn: 1 })).isError).toBe(false)
      setStep({ hintLevel: 1 })
      expect(await tools.run('show_placement', { part: 'r1' }, { turn: 1 })).toEqual({ content: HINT_FIRST, isError: true })
      expect((await tools.run('show_placement', { part: 'r1' }, { turn: 2 })).isError).toBe(false)
      expect(calls).toEqual([['raiseHint', 1], ['raiseHint', 2], ['showPlacement']])
    })

    it('works in the same turn when the learner raised the hint', async () => {
      const { tools, setStep } = stubs()
      setStep({ hintLevel: 1 })
      expect((await tools.run('show_placement', { part: 'r1' }, { turn: 1 })).isError).toBe(false)
    })

    it('only works on build and wire steps that have not passed', async () => {
      const { tools, setStep } = stubs()
      setStep({ hintLevel: 1, step: { id: 'blink', kind: 'run' } })
      expect((await tools.run('show_placement', { part: 'r1' })).content).toBe('Show placement only works on build and wire steps.')
      setStep({ step: { id: 'wire', kind: 'wire' }, passed: true })
      expect((await tools.run('show_placement', { part: 'r1' })).content).toBe('This step has passed already.')
      setStep({ passed: false, canSuggest: false })
      expect((await tools.run('show_placement', { part: 'r1' })).isError).toBe(true)
    })
  })

  describe('suggest_code', () => {
    it('only offers one Serial.print or Serial.println line after a line that exists', async () => {
      const { tools, calls } = stubs()
      expect((await tools.run('suggest_code', { line: 3, text: 'digitalWrite(13, HIGH);', why: 'x' })).isError).toBe(true)
      expect((await tools.run('suggest_code', { line: 3, text: 'Serial.println(x); delay(9);', why: 'x' })).isError).toBe(false)
      expect((await tools.run('suggest_code', { line: 3, text: 'Serial.write(x);', why: 'x' })).isError).toBe(true)
      expect((await tools.run('suggest_code', { line: 30, text: 'Serial.println(x);', why: 'x' })).content).toBe('The sketch has lines 1 to 12.')
      const result = await tools.run('suggest_code', { line: 8, text: '  Serial.print(level);  ', why: 'Shows the level.' })
      expect(result).toEqual({ content: 'Offered the line. The learner can add it.', isError: false, chip: 'Suggested a line' })
      expect(calls.at(-1)).toEqual(['offerLine', 8, 'Serial.print(level);', 'Shows the level.'])
    })
  })

  describe('demo_input', () => {
    it('needs a running sketch', async () => {
      const { tools, calls } = stubs()
      expect(await tools.run('demo_input', { target: 'btn1', value: 1, seconds: 2 })).toEqual({ content: 'Run the sketch first.', isError: true })
      expect(calls).toEqual([])
    })

    it('marks the run as a demo, sets the input and puts it back', async () => {
      const { tools, calls, timers } = stubs({ isRunning: () => true })
      const result = await tools.run('demo_input', { target: 'btn1', value: 1, seconds: 2 })
      expect(result.content).toBe('Pressed btn1 for 2 seconds. Goals are paused until the learner presses Run again.')
      expect(calls).toEqual([['beginDemo'], ['setInput', 'btn1', true]])
      expect(timers[0].ms).toBe(2000)
      timers[0].fn()
      expect(calls.at(-1)).toEqual(['setInput', 'btn1', false])
      await tools.run('demo_input', { target: 'pot1', value: 0.9, seconds: 1 })
      expect(calls.at(-1)).toEqual(['setInput', 'pot1', 0.9])
    })

    it('checks the target, value and seconds', async () => {
      const { tools } = stubs({ isRunning: () => true })
      expect((await tools.run('demo_input', { target: 'btn1', value: 1, seconds: 6 })).isError).toBe(true)
      expect((await tools.run('demo_input', { target: 'btn1', value: 0, seconds: 1 })).isError).toBe(true)
      expect((await tools.run('demo_input', { target: 'pot1', value: 2, seconds: 1 })).isError).toBe(true)
      expect((await tools.run('demo_input', { target: 'room-temp', value: 30, seconds: 1 })).isError).toBe(true)
      expect((await tools.run('demo_input', { target: 'room-light', value: 0.1, seconds: 1 })).isError).toBe(false)
    })
  })

  describe('quick_check and predict', () => {
    it('take 2 to 4 options and an answer in range', async () => {
      const { tools } = stubs()
      const ask = (options, answer = 0) => tools.run('quick_check', { question: 'Which leg is long?', options, answer, why: 'The anode is longer.' })
      expect((await ask(['Anode'])).isError).toBe(true)
      expect((await ask(['a', 'b', 'c', 'd', 'e'])).isError).toBe(true)
      expect((await ask(['Anode', 'Cathode'], 2)).isError).toBe(true)
      expect((await ask(['Anode', ''])).isError).toBe(true)
      const result = await ask(['Anode', 'Cathode'], 0)
      expect(result).toEqual({
        content: WAIT_FOR_ANSWER,
        isError: false,
        chip: 'Quick check',
        card: { kind: 'quiz', question: 'Which leg is long?', options: ['Anode', 'Cathode'], answer: 0, why: 'The anode is longer.' }
      })
      const guess = await tools.run('predict', { question: 'What will the LED do?', options: ['Blink', 'Stay on', 'Stay off'] })
      expect(guess.card).toEqual({ kind: 'guess', question: 'What will the LED do?', options: ['Blink', 'Stay on', 'Stay off'] })
      expect((await tools.run('predict', { question: 'q', options: ['one'] })).isError).toBe(true)
    })
  })

  it('recalls a step that exists', async () => {
    const { tools } = stubs()
    const lesson = lessons.find((item) => item.id === '1.2')
    const step = stepsFor(lesson)[0]
    const result = await tools.run('recall', { lesson: '1.2', step: step.id })
    expect(result.card).toEqual({ kind: 'recall', title: `1.2 Blink: ${step.title}`, body: step.body })
    expect((await tools.run('recall', { lesson: '9.9', step: step.id })).isError).toBe(true)
    expect((await tools.run('recall', { lesson: '1.2', step: 'nope' })).isError).toBe(true)
  })

  it('opens a reference tab', async () => {
    const { tools, calls } = stubs()
    expect((await tools.run('open_reference', { tab: 'pinout' })).content).toBe('The Pinout tab of the lesson reference is open.')
    expect(calls).toEqual([['openReference', 'pinout']])
  })

  it('raises the hint one level at a time, never past Show me', async () => {
    const { tools, calls, setStep } = stubs()
    await tools.run('next_hint', {})
    setStep({ hintLevel: 1 })
    await tools.run('next_hint', {})
    setStep({ hintLevel: 2 })
    expect((await tools.run('next_hint', {})).isError).toBe(true)
    setStep({ hintLevel: 0, passed: true })
    expect((await tools.run('next_hint', {})).isError).toBe(true)
    expect(calls).toEqual([['raiseHint', 1], ['raiseHint', 2]])
  })
})
