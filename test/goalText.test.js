import { describe, it, expect } from 'vitest'
import { splitGoal } from '../src/course/goalText.js'
import { lessons } from '../src/course/lessons.js'

const byId = (id) => lessons.find((lesson) => lesson.id === id)

describe('splitGoal', () => {
  it('keeps every paragraph as intro when there is no goal', () => {
    const paragraphs = ['One.', 'Two.']
    const result = splitGoal(paragraphs)
    expect(result).toEqual({ intro: ['One.', 'Two.'], goal: null })
    expect(result.intro).not.toBe(paragraphs)
  })

  it('takes a goal that is its own last paragraph (1.2)', () => {
    const { intro, goal } = splitGoal(byId('1.2').overview)
    expect(intro).toEqual(byId('1.2').overview.slice(0, 2))
    expect(goal).toBe('set the on and off times so one full blink takes less than 500 ms, then press Run.')
  })

  it('keeps the text before the goal in the same paragraph (1.12)', () => {
    const { intro, goal } = splitGoal(byId('1.12').overview)
    expect(intro[intro.length - 1]).toBe('Using the Servo library turns off PWM on pins 9 and 10, so keep LEDs that fade on other pins.')
    expect(goal.startsWith('press Run, then set the angle to 45, 90 and 135 deg')).toBe(true)
  })

  it('appends paragraphs after the goal to intro', () => {
    expect(splitGoal(['A.', 'Goal: do it.', 'B.'])).toEqual({ intro: ['A.', 'B.'], goal: 'do it.' })
  })

  it('finds a goal in every lesson except 1.1', () => {
    for (const lesson of lessons) {
      const { goal } = splitGoal(lesson.overview)
      if (lesson.id === '1.1') expect(goal).toBe(null)
      else expect(goal, lesson.id).toBeTruthy()
    }
  })
})
