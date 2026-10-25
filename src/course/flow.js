// Lesson flow: ties the course, the step tracker and the checks together. Pure
// module. update(ctx) evaluates the current step against the latest context
// (sim progress, code error, tour), latches sim keys that are ok now, stores a
// pass (as helped when the learner used Do it for me, hint level 3), and marks
// the lesson done in the course once every step has passed.
// The view is rebuilt on every change and subscribers hear only real changes.
import { simKeys } from './checks.js'

const GUESS_FIRST = 'Make a guess first.'
// Hint level 3 is Do it for me: a step passed at that level is stored as helped.
const HELPED_LEVEL = 3
const IDLE_CTX = { sim: { phase: 'idle', progress: {} }, code: { error: null }, tour: { complete: false } }

export function createFlow({ course, tracker, stepsFor, evaluate }) {
  const listeners = new Set()
  let ctx = IDLE_CTX
  let lessonId = null
  // Done step cards the learner opened, by index; cleared on a lesson change.
  let opened = new Set()
  // Lessons this flow already marked done, so markComplete runs once each.
  const marked = new Set()
  let view = null
  let viewKey = ''
  let syncing = false
  let again = false

  // The context a step is evaluated in. Answers and latched keys come from the
  // tracker. A step stored as passed keeps its sim and answer items ticked
  // (its keys count as latched, its answer as given), so a reload or a lesson
  // marked done before steps existed still shows it met; code items stay live.
  function stepCtx(lesson, record, step) {
    const passed = record.passed.includes(step.id)
    const answers = { ...record.answers }
    const check = step.check || {}
    if (passed && answers[step.id] === undefined && Number.isInteger(check.answer)) answers[step.id] = check.answer
    const latched = record.latched[step.id] || []
    return {
      ...ctx,
      lessonId: lesson.id,
      lessonCompleted: course.getState().completed.includes(lesson.id),
      answers,
      latched: passed ? [...new Set([...latched, ...simKeys(check)])] : latched
    }
  }

  // One pass: lesson switch, migration, latching, storing a pass and the lesson done.
  function step() {
    const { lesson, completed } = course.getState()
    // A new lesson starts from an idle context, so the old lesson's run
    // progress never counts for it.
    if (lesson.id !== lessonId) {
      if (lessonId !== null) ctx = IDLE_CTX
      lessonId = lesson.id
      opened = new Set()
    }
    // A lesson done before it had steps keeps its progress: every step passed.
    if (completed.includes(lesson.id) && !tracker.has(lesson.id)) tracker.completeAll(lesson.id)
    const steps = stepsFor(lesson)
    const record = tracker.get(lesson.id)
    const current = steps[record.current]
    if (current) {
      const progress = (ctx.sim && ctx.sim.progress) || {}
      for (const key of simKeys(current.check)) {
        if (progress[key] === true) tracker.latch(lesson.id, current.id, key)
      }
      const result = evaluate(current, stepCtx(lesson, tracker.get(lesson.id), current))
      const level = tracker.get(lesson.id).hintLevels[current.id] || 0
      if (result.passed) tracker.markPassed(lesson.id, current.id, { helped: level >= HELPED_LEVEL })
    }
    const passed = tracker.get(lesson.id).passed
    const allPassed = steps.length > 0 && steps.every((item) => passed.includes(item.id))
    if (allPassed && !course.getState().completed.includes(lesson.id) && !marked.has(lesson.id)) {
      marked.add(lesson.id)
      course.markComplete(lesson.id)
    }
  }

  function buildView() {
    const { lesson } = course.getState()
    const steps = stepsFor(lesson)
    const record = tracker.get(lesson.id)
    const index = Math.min(record.current, Math.max(0, steps.length - 1))
    const entries = steps.map((item, i) => {
      const passed = record.passed.includes(item.id)
      const status = i === index ? 'current' : passed ? 'done' : 'locked'
      const open = status === 'current' || (status === 'done' && opened.has(i))
      const result = status === 'locked' ? null : evaluate(item, stepCtx(lesson, record, item))
      return {
        step: item,
        status,
        passed,
        helped: record.helped.includes(item.id),
        open,
        result,
        answer: record.answers[item.id],
        hintLevel: record.hintLevels[item.id] || 0
      }
    })
    const currentEntry = entries[index]
    return {
      lesson,
      steps: entries,
      index,
      result: currentEntry ? currentEntry.result : null,
      // The 3D places, holes, pins and parts the current mistake is about, or null.
      targets: (currentEntry && currentEntry.result && currentEntry.result.feedback && currentEntry.result.feedback.targets) || null,
      passedNow: Boolean(currentEntry && currentEntry.passed),
      lessonDone: entries.length > 0 && entries.every((entry) => entry.passed)
    }
  }

  function keyOf(next) {
    return JSON.stringify({
      lessonId: next.lesson.id,
      index: next.index,
      steps: next.steps.map(({ status, passed, helped, open, result, answer, hintLevel }) => [status, passed, helped, open, result, answer, hintLevel]),
      passedNow: next.passedNow,
      lessonDone: next.lessonDone
    })
  }

  // Runs step() until nothing more changes (tracker and course changes made
  // inside it come back here), then notifies when the view changed.
  function sync() {
    if (syncing) {
      again = true
      return
    }
    syncing = true
    try {
      do {
        again = false
        step()
      } while (again)
    } finally {
      syncing = false
    }
    const next = buildView()
    const key = keyOf(next)
    view = next
    if (key === viewKey) return
    viewKey = key
    listeners.forEach((fn) => fn(view))
  }

  function update(nextCtx) {
    ctx = { ...IDLE_CTX, ...nextCtx }
    sync()
  }

  function currentStep() {
    const { lesson } = course.getState()
    const steps = stepsFor(lesson)
    return { lesson, steps, record: tracker.get(lesson.id), item: steps[tracker.get(lesson.id).current] }
  }

  // Records an answer to the current step's question. Allowed again and again
  // until the step passes (a wrong quiz answer never locks anything).
  function answer(stepId, option) {
    const { lesson, record, item } = currentStep()
    if (!item || item.id !== stepId || record.passed.includes(stepId)) return
    const options = (item.check && item.check.options) || []
    if (!Number.isInteger(option) || option < 0 || option >= options.length) return
    tracker.answer(lesson.id, stepId, option)
    sync()
  }

  // Moves on to the next step once the current one passed; nothing on the last.
  function next() {
    const { lesson, steps, record, item } = currentStep()
    if (!item || !record.passed.includes(item.id) || record.current >= steps.length - 1) return
    tracker.setCurrent(lesson.id, record.current + 1)
    sync()
  }

  // Opens or closes a done step's read only card.
  function toggleOpen(index) {
    const entry = view && view.steps[index]
    if (!entry || entry.status !== 'done') return
    if (opened.has(index)) opened.delete(index)
    else opened.add(index)
    sync()
  }

  // Raises the current step's hint level to at least level (0 to 3) while it
  // has not passed; it never goes down.
  function raiseHint(level) {
    const { lesson, record, item } = currentStep()
    if (!item || record.passed.includes(item.id) || !Number.isInteger(level)) return
    if ((record.hintLevels[item.id] || 0) >= level) return
    tracker.setHintLevel(lesson.id, item.id, level)
  }

  // Why Run is locked on the current step, or null.
  function runLock() {
    const { record, item } = currentStep()
    if (item && item.check && item.check.type === 'predict' && record.answers[item.id] === undefined) return GUESS_FIRST
    return null
  }

  function getView() {
    return view
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  course.subscribe(() => sync())
  tracker.subscribe(() => sync())
  sync()

  return { getView, update, answer, next, toggleOpen, raiseHint, runLock, subscribe }
}
