import { describe, it, expect } from 'vitest'
import { lessons } from '../src/course/lessons.js'
import { UNO_ZONE_IDS } from '../src/parts/unoBoard.js'
import { fillSketch, slotValues } from '../src/ui/sketch.js'

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

describe('lesson 1.1 board tour', () => {
  const lesson = lessons.find((item) => item.id === '1.1')

  it('has one tour entry per board zone, in order', () => {
    expect(lesson.tour.map((entry) => entry.zone)).toEqual(UNO_ZONE_IDS)
  })

  it('has a non empty ASCII label and text for each entry', () => {
    for (const entry of lesson.tour) {
      expect(nonEmpty(entry.label)).toBe(true)
      expect(nonEmpty(entry.text)).toBe(true)
      expect(isAscii(entry.label)).toBe(true)
      expect(isAscii(entry.text)).toBe(true)
      expect(entry.text.includes('!')).toBe(false)
    }
  })
})

function slotNames(code) {
  return [...code.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1])
}

describe('lesson sketches', () => {
  for (const lesson of lessons.filter((item) => item.sketch)) {
    describe(lesson.id, () => {
      const { code, params, trace } = lesson.sketch
      const names = params.map((param) => param.name)
      const ranges = params.filter((param) => param.type === 'range').map((param) => param.name)

      it('has unique param names of type range or choice', () => {
        expect(new Set(names).size).toBe(names.length)
        for (const param of params) expect(['range', 'choice']).toContain(param.type)
      })

      it('has a param for every slot and uses every param', () => {
        const slots = slotNames(code)
        for (const slot of slots) expect(names).toContain(slot)
        for (const name of names) expect(slots).toContain(name)
      })

      it('has range defaults within min and max', () => {
        for (const param of params.filter((item) => item.type === 'range')) {
          expect(param.step).toBeGreaterThan(0)
          expect(param.value).toBeGreaterThanOrEqual(param.min)
          expect(param.value).toBeLessThanOrEqual(param.max)
        }
      })

      it('has choice defaults that are one of the options', () => {
        for (const param of params.filter((item) => item.type === 'choice')) {
          expect(param.options.map((option) => option.value)).toContain(param.value)
        }
      })

      it('has trace lines inside the code and valid durations', () => {
        const lineCount = code.split('\n').length
        for (const step of trace) {
          expect(Number.isInteger(step.line)).toBe(true)
          expect(step.line).toBeGreaterThanOrEqual(1)
          expect(step.line).toBeLessThanOrEqual(lineCount)
          if (typeof step.ms === 'string') expect(ranges).toContain(step.ms)
          else expect(step.ms).toBeGreaterThan(0)
        }
      })

      it('uses ASCII only in code, labels and units', () => {
        const texts = [
          code,
          ...params.map((param) => param.label),
          ...params.filter((param) => param.unit !== undefined).map((param) => param.unit),
          ...params.flatMap((param) => (param.options || []).map((option) => option.label)),
          ...params.flatMap((param) => (param.options || []).filter((option) => option.code !== undefined).map((option) => option.code))
        ]
        for (const text of texts) {
          expect(nonEmpty(text)).toBe(true)
          expect(isAscii(text)).toBe(true)
        }
      })
    })
  }

  it('gives 1.2 to 1.5 a sketch with a non empty trace', () => {
    for (const id of ['1.2', '1.3', '1.4', '1.5']) {
      const lesson = lessons.find((item) => item.id === id)
      expect(lesson.sketch).toBeTruthy()
      expect(lesson.sketch.trace.length).toBeGreaterThan(0)
    }
  })
})

describe('lesson 1.5 pull choice', () => {
  const lesson = lessons.find((item) => item.id === '1.5')

  it('fills the pinMode comment from the chosen option', () => {
    const [pull] = lesson.sketch.params
    expect(pull.name).toBe('pull')
    expect(pull.value).toBe('down')
    expect(pull.options.map((option) => [option.value, option.label])).toEqual([['down', 'Fitted'], ['none', 'Removed']])
    expect(fillSketch(lesson.sketch.code, slotValues(lesson.sketch.params, { pull: 'down' })))
      .toContain('// external 10 kohm pull down')
    expect(fillSketch(lesson.sketch.code, slotValues(lesson.sketch.params, { pull: 'none' })))
      .toContain('// nothing on the pin, it floats')
  })
})

describe('lesson 1.7 step delay', () => {
  const lesson = lessons.find((item) => item.id === '1.7')

  it('has one stepMs range param, 1 to 20 ms, default 10, in both delay lines', () => {
    expect(lesson.sketch.params).toEqual([
      { name: 'stepMs', label: 'Step delay', type: 'range', min: 1, max: 20, step: 1, value: 10, unit: 'ms' }
    ])
    expect(lesson.sketch.code.split('delay({{stepMs}});')).toHaveLength(3)
    expect(lesson.sketch.trace.filter((step) => step.ms === 'stepMs')).toHaveLength(2)
  })
})

describe('lesson 1.6 sketch', () => {
  it('is the example code with no params and a trace over the loop', () => {
    const lesson = lessons.find((item) => item.id === '1.6')
    expect(lesson.sketch.code).toBe(lesson.example.code)
    expect(lesson.sketch.params).toEqual([])
    expect(lesson.sketch.trace.map((step) => step.line)).toEqual([6, 7, 8, 9])
  })
})

describe('lesson overviews with a goal paragraph', () => {
  it('give 1.3 to 1.11 three ASCII paragraphs with no exclamation marks', () => {
    for (const id of ['1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11']) {
      const lesson = lessons.find((item) => item.id === id)
      expect(lesson.overview).toHaveLength(3)
      for (const text of lesson.overview) {
        expect(isAscii(text)).toBe(true)
        expect(text.includes('!')).toBe(false)
      }
    }
  })
})
