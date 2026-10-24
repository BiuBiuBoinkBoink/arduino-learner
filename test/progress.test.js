import { describe, it, expect } from 'vitest'
import { lessonStatus } from '../src/course/progress.js'
import { lessons } from '../src/course/lessons.js'

describe('lessonStatus', () => {
  it('marks the first lesson up next with no progress', () => {
    expect(lessonStatus(lessons, [], '1.1')).toBe('next')
    expect(lessonStatus(lessons, [], '1.2')).toBe('')
  })

  it('marks done lessons and the first not done one in course order', () => {
    const completed = ['1.1', '1.3']
    expect(lessonStatus(lessons, completed, '1.1')).toBe('done')
    expect(lessonStatus(lessons, completed, '1.3')).toBe('done')
    expect(lessonStatus(lessons, completed, '1.2')).toBe('next')
    expect(lessonStatus(lessons, completed, '1.4')).toBe('')
  })

  it('has no next lesson when every lesson is done', () => {
    const all = lessons.map((lesson) => lesson.id)
    expect(lessons.every((lesson) => lessonStatus(lessons, all, lesson.id) === 'done')).toBe(true)
  })
})
