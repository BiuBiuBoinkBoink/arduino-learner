import { describe, it, expect } from 'vitest'
import { stepsFor, hasGeneratedSteps, scopeFor, BUILD_STEPS_ENABLED, CODE_OPEN_KINDS } from '../src/course/steps.js'
import { splitGoal } from '../src/course/goalText.js'
import { lessons } from '../src/course/lessons.js'

const byId = (id) => lessons.find((lesson) => lesson.id === id)

describe('stepsFor', () => {
  it('gives 1.1 one explore step', () => {
    expect(stepsFor(byId('1.1'))).toEqual([{
      id: 'goal',
      kind: 'explore',
      title: 'Tour the board',
      body: ['Click each part of the Uno to see what it does.'],
      check: { type: 'legacy' }
    }])
  })

  it('gives 1.2 its own six steps, build and wire steps included', () => {
    expect(stepsFor(byId('1.2')).map((step) => [step.kind, step.title])).toEqual([
      ['learn', 'What an LED needs'],
      ['build', 'Place the LED'],
      ['build', 'Add the resistor'],
      ['wire', 'Wire D13 and GND'],
      ['predict', 'Guess, then run'],
      ['code', 'Blink faster']
    ])
  })

  it('gives 1.4 one run step with its goal text', () => {
    const lesson = byId('1.4')
    expect(stepsFor(lesson)).toEqual([{
      id: 'goal',
      kind: 'run',
      title: 'Goal',
      body: [splitGoal(lesson.overview).goal],
      check: { type: 'legacy' }
    }])
  })

  it('returns the steps a lesson gives', () => {
    const steps = [{ id: 'a', kind: 'learn', title: 'A', body: [], check: { type: 'legacy' } }]
    expect(stepsFor({ ...byId('1.2'), steps })).toEqual(steps)
    expect(hasGeneratedSteps({ ...byId('1.4'), steps })).toBe(false)
    expect(hasGeneratedSteps(byId('1.4'))).toBe(true)
  })

  it('keeps build and wire steps now the build flag is on', () => {
    expect(BUILD_STEPS_ENABLED).toBe(true)
    const steps = ['learn', 'build', 'wire', 'predict', 'code'].map((kind) => ({ id: kind, kind, title: kind, body: [], check: { type: 'legacy' } }))
    expect(stepsFor({ ...byId('1.2'), steps }).map((step) => step.kind)).toEqual(['learn', 'build', 'wire', 'predict', 'code'])
  })

  it('opens the code panel on predict, run and code steps', () => {
    expect(CODE_OPEN_KINDS).toEqual(['predict', 'run', 'code'])
  })

  it('opens 1.2 on an empty breadboard', () => {
    expect(byId('1.2').prebuilt).toEqual([])
  })
})

describe('scopeFor', () => {
  it('collects the parts of 1.2 build steps up to the given step', () => {
    const lesson = byId('1.2')
    expect(scopeFor(lesson, 0)).toEqual([])
    expect(scopeFor(lesson, 1)).toEqual(['led1'])
    expect(scopeFor(lesson, 2)).toEqual(['led1', 'r1'])
    expect(scopeFor(lesson, 3)).toEqual(['led1', 'r1'])
    expect(scopeFor(lesson, 5)).toEqual(['led1', 'r1'])
  })

  it('adds prebuilt parts first and drops repeats', () => {
    const step = (id, kind, parts) => ({ id, kind, title: id, body: [], parts, check: { type: 'legacy' } })
    const lesson = {
      ...byId('1.2'),
      prebuilt: ['r1', 'w1'],
      steps: [step('a', 'build', ['btn1', 'r1']), step('b', 'learn', ['x']), step('c', 'wire', []), step('d', 'build', ['led1'])]
    }
    expect(scopeFor(lesson, 0)).toEqual(['r1', 'w1', 'btn1'])
    expect(scopeFor(lesson, 2)).toEqual(['r1', 'w1', 'btn1'])
    expect(scopeFor(lesson, 3)).toEqual(['r1', 'w1', 'btn1', 'led1'])
    expect(scopeFor({ ...byId('1.4') }, 0)).toEqual([])
  })
})
