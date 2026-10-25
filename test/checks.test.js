import { describe, it, expect } from 'vitest'
import { evaluate, simKeys, CHECK_TYPES } from '../src/course/checks.js'
import { circuits } from '../src/circuits/circuits.js'
import { lessons } from '../src/course/lessons.js'

function ctx(overrides = {}) {
  return {
    lessonId: '1.2',
    lessonCompleted: false,
    answers: {},
    latched: [],
    sim: { phase: 'idle', progress: {} },
    code: { error: null },
    tour: { complete: false },
    ...overrides
  }
}

const quiz = {
  id: 'legs',
  check: {
    type: 'quiz',
    question: 'Which leg?',
    options: ['Long', 'Short', 'Either'],
    answer: 1,
    explain: ['Wrong long.', 'Right short.', 'Wrong either.']
  }
}

const predict = {
  id: 'guess',
  check: {
    type: 'predict',
    question: 'What will it do?',
    options: ['Stay on', 'Blink', 'Flicker'],
    answer: 1,
    explain: ['It blinks, not on.', 'Right, it blinks.', 'It blinks, not flickers.'],
    then: { type: 'sim', progress: 'blinked', text: 'Watch a blink' }
  }
}

const codeStep = {
  id: 'faster',
  check: {
    type: 'all',
    checks: [
      { type: 'code', rule: 'compiles', text: 'The sketch compiles' },
      { type: 'sim', goal: true, text: 'Blink under 500 ms' }
    ]
  }
}

