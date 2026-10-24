import { describe, it, expect } from 'vitest'
import { createCourse } from '../src/course/state.js'
import { createStepTracker } from '../src/course/stepTracker.js'
import { createFlow } from '../src/course/flow.js'
import { stepsFor } from '../src/course/steps.js'
import { evaluate } from '../src/course/checks.js'

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
