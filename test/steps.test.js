import { describe, it, expect } from 'vitest'
import { stepsFor, hasGeneratedSteps, scopeFor, BUILD_STEPS_ENABLED, CODE_OPEN_KINDS } from '../src/course/steps.js'
import { splitGoal } from '../src/course/goalText.js'
import { lessons } from '../src/course/lessons.js'

const byId = (id) => lessons.find((lesson) => lesson.id === id)

describe('stepsFor', () => {
  // Every course lesson has its own steps since phase 6; these lessons have none.
  const toured = { id: 't', title: 'T', overview: ['A board.'], tour: [{ zone: 'chip', label: 'Chip', text: 'The chip.' }] }
  const plain = { id: 'p', title: 'P', overview: ['A part.', 'Goal: press Run.'] }

  it('gives a lesson with a tour and no steps one explore step', () => {
    expect(stepsFor(toured)).toEqual([{
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

  it('gives a lesson with no steps one run step with its goal text', () => {
    expect(stepsFor(plain)).toEqual([{
      id: 'goal',
      kind: 'run',
      title: 'Goal',
      body: [splitGoal(plain.overview).goal],
      check: { type: 'legacy' }
    }])
  })

  it('gives 1.1 its tour and breadboard steps', () => {
    expect(stepsFor(byId('1.1')).map((step) => step.id)).toEqual(['tour', 'strips', 'gap', 'place-resistor', 'power-wires', 'practice'])
  })

  it('returns the steps a lesson gives', () => {
    const steps = [{ id: 'a', kind: 'learn', title: 'A', body: [], check: { type: 'legacy' } }]
    expect(stepsFor({ ...byId('1.2'), steps })).toEqual(steps)
    expect(hasGeneratedSteps({ ...plain, steps })).toBe(false)
    expect(hasGeneratedSteps(plain)).toBe(true)
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
    expect(scopeFor({ id: 'p', title: 'P', overview: ['Goal: press Run.'] }, 0)).toEqual([])
  })
})