describe('evaluate', () => {
  it('knows its check types', () => {
    expect(CHECK_TYPES).toEqual(['legacy', 'quiz', 'predict', 'sim', 'code', 'tour', 'event', 'circuit', 'all'])
  })

  it('legacy passes when the lesson is completed', () => {
    const step = { id: 'goal', check: { type: 'legacy' } }
    expect(evaluate(step, ctx())).toEqual({ passed: false, items: [{ text: 'Meet the goal', ok: false }], feedback: null })
    expect(evaluate(step, ctx({ lessonCompleted: true }))).toEqual({ passed: true, items: [{ text: 'Meet the goal', ok: true }], feedback: null })
  })

  it('quiz has no feedback before an answer', () => {
    expect(evaluate(quiz, ctx())).toEqual({ passed: false, items: [{ text: 'Answer the question', ok: false }], feedback: null })
  })

  it('quiz explains a wrong answer and a right one', () => {
    expect(evaluate(quiz, ctx({ answers: { legs: 0 } }))).toEqual({
      passed: false,
      items: [{ text: 'Answer the question', ok: false }],
      feedback: { tone: 'bad', text: 'Wrong long.' }
    })
    expect(evaluate(quiz, ctx({ answers: { legs: 1 } }))).toEqual({
      passed: true,
      items: [{ text: 'Answer the question', ok: true }],
      feedback: { tone: 'good', text: 'Right short.' }
    })
  })

  it('predict waits for a guess, then for its sim check', () => {
    expect(evaluate(predict, ctx())).toEqual({
      passed: false,
      items: [{ text: 'Make a guess', ok: false }, { text: 'Watch a blink', ok: false }],
      feedback: null
    })
    expect(evaluate(predict, ctx({ answers: { guess: 0 } }))).toEqual({
      passed: false,
      items: [{ text: 'Make a guess', ok: true }, { text: 'Watch a blink', ok: false }],
      feedback: { tone: 'info', text: 'Now press Run and watch.' }
    })
  })

  it('predict explains the result after its sim check, by the guess', () => {
    const blinked = { sim: { phase: 'running', progress: { blinked: true } } }
    expect(evaluate(predict, ctx({ answers: { guess: 1 }, ...blinked }))).toEqual({
      passed: true,
      items: [{ text: 'Make a guess', ok: true }, { text: 'Watch a blink', ok: true }],
      feedback: { tone: 'good', text: 'Right, it blinks.' }
    })
    expect(evaluate(predict, ctx({ answers: { guess: 2 }, ...blinked })).feedback).toEqual({ tone: 'info', text: 'It blinks, not flickers.' })
  })

  it('sim items pass on progress now or on a latched key', () => {
    const step = { id: 's', check: { type: 'sim', progress: 'seenLow', text: 'Turn it down' } }
    expect(evaluate(step, ctx()).passed).toBe(false)
    expect(evaluate(step, ctx({ sim: { phase: 'running', progress: { seenLow: true } } })).passed).toBe(true)
    expect(evaluate(step, ctx({ latched: ['seenLow'] }))).toEqual({ passed: true, items: [{ text: 'Turn it down', ok: true }], feedback: null })
    const goal = { id: 'g', check: { type: 'sim', goal: true, text: 'Meet it' } }
    expect(evaluate(goal, ctx({ sim: { phase: 'running', progress: { goal: true } } })).passed).toBe(true)
    expect(evaluate(goal, ctx({ latched: ['goal'] })).passed).toBe(true)
  })

  it('code passes when the sketch compiles, and names the error', () => {
    const step = { id: 'c', check: { type: 'code', rule: 'compiles', text: 'The sketch compiles' } }
    expect(evaluate(step, ctx())).toEqual({ passed: true, items: [{ text: 'The sketch compiles', ok: true }], feedback: null })
    const error = { message: "Line 4: expected ';' after the call", line: 4 }
    expect(evaluate(step, ctx({ code: { error } }))).toEqual({
      passed: false,
      items: [{ text: 'The sketch compiles', ok: false }],
      feedback: { tone: 'bad', text: "The sketch does not compile. Line 4: expected ';' after the call" }
    })
  })

  it('tour passes when the tour is complete', () => {
    const step = { id: 't', check: { type: 'tour', text: 'Open every part' } }
    expect(evaluate(step, ctx()).passed).toBe(false)
    expect(evaluate(step, ctx({ tour: { complete: true } }))).toEqual({ passed: true, items: [{ text: 'Open every part', ok: true }], feedback: null })
  })

  it('tour stays ticked on a step stored as passed', () => {
    const step = { id: 't', check: { type: 'tour', text: 'Open every part' } }
    expect(evaluate(step, ctx({ stepPassed: true })).passed).toBe(true)
  })

  const strips = {
    id: 'strips',
    check: { type: 'event', items: [{ text: 'Point at holes in 3 different strips', event: 'strip-hover', count: 3 }] }
  }
  const practice = {
    id: 'practice',
    check: {
      type: 'event',
      items: [
        { text: 'Move a part', event: 'part-moved', count: 1 },
        { text: 'Put a part back in the tray', event: 'part-returned', count: 1 }
      ]
    }
  }

  it('event counts the places in a strip-hover set', () => {
    expect(evaluate(strips, ctx())).toEqual({ passed: false, items: [{ text: 'Point at holes in 3 different strips', ok: false }], feedback: null })
    const two = { 'strip-hover': new Set(['strip:3-top', 'strip:4-top']), 'part-moved': 0, 'part-returned': 0 }
    expect(evaluate(strips, ctx({ events: two })).passed).toBe(false)
    two['strip-hover'].add('rail:T+')
    expect(evaluate(strips, ctx({ events: two }))).toEqual({ passed: true, items: [{ text: 'Point at holes in 3 different strips', ok: true }], feedback: null })
  })

  it('event ticks each item on its own count and passes when all are ok', () => {
    const moved = evaluate(practice, ctx({ events: { 'strip-hover': new Set(), 'part-moved': 2, 'part-returned': 0 } }))
    expect(moved.items.map((item) => item.ok)).toEqual([true, false])
    expect(moved.passed).toBe(false)
    expect(evaluate(practice, ctx({ events: { 'strip-hover': new Set(), 'part-moved': 1, 'part-returned': 1 } })).passed).toBe(true)
    // A step stored as passed keeps its items ticked after the counts reset.
    expect(evaluate(practice, ctx({ stepPassed: true })).items.map((item) => item.ok)).toEqual([true, true])
  })

  it('all combines a code and a sim check', () => {
    expect(evaluate(codeStep, ctx())).toEqual({
      passed: false,
      items: [{ text: 'The sketch compiles', ok: true }, { text: 'Blink under 500 ms', ok: false }],
      feedback: null
    })
    expect(evaluate(codeStep, ctx({ latched: ['goal'] })).passed).toBe(true)
    const broken = evaluate(codeStep, ctx({ latched: ['goal'], code: { error: { message: 'Line 2: oops', line: 2 } } }))
    expect(broken.passed).toBe(false)
    expect(broken.feedback).toEqual({ tone: 'bad', text: 'The sketch does not compile. Line 2: oops' })
  })

  it('an unknown check type never passes', () => {
    expect(evaluate({ id: 'x', check: { type: 'nope' } }, ctx())).toEqual({ passed: false, items: [], feedback: null })
  })
})

