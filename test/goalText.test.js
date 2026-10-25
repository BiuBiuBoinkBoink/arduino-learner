import { describe, it, expect } from 'vitest'
import { splitGoal } from '../src/course/goalText.js'
import { lessons } from '../src/course/lessons.js'

describe('splitGoal', () => {
  it('keeps every paragraph as intro when there is no goal', () => {
    const paragraphs = ['One.', 'Two.']
    const result = splitGoal(paragraphs)
    expect(result).toEqual({ intro: ['One.', 'Two.'], goal: null })
    expect(result.intro).not.toBe(paragraphs)
  })

  it('takes a goal that is its own last paragraph', () => {
    const { intro, goal } = splitGoal(['One.', 'Two.', 'Goal: blink faster, then press Run.'])
    expect(intro).toEqual(['One.', 'Two.'])
    expect(goal).toBe('blink faster, then press Run.')
  })

  it('keeps the text before the goal in the same paragraph', () => {
    const { intro, goal } = splitGoal(['One.', 'Keep LEDs on other pins. Goal: press Run.'])
    expect(intro).toEqual(['One.', 'Keep LEDs on other pins.'])
    expect(goal).toBe('press Run.')
  })

  it('appends paragraphs after the goal to intro', () => {
    expect(splitGoal(['A.', 'Goal: do it.', 'B.'])).toEqual({ intro: ['A.', 'B.'], goal: 'do it.' })
  })

  it('finds no goal in any lesson overview, since the steps carry it', () => {
    for (const lesson of lessons) expect(splitGoal(lesson.overview).goal, lesson.id).toBe(null)
  })
})
