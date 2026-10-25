import { describe, it, expect } from 'vitest'
import { createCourse } from '../src/course/state.js'
import { createStepTracker } from '../src/course/stepTracker.js'
import { createFlow } from '../src/course/flow.js'
import { stepsFor, scopeFor } from '../src/course/steps.js'
import { evaluate } from '../src/course/checks.js'
import { lessons as courseLessons } from '../src/course/lessons.js'
import { circuits } from '../src/circuits/circuits.js'

const quiz = {
  id: 'legs',
  kind: 'learn',
  title: 'Legs',
  body: ['Text.'],
  check: { type: 'quiz', question: 'Which?', options: ['Long', 'Short'], answer: 1, explain: ['No.', 'Yes.'] }
}
const guess = {
  id: 'guess',
  kind: 'predict',
  title: 'Guess',
  body: ['Text.'],
  check: {
    type: 'predict',
    question: 'What?',
    options: ['On', 'Blink'],
    answer: 1,
    explain: ['It blinks.', 'Right.'],
    then: { type: 'sim', progress: 'blinked', text: 'Watch a blink' }
  }
}
const faster = {
  id: 'faster',
  kind: 'code',
  title: 'Faster',
  body: ['Text.'],
  check: { type: 'all', checks: [{ type: 'code', rule: 'compiles', text: 'Compiles' }, { type: 'sim', goal: true, text: 'Fast' }] }
}
const lessons = [
  { id: 'a', title: 'A', steps: [quiz, guess, faster] },
  { id: 'b', title: 'B', overview: ['Goal: do it.'] }
]

function memory(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) }
  }
}

function setup(storage = memory()) {
  const course = createCourse({ lessons, storage })
  const completions = []
  const markComplete = course.markComplete
  course.markComplete = (id) => {
    completions.push(id)
    markComplete(id)
  }
  const tracker = createStepTracker({ storage, lessons, stepsFor })
  const flow = createFlow({ course, tracker, stepsFor, evaluate })
  const views = []
  flow.subscribe((view) => views.push(view))
  return { course, tracker, flow, views, completions, storage }
}

const running = (progress) => ({ sim: { phase: 'running', progress: { ran: true, goal: false, ...progress } }, code: { error: null }, tour: { complete: false } })
const statuses = (flow) => flow.getView().steps.map((entry) => entry.status)

