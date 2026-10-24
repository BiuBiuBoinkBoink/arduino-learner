import { describe, it, expect } from 'vitest'
import { lessons } from '../src/course/lessons.js'

function isAscii(text) {
  return [...text].every((ch) => ch.charCodeAt(0) < 128)
}

function nonEmpty(text) {
  return typeof text === 'string' && text.trim().length > 0
}

describe('lesson content', () => {
  for (const lesson of lessons) {
    describe(lesson.id, () => {
      it('has overview paragraphs', () => {
        expect(Array.isArray(lesson.overview)).toBe(true)
        expect(lesson.overview.length).toBeGreaterThan(0)
        for (const text of lesson.overview) expect(nonEmpty(text)).toBe(true)
      })

      it('has pinout rows with pin and use', () => {
        expect(Array.isArray(lesson.pinout)).toBe(true)
        expect(lesson.pinout.length).toBeGreaterThan(0)
        for (const row of lesson.pinout) {
          expect(nonEmpty(row.pin)).toBe(true)
          expect(nonEmpty(row.use)).toBe(true)
        }
      })

      it('has an example with code and note', () => {
        expect(nonEmpty(lesson.example.code)).toBe(true)
        expect(nonEmpty(lesson.example.note)).toBe(true)
      })

      it('has specs with label and value', () => {
        expect(Array.isArray(lesson.specs)).toBe(true)
        expect(lesson.specs.length).toBeGreaterThan(0)
        for (const row of lesson.specs) {
          expect(nonEmpty(row.label)).toBe(true)
          expect(nonEmpty(row.value)).toBe(true)
        }
      })

      it('uses ASCII only in its content', () => {
        const texts = [
          ...lesson.overview,
          ...lesson.pinout.flatMap((row) => [row.pin, row.use]),
          lesson.example.code,
          lesson.example.note,
          ...lesson.specs.flatMap((row) => [row.label, row.value])
        ]
        for (const text of texts) expect(isAscii(text)).toBe(true)
      })
    })
  }
})
