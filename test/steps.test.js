import { describe, it, expect } from 'vitest'
import { stepsFor } from '../src/course/steps.js'
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

  it('gives 1.2 one run step with its goal text', () => {
    const lesson = byId('1.2')
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
    expect(stepsFor({ ...byId('1.2'), steps })).toBe(steps)
  })
})