describe('createFlow', () => {
  it('starts on the first step with the rest locked', () => {
    const { flow } = setup()
    const view = flow.getView()
    expect(view.lesson.id).toBe('a')
    expect(view.index).toBe(0)
    expect(statuses(flow)).toEqual(['current', 'locked', 'locked'])
    expect(view.passedNow).toBe(false)
    expect(view.lessonDone).toBe(false)
    expect(view.steps[0].open).toBe(true)
    expect(view.steps[1].result).toBe(null)
  })

  it('takes a wrong quiz answer, then a right one, and only then allows Continue', () => {
    const { flow } = setup()
    flow.next()
    expect(flow.getView().index).toBe(0)
    flow.answer('legs', 0)
    expect(flow.getView().result.feedback).toEqual({ tone: 'bad', text: 'No.' })
    expect(flow.getView().passedNow).toBe(false)
    flow.next()
    expect(flow.getView().index).toBe(0)
    flow.answer('legs', 1)
    expect(flow.getView().result.feedback).toEqual({ tone: 'good', text: 'Yes.' })
    expect(flow.getView().passedNow).toBe(true)
    // A passed quiz keeps its answer.
    flow.answer('legs', 0)
    expect(flow.getView().steps[0].answer).toBe(1)
    flow.next()
    expect(flow.getView().index).toBe(1)
    expect(statuses(flow)).toEqual(['done', 'current', 'locked'])
  })

  it('ignores answers to steps that are not current and options out of range', () => {
    const { flow, tracker } = setup()
    flow.answer('guess', 1)
    flow.answer('legs', 5)
    flow.answer('legs', 'x')
    expect(tracker.get('a').answers).toEqual({})
  })

  it('locks Run on a predict step until a guess, and latches the sim through update', () => {
    const { flow, tracker } = setup()
    expect(flow.runLock()).toBe(null)
    flow.answer('legs', 1)
    flow.next()
    expect(flow.runLock()).toBe('Make a guess first.')
    flow.answer('guess', 0)
    expect(flow.runLock()).toBe(null)
    expect(flow.getView().result.feedback).toEqual({ tone: 'info', text: 'Now press Run and watch.' })
    flow.update(running({ blinked: false }))
    expect(flow.getView().passedNow).toBe(false)
    flow.update(running({ blinked: true }))
    expect(tracker.get('a').latched).toEqual({ guess: ['blinked'] })
    // Stop: progress is gone, the latched key keeps the step passed.
    flow.update({ sim: { phase: 'idle', progress: {} } })
    expect(flow.getView().passedNow).toBe(true)
    expect(flow.getView().result.feedback).toEqual({ tone: 'info', text: 'It blinks.' })
    // The guess cannot change once the step passed.
    flow.answer('guess', 1)
    expect(tracker.get('a').answers.guess).toBe(0)
  })

  it('marks the lesson done once when the last step passes', () => {
    const { flow, course, completions } = setup()
    flow.answer('legs', 1)
    flow.next()
    flow.answer('guess', 1)
    flow.update(running({ blinked: true }))
    flow.next()
    expect(flow.getView().index).toBe(2)
    flow.update({ ...running({}), code: { error: { message: 'Line 2: oops', line: 2 } } })
    expect(flow.getView().result.feedback).toEqual({ tone: 'bad', text: 'The sketch does not compile. Line 2: oops' })
    expect(completions).toEqual([])
    flow.update(running({ goal: true }))
    expect(flow.getView().lessonDone).toBe(true)
    expect(completions).toEqual(['a'])
    flow.update(running({ goal: true }))
    flow.next()
    expect(completions).toEqual(['a'])
    expect(course.getState().completed).toEqual(['a'])
    expect(flow.getView().index).toBe(2)
  })

  it('does not pass a step on a sim key from before it was current', () => {
    const { flow } = setup()
    flow.update(running({ blinked: true, goal: true }))
    flow.answer('legs', 1)
    flow.next()
    // Run is locked before a guess, so the old run reports nothing for the step.
    flow.update({ sim: { phase: 'idle', progress: {} } })
    expect(flow.getView().passedNow).toBe(false)
  })

  it('notifies only when the view changes', () => {
    const { flow, views } = setup()
    const before = views.length
    flow.update(running({}))
    flow.update(running({}))
    expect(views.length).toBe(before)
    flow.answer('legs', 0)
    expect(views.length).toBe(before + 1)
  })

  it('opens and closes done cards, never locked ones', () => {
    const { flow } = setup()
    flow.answer('legs', 1)
    flow.next()
    flow.toggleOpen(0)
    expect(flow.getView().steps[0].open).toBe(true)
    flow.toggleOpen(0)
    expect(flow.getView().steps[0].open).toBe(false)
    flow.toggleOpen(2)
    expect(flow.getView().steps[2].open).toBe(false)
    flow.toggleOpen(1)
    expect(flow.getView().steps[1].open).toBe(true)
  })

  it('passes a generated legacy step when the course marks the lesson done', () => {
    const { flow, course, completions } = setup()
    course.goTo('b')
    expect(flow.getView().lesson.id).toBe('b')
    expect(flow.getView().passedNow).toBe(false)
    course.markComplete('b')
    expect(flow.getView().passedNow).toBe(true)
    expect(flow.getView().lessonDone).toBe(true)
    expect(completions).toEqual(['b'])
  })

  it('gives a lesson completed before steps existed every step passed', () => {
    const storage = memory({ 'robo-learn:progress': JSON.stringify(['a']) })
    const { flow, tracker, completions } = setup(storage)
    expect(tracker.get('a').passed).toEqual(['legs', 'guess', 'faster'])
    expect(flow.getView().index).toBe(2)
    expect(flow.getView().lessonDone).toBe(true)
    expect(flow.getView().steps.every((entry) => entry.result.items.every((item) => item.ok))).toBe(true)
    expect(completions).toEqual([])
  })

  it('starts the lesson over after a tracker reset and keeps the course completion', () => {
    const storage = memory({ 'robo-learn:progress': JSON.stringify(['a']) })
    const { flow, tracker, course } = setup(storage)
    tracker.reset('a')
    expect(flow.getView().index).toBe(0)
    expect(statuses(flow)).toEqual(['current', 'locked', 'locked'])
    expect(course.getState().completed).toEqual(['a'])
  })

  it('forgets the old lesson run progress on a lesson change', () => {
    const { flow, course, tracker } = setup()
    course.goTo('b')
    flow.update(running({ goal: true }))
    course.goTo('a')
    flow.answer('legs', 1)
    flow.next()
    flow.answer('guess', 1)
    expect(tracker.get('a').latched).toEqual({})
    expect(flow.getView().passedNow).toBe(false)
  })

  it('restores step progress from storage', () => {
    const first = setup()
    first.flow.answer('legs', 1)
    first.flow.next()
    const again = setup(memory(first.storage.data))
    expect(again.flow.getView().index).toBe(1)
    expect(statuses(again.flow)).toEqual(['done', 'current', 'locked'])
  })
})