describe('circuit checks', () => {
  const reference = circuits['1.2']
  const steps = lessons.find((lesson) => lesson.id === '1.2').steps
  const stepOf = (id) => steps.find((step) => step.id === id)
  const led = (anode, cathode) => ({ id: 'led1', type: 'led', color: 'red', pin: 'D13', legs: [anode, cathode] })
  const resistor = (a, b) => ({ id: 'r1', type: 'resistor', ohms: 220, legs: [a, b] })
  const circuitCtx = (build, overrides = {}) => ctx({ build, reference, scope: ['led1'], attempts: 1, busy: false, ...overrides })

  it('ticks items from their rules and passes when every item is true', () => {
    const step = stepOf('place-led')
    expect(evaluate(step, circuitCtx({ parts: [], wires: [] }, { attempts: 0 }))).toEqual({
      passed: false,
      items: [{ text: 'LED is on the breadboard', ok: false }, { text: 'Legs in two different strips', ok: false }],
      feedback: null
    })
    const good = evaluate(step, circuitCtx({ parts: [led('9e', '10e')], wires: [] }))
    expect(good.passed).toBe(true)
    expect(good.items.every((item) => item.ok)).toBe(true)
    expect(good.feedback).toBe(null)
  })

  it('names the first mistake in the scope, with its targets', () => {
    const step = stepOf('place-led')
    const result = evaluate(step, circuitCtx({ parts: [led('9c', '9d')], wires: [] }))
    expect(result.passed).toBe(false)
    expect(result.items).toEqual([{ text: 'LED is on the breadboard', ok: true }, { text: 'Legs in two different strips', ok: false }])
    expect(result.feedback.tone).toBe('bad')
    expect(result.feedback.text).toBe('Both legs of the LED are in strip 9 (rows a to e), so the current goes round it.')
    expect(result.feedback.targets.places).toEqual(['strip:9-top'])
    expect(result.feedback.targets.holes).toEqual(['9c', '9d'])
  })

  it('gives feedback only after an attempt and while nothing is in hand', () => {
    const step = stepOf('place-led')
    const build = { parts: [led('9c', '9d')], wires: [] }
    expect(evaluate(step, circuitCtx(build, { attempts: 0 })).feedback).toBe(null)
    expect(evaluate(step, circuitCtx(build, { busy: true })).feedback).toBe(null)
    expect(evaluate(step, circuitCtx(build)).feedback).not.toBe(null)
  })

  it('never names a part a later step adds', () => {
    const step = stepOf('place-led')
    expect(evaluate(step, circuitCtx({ parts: [], wires: [] })).feedback.text).toBe('Place the LED from the tray.')
  })

  it('needs the pass rule as well as the items', () => {
    const step = stepOf('add-resistor')
    const scope = ['led1', 'r1']
    const short = evaluate(step, circuitCtx({ parts: [led('9e', '10e'), resistor('9c', '9a')], wires: [] }, { scope }))
    expect(short.passed).toBe(false)
    expect(short.feedback.text).toBe('Both legs of the resistor are in strip 9 (rows a to e), so the current goes round it.')
    const notJoined = evaluate(step, circuitCtx({ parts: [led('9e', '10e'), resistor('5c', '8c')], wires: [] }, { scope }))
    expect(notJoined.feedback.text).toBe('The long leg of the LED and the resistor are not joined yet.')
    const good = evaluate(step, circuitCtx({ parts: [led('9e', '10e'), resistor('5c', '9c')], wires: [] }, { scope }))
    expect(good.passed).toBe(true)
    expect(good.items.map((item) => item.ok)).toEqual([true, true, true])
  })

  it('looks at the whole circuit on wire steps', () => {
    const step = stepOf('wire-up')
    const parts = [led('9e', '10e'), resistor('5c', '9c')]
    const halfway = evaluate(step, circuitCtx({ parts, wires: [{ id: 'u1', from: 'D13', to: '5a', color: 'yellow' }] }, { scope: ['led1', 'r1'] }))
    expect(halfway.passed).toBe(false)
    expect(halfway.items.map((item) => item.ok)).toEqual([true, false, true])
    expect(halfway.feedback.text).toBe('The GND and the short leg of the LED are not joined yet.')
    const shorted = evaluate(step, circuitCtx({ parts, wires: [{ id: 'u1', from: 'D13', to: '5a', color: 'yellow' }, { id: 'u2', from: 'GND', to: '5b', color: 'black' }] }))
    expect(shorted.items[2].ok).toBe(false)
    expect(shorted.feedback.text).toBe('This joins D13 straight to GND. On a real board that is a short circuit.')
    const done = evaluate(step, circuitCtx({ parts, wires: [{ id: 'u1', from: 'D13', to: '5a', color: 'yellow' }, { id: 'u2', from: 'GND', to: '10b', color: 'black' }] }))
    expect(done.passed).toBe(true)
  })

  it('never passes without a reference circuit', () => {
    const result = evaluate(stepOf('place-led'), circuitCtx({ parts: [led('9e', '10e')], wires: [] }, { reference: null }))
    expect(result.passed).toBe(false)
    expect(result.feedback).toBe(null)
  })
})

describe('simKeys', () => {
  it('lists the sim keys of a check tree', () => {
    expect(simKeys(quiz.check)).toEqual([])
    expect(simKeys(predict.check)).toEqual(['blinked'])
    expect(simKeys(codeStep.check)).toEqual(['goal'])
  })
})
