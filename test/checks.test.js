import { describe, it, expect } from 'vitest'
import { evaluate, simKeys, CHECK_TYPES } from '../src/course/checks.js'

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
    expect(CHECK_TYPES).toEqual(['legacy', 'quiz', 'predict', 'sim', 'code', 'tour', 'all'])
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

describe('simKeys', () => {
  it('lists the sim keys of a check tree', () => {
    expect(simKeys(quiz.check)).toEqual([])
    expect(simKeys(predict.check)).toEqual(['blinked'])
    expect(simKeys(codeStep.check)).toEqual(['goal'])
  })
})
