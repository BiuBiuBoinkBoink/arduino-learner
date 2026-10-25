import { describe, it, expect } from 'vitest'
import { lessons } from '../src/course/lessons.js'
import { UNO_ZONE_IDS } from '../src/parts/unoBoard.js'
import { fillSketch, slotValues } from '../src/ui/sketch.js'
import { STEP_KINDS, BUILD_KINDS } from '../src/course/steps.js'
import { CHECK_TYPES } from '../src/course/checks.js'
import { circuits } from '../src/circuits/circuits.js'
import { PART_TYPES } from '../src/circuits/footprints.js'
import { isPinName } from '../src/circuits/netlist.js'
import { kitFor } from '../src/build/kit.js'

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

  it('gives 1.2 to 1.12 a sketch with a non empty trace', () => {
    for (const id of ['1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12']) {
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

describe('lesson overviews', () => {
  it('give every lesson two or three ASCII paragraphs with no Goal text and no exclamation marks', () => {
    for (const lesson of lessons) {
      expect(lesson.overview.length, lesson.id).toBeGreaterThanOrEqual(2)
      expect(lesson.overview.length, lesson.id).toBeLessThanOrEqual(3)
      for (const text of lesson.overview) {
        expect(isAscii(text)).toBe(true)
        expect(text.includes('!')).toBe(false)
        expect(text.includes('Goal:'), lesson.id).toBe(false)
      }
    }
  })
})

describe('lesson steps', () => {
  // Build and wire steps use circuit checks, which arrive with placement (phase 5).
  const knownType = (step, check) => CHECK_TYPES.includes(check.type) || (check.type === 'circuit' && ['build', 'wire'].includes(step.kind))

  function checkShape(step, check) {
    expect(knownType(step, check), step.id + ' ' + check.type).toBe(true)
    if (check.type === 'quiz' || check.type === 'predict') {
      expect(nonEmpty(check.question)).toBe(true)
      expect(check.options.length).toBeGreaterThan(1)
      expect(Number.isInteger(check.answer)).toBe(true)
      expect(check.answer).toBeGreaterThanOrEqual(0)
      expect(check.answer).toBeLessThan(check.options.length)
      expect(check.explain).toHaveLength(check.options.length)
    }
    if (check.type === 'predict') checkShape(step, check.then)
    if (check.type === 'all') for (const inner of check.checks) checkShape(step, inner)
  }

  for (const lesson of lessons.filter((item) => item.steps)) {
    it(lesson.id + ' has well formed steps', () => {
      const ids = lesson.steps.map((step) => step.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const step of lesson.steps) {
        expect(STEP_KINDS).toContain(step.kind)
        expect(nonEmpty(step.title)).toBe(true)
        expect(step.body.length).toBeGreaterThan(0)
        for (const text of step.body) {
          expect(nonEmpty(text)).toBe(true)
          expect(isAscii(text)).toBe(true)
        }
        checkShape(step, step.check)
      }
    })
  }

  it('gives every lesson its own steps', () => {
    for (const lesson of lessons) expect(Array.isArray(lesson.steps) && lesson.steps.length > 0, lesson.id).toBe(true)
  })

  it('gives 1.1 its new title, summary and kit, and P1 project: true', () => {
    const intro = lessons.find((item) => item.id === '1.1')
    expect(intro.title).toBe('Meet the Uno and breadboard')
    expect(intro.summary).toBe('Tour the board, then learn how a breadboard joins holes.')
    expect(intro.kit).toEqual({ parts: [{ id: 'r1', type: 'resistor', ohms: 220 }], wires: 2 })
    expect(intro.steps[0].check).toEqual({ type: 'tour', text: 'Open all six parts of the Uno' })
    expect(lessons.find((item) => item.id === 'P1').project).toBe(true)
    expect(lessons.filter((item) => item.project).map((item) => item.id)).toEqual(['P1'])
  })

  it('gives 1.2 the six steps from the plan', () => {
    const lesson = lessons.find((item) => item.id === '1.2')
    expect(lesson.prebuilt).toEqual([])
    expect(lesson.steps.map((step) => step.id)).toEqual(['led-legs', 'place-led', 'add-resistor', 'wire-up', 'guess', 'faster'])
  })
})

// The progress names each board reports (see "Sims and goal checks" in
// AGENTS.md); ran and goal come from the runner for every board.
const PROGRESS = {
  '1.2': ['blinked', 'fast'],
  '1.3': ['measured220', 'measured1000', 'measured10000'],
  '1.4': ['pressedOnce'],
  '1.5': ['floated', 'pressedOnce'],
  '1.6': ['seenLow', 'seenHigh'],
  '1.7': ['rampSeen'],
  '1.8': [],
  '1.9': ['turnedOn'],
  '1.10': ['seenCool', 'seenWarm'],
  '1.11': ['played'],
  '1.12': ['reached45', 'reached90', 'reached135'],
  P1: []
}
const RUNNER_KEYS = ['ran', 'goal']

// Every check in a check tree, the tree itself first.
function checksOf(check) {
  if (check.type === 'predict') return [check, ...checksOf(check.then)]
  if (check.type === 'all') return [check, ...check.checks.flatMap(checksOf)]
  return [check]
}

// The ids and pins a rule names.
function ruleNames(rule) {
  if (rule.placed) return [rule.placed]
  if (rule.allApart) return [rule.allApart]
  if (rule.straddles) return [rule.straddles]
  if (rule.wired) return [rule.wired]
  if (rule.apart) return rule.apart
  if (rule.joined) return rule.joined
  if (rule.matches) return rule.matches === 'all' ? [] : rule.matches
  if (rule.noShorts) return []
  return [null]
}

// Every text a learner reads in a step.
function stepTexts(step) {
  const texts = [step.title, ...step.body]
  for (const field of ['hint', 'done']) if (step[field] !== undefined) texts.push(step[field])
  if (step.showMe && step.showMe.note) texts.push(step.showMe.note)
  for (const check of checksOf(step.check)) {
    if (check.text) texts.push(check.text)
    if (check.question) texts.push(check.question, ...check.options, ...check.explain)
    if (check.items) texts.push(...check.items.map((item) => item.text))
  }
  return texts
}

describe('lesson steps against kits, circuits and boards', () => {
  for (const lesson of lessons) {
    describe(lesson.id, () => {
      const reference = circuits[lesson.id] || null
      const kit = kitFor(lesson, reference, { prebuiltLists: true })
      const kitIds = kit.parts.map((part) => part.id)
      const prebuilt = lesson.prebuilt || []
      const builds = lesson.steps.filter((step) => BUILD_KINDS.includes(step.kind))

      it('has a lesson without a reference circuit only when it has a kit', () => {
        expect(Boolean(reference || lesson.kit)).toBe(true)
      })

      it('lists prebuilt ids from the reference circuit', () => {
        const refIds = reference ? [...reference.parts, ...reference.wires].map((item) => item.id) : []
        for (const id of prebuilt) expect(refIds, id).toContain(id)
      })

      it('places kit parts that are not prebuilt in build and wire steps', () => {
        for (const step of builds) {
          expect(Array.isArray(step.parts), step.id).toBe(true)
          if (step.kind === 'wire') expect(step.parts, step.id).toEqual([])
          for (const id of step.parts) {
            expect(kitIds, step.id + ' ' + id).toContain(id)
            expect(prebuilt, step.id + ' ' + id).not.toContain(id)
          }
        }
      })

      it('places every kit part in some step or as prebuilt', () => {
        const placedIds = [...prebuilt, ...builds.flatMap((step) => step.parts)]
        for (const id of kitIds) expect(placedIds, id).toContain(id)
      })

      it('checks build and wire steps with circuit or event checks, and other steps without them', () => {
        for (const step of lesson.steps) {
          if (BUILD_KINDS.includes(step.kind)) expect(['circuit', 'event'], step.id).toContain(step.check.type)
          else expect(step.check.type, step.id).not.toBe('circuit')
        }
      })

      it('names only kit parts, their terminals and Uno pins in its rules', () => {
        const typeOf = Object.fromEntries(kit.parts.map((part) => [part.id, part.type]))
        for (const step of lesson.steps.filter((item) => item.check.type === 'circuit')) {
          const rules = [...step.check.items.map((item) => item.rule), ...(step.check.pass ? [step.check.pass] : [])]
          for (const rule of rules) {
            for (const name of ruleNames(rule)) {
              expect(name, step.id).not.toBe(null)
              if (isPinName(name)) continue
              const [id, terminal] = name.split('.')
              expect(kitIds, step.id + ' ' + name).toContain(id)
              if (terminal === undefined) continue
              const allowed = [...PART_TYPES[typeOf[id]].terminals, '*', ...(typeOf[id] === 'potentiometer' ? ['end'] : [])]
              expect(allowed, step.id + ' ' + name).toContain(terminal)
            }
          }
        }
      })

      it('checks only progress names its board reports', () => {
        const names = [...(PROGRESS[lesson.id] || []), ...RUNNER_KEYS]
        for (const step of lesson.steps) {
          for (const check of checksOf(step.check).filter((item) => item.type === 'sim')) {
            if (check.goal) continue
            expect(Object.hasOwn(PROGRESS, lesson.id), step.id).toBe(true)
            expect(names, step.id).toContain(check.progress)
          }
        }
      })

      it('gives event checks known events and counts', () => {
        for (const step of lesson.steps.filter((item) => item.check.type === 'event')) {
          for (const item of step.check.items) {
            expect(['strip-hover', 'part-moved', 'part-returned']).toContain(item.event)
            expect(Number.isInteger(item.count) && item.count > 0).toBe(true)
          }
        }
      })

      it('writes every step text in ASCII with no exclamation marks', () => {
        for (const step of lesson.steps) {
          for (const text of stepTexts(step)) {
            expect(nonEmpty(text), step.id).toBe(true)
            expect(isAscii(text), step.id + ': ' + text).toBe(true)
            expect(text.includes('!'), step.id + ': ' + text).toBe(false)
          }
        }
      })
    })
  }
})