describe('lesson 1.2 built by hand', () => {
  const reference = circuits['1.2']
  const blink = courseLessons.find((lesson) => lesson.id === '1.2')

  function setup12(storage = memory()) {
    const course = createCourse({ lessons: [blink], storage })
    const completions = []
    const markComplete = course.markComplete
    course.markComplete = (id) => {
      completions.push(id)
      markComplete(id)
    }
    const tracker = createStepTracker({ storage, lessons: [blink], stepsFor })
    const flow = createFlow({ course, tracker, stepsFor, evaluate })
    let build = { parts: [], wires: [] }
    let attempts = 0
    // What main.js sends: the build, its reference and the step scope.
    const send = (extra = {}) => flow.update({
      sim: { phase: 'idle', progress: {} },
      code: { error: null },
      tour: { complete: false },
      build,
      reference,
      scope: scopeFor(blink, tracker.get('1.2').current),
      attempts,
      busy: false,
      ...extra
    })
    const change = (next) => {
      build = next
      attempts += 1
      send()
    }
    const next = () => {
      flow.next()
      attempts = 0
      send()
    }
    return { flow, tracker, completions, send, change, next, build: () => build }
  }

  const led = { id: 'led1', type: 'led', color: 'red', pin: 'D13', legs: ['9e', '10e'] }
  const resistor = { id: 'r1', type: 'resistor', ohms: 220, legs: ['5c', '9c'] }
  const wireD13 = { id: 'u1', from: 'D13', to: '5a', color: 'yellow' }
  const wireGnd = { id: 'u2', from: 'GND', to: '10a', color: 'black' }

  it('runs from the quiz to the code step and completes the lesson once', () => {
    const { flow, completions, send, change, next } = setup12()
    expect(flow.getView().steps.map((entry) => entry.step.id)).toEqual(['led-legs', 'place-led', 'add-resistor', 'wire-up', 'guess', 'faster'])
    flow.answer('led-legs', 1)
    next()
    expect(flow.getView().steps[1].status).toBe('current')
    change({ parts: [led], wires: [] })
    expect(flow.getView().passedNow).toBe(true)
    next()
    change({ parts: [led, resistor], wires: [] })
    expect(flow.getView().passedNow).toBe(true)
    next()
    change({ parts: [led, resistor], wires: [wireD13] })
    expect(flow.getView().passedNow).toBe(false)
    change({ parts: [led, resistor], wires: [wireD13, wireGnd] })
    expect(flow.getView().passedNow).toBe(true)
    next()
    expect(flow.runLock()).toBe('Make a guess first.')
    flow.answer('guess', 1)
    send({ sim: { phase: 'running', progress: { ran: true, goal: false, blinked: true } } })
    expect(flow.getView().passedNow).toBe(true)
    next()
    expect(completions).toEqual([])
    send({ sim: { phase: 'running', progress: { ran: true, goal: true } } })
    expect(flow.getView().lessonDone).toBe(true)
    send({ sim: { phase: 'running', progress: { ran: true, goal: true } } })
    expect(completions).toEqual(['1.2'])
  })

  it('starts a new step with no attempts, so the old mistake does not carry over', () => {
    const { flow, change } = setup12()
    flow.answer('led-legs', 1)
    flow.next()
    change({ parts: [led], wires: [] })
    // Continue without a fresh update: the wire step must not show a mistake yet.
    flow.next()
    flow.next()
    expect(flow.getView().index).toBe(2)
    expect(flow.getView().result.feedback).toBe(null)
  })

  it('keeps the mistake targets in the view', () => {
    const { flow, change, next } = setup12()
    flow.answer('led-legs', 1)
    next()
    change({ parts: [{ ...led, legs: ['9c', '9d'] }], wires: [] })
    expect(flow.getView().targets).toEqual({ parts: ['led1'], holes: ['9c', '9d'], pins: [], places: ['strip:9-top'] })
    change({ parts: [led], wires: [] })
    expect(flow.getView().targets).toBe(null)
  })

  it('raises the hint level one way only, and stores a step passed at level 3 as helped', () => {
    const { flow, tracker, change, next } = setup12()
    flow.answer('led-legs', 1)
    next()
    flow.raiseHint(2)
    flow.raiseHint(1)
    expect(flow.getView().steps[1].hintLevel).toBe(2)
    flow.raiseHint(3)
    change({ parts: [led], wires: [] })
    expect(tracker.get('1.2').helped).toEqual(['place-led'])
    expect(flow.getView().steps[1].helped).toBe(true)
    // A passed step keeps its level, and a step passed below level 3 is not helped.
    flow.raiseHint(0)
    next()
    flow.raiseHint(1)
    change({ parts: [led, resistor], wires: [] })
    expect(tracker.get('1.2').helped).toEqual(['place-led'])
    expect(tracker.get('1.2').hintLevels).toEqual({ 'place-led': 3, 'add-resistor': 1 })
  })
})
