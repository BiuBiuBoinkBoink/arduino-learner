// Guide panel: lesson header, the lesson steps from the lesson flow and a
// closed Reference drawer at the bottom whose body hosts the info tabs. Each
// step is a row (status icon, kind and title); the current step's card is
// always open, done steps open read only, locked steps are dimmed text. The
// current card shows the body, a question, the "To pass" checklist, feedback,
// a hint and, once passed, a success box with Continue or the next lesson.
// Re-rendering keeps keyboard focus on the same control, so a pass never
// moves focus; feedback and success sit in polite status regions.
import { hasGeneratedSteps } from '../course/steps.js'
import { splitGoal } from '../course/goalText.js'

const KIND_LABELS = {
  learn: 'Learn',
  explore: 'Explore',
  build: 'Build',
  wire: 'Wire',
  predict: 'Predict',
  run: 'Run',
  code: 'Code'
}
const SVG_NS = 'http://www.w3.org/2000/svg'
const RESTART = 'Start this lesson again'
const RESTART_CONFIRM = 'Click again to start over'
const CONFIRM_MS = 3000

export function createGuidePanel(container, { course, flow, tracker }) {
  const header = document.createElement('div')
  header.className = 'guide-header'
  const eyebrow = document.createElement('p')
  eyebrow.className = 'guide-eyebrow'
  const title = document.createElement('h2')
  title.className = 'guide-title'
  const summary = document.createElement('p')
  summary.className = 'guide-summary'
  header.append(eyebrow, title, summary)

  const steps = document.createElement('ol')
  steps.className = 'guide-steps'

  // Persistent live regions, moved into the current card on each render, so
  // only a real change of their text is announced.
  const feedbackRegion = document.createElement('div')
  feedbackRegion.className = 'step-live'
  feedbackRegion.setAttribute('role', 'status')
  const successRegion = document.createElement('div')
  successRegion.className = 'step-live'
  successRegion.setAttribute('role', 'status')
  let feedbackKey = ''
  let successKey = ''

  const restart = document.createElement('button')
  restart.type = 'button'
  restart.className = 'guide-restart'
  restart.textContent = RESTART
  let confirmTimer = null

  const reference = document.createElement('details')
  reference.className = 'guide-reference'
  const referenceSummary = document.createElement('summary')
  referenceSummary.textContent = 'Reference'
  const referenceBody = document.createElement('div')
  referenceBody.className = 'guide-reference-body'
  reference.append(referenceSummary, referenceBody)

  container.append(header, steps, restart, reference)

  let lessonId = null
  // Steps whose hint the learner opened, by step id; cleared on a lesson change.
  let hintsShown = new Set()

  function renderHeader({ lesson }) {
    eyebrow.textContent = 'Lesson ' + lesson.id
    title.textContent = lesson.title
    summary.textContent = lesson.summary
  }

  function render(view) {
    if (view.lesson.id !== lessonId) {
      lessonId = view.lesson.id
      hintsShown = new Set()
      cancelRestart()
    }
    const focusKey = document.activeElement && steps.contains(document.activeElement)
      ? document.activeElement.dataset.focusKey
      : null
    steps.replaceChildren(...view.steps.map((entry, index) => stepItem(view, entry, index)))
    if (focusKey) {
      const target = steps.querySelector(`[data-focus-key="${focusKey}"]`)
      if (target) target.focus()
    }
  }

  function stepItem(view, entry, index) {
    const { step, status } = entry
    const item = document.createElement('li')
    item.className = 'guide-step is-' + status
    const label = KIND_LABELS[step.kind] || step.kind
    const row = document.createElement(status === 'done' ? 'button' : 'div')
    row.className = 'guide-step-row'
    const kind = document.createElement('span')
    kind.className = 'step-kind'
    kind.textContent = label
    const name = document.createElement('span')
    name.className = 'step-title'
    name.textContent = step.title
    row.append(statusIcon(entry.passed ? 'done' : status), kind, name)
    if (status === 'done') {
      row.type = 'button'
      row.dataset.focusKey = 'row-' + index
      row.setAttribute('aria-expanded', String(entry.open))
      row.addEventListener('click', () => flow.toggleOpen(index))
    } else if (status === 'locked') {
      row.setAttribute('aria-label', step.title + ', locked')
    } else {
      row.tabIndex = -1
      row.dataset.focusKey = 'current'
    }
    item.append(row)
    if (entry.open) item.append(status === 'current' ? currentCard(view, entry, index) : doneCard(view, entry, index))
    return item
  }

  // Generated steps keep the phase 1 look: the lesson intro and a Goal box.
  function bodyNodes(lesson, step) {
    if (!hasGeneratedSteps(lesson)) return step.body.map(paragraph)
    const { intro, goal } = splitGoal(lesson.overview || [])
    // The tour step has no goal sentence; its own body says what to do.
    const goalText = goal || step.body.join(' ')
    const nodes = intro.map(paragraph)
    if (goalText) {
      const box = document.createElement('div')
      box.className = 'goal-box'
      const label = document.createElement('p')
      label.className = 'goal-label'
      label.textContent = 'Goal'
      box.append(label, paragraph(goalText))
      nodes.push(box)
    }
    return nodes
  }

  function currentCard(view, entry, index) {
    const { step, result } = entry
    const card = document.createElement('div')
    card.className = 'step-card'
    card.append(...bodyNodes(view.lesson, step))
    const question = questionNodes(entry, index, false)
    if (question) card.append(question)
    if (result) card.append(checklist(result.items))
    setFeedback(result ? result.feedback : null)
    card.append(feedbackRegion)
    if (step.hint && !entry.passed) card.append(hintNodes(step, index))
    setSuccess(view, entry)
    card.append(successRegion)
    return card
  }

  function doneCard(view, entry, index) {
    const card = document.createElement('div')
    card.className = 'step-card is-read-only'
    card.append(...bodyNodes(view.lesson, entry.step))
    const question = questionNodes(entry, index, true)
    if (question) card.append(question)
    if (entry.result) card.append(checklist(entry.result.items))
    if (entry.step.done) card.append(paragraph(entry.step.done))
    return card
  }

  // The question and one button per option, for quiz and predict steps.
  function questionNodes(entry, index, readOnly) {
    const { step, answer } = entry
    const check = step.check || {}
    if (check.type !== 'quiz' && check.type !== 'predict') return null
    const box = document.createElement('div')
    box.className = 'guide-question'
    const text = document.createElement('p')
    text.className = 'panel-text guide-question-text'
    text.textContent = check.question
    const options = document.createElement('div')
    options.className = 'guide-options'
    check.options.forEach((option, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'guide-option'
      button.textContent = option
      button.dataset.focusKey = 'option-' + index + '-' + i
      const picked = answer === i
      button.setAttribute('aria-pressed', String(picked))
      if (picked) {
        if (check.type === 'predict') button.classList.add('is-picked')
        else button.classList.add(i === check.answer ? 'is-right' : 'is-wrong')
      }
      if (readOnly || entry.passed) button.disabled = true
      else button.addEventListener('click', () => flow.answer(step.id, i))
      options.append(button)
    })
    box.append(text, options)
    return box
  }

  function checklist(items) {
    const box = document.createElement('div')
    box.className = 'step-checklist'
    const heading = document.createElement('p')
    heading.className = 'step-checklist-title'
    heading.textContent = 'To pass'
    const list = document.createElement('ul')
    list.append(...items.map((item) => {
      const li = document.createElement('li')
      li.className = item.ok ? 'is-ok' : ''
      const text = document.createElement('span')
      text.textContent = item.text
      li.append(checkIcon(item.ok), text)
      return li
    }))
    box.append(heading, list)
    return box
  }

  function hintNodes(step, index) {
    const box = document.createElement('div')
    box.className = 'step-hint'
    if (hintsShown.has(step.id)) {
      const text = document.createElement('p')
      text.className = 'panel-text step-hint-text'
      text.textContent = 'Hint: ' + step.hint
      box.append(text)
      return box
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'guide-text-button'
    button.textContent = 'Hint'
    button.dataset.focusKey = 'hint-' + index
    button.addEventListener('click', () => {
      hintsShown.add(step.id)
      render(flow.getView())
    })
    box.append(button)
    return box
  }

  function setFeedback(feedback) {
    const key = feedback ? feedback.tone + ':' + feedback.text : ''
    if (key === feedbackKey) return
    feedbackKey = key
    if (!feedback) {
      feedbackRegion.replaceChildren()
      return
    }
    const box = document.createElement('p')
    box.className = 'step-feedback is-' + feedback.tone
    box.textContent = feedback.text
    feedbackRegion.replaceChildren(box)
  }

  function setSuccess(view, entry) {
    const last = view.index === view.steps.length - 1
    const key = entry.passed ? view.lesson.id + ':' + view.index : ''
    if (key === successKey) return
    successKey = key
    if (!entry.passed) {
      successRegion.replaceChildren()
      return
    }
    const box = document.createElement('div')
    box.className = 'success-box'
    const strong = document.createElement('strong')
    strong.textContent = last ? 'Lesson done' : 'Milestone done'
    box.append(strong)
    if (entry.step.done) box.append(paragraph(entry.step.done))
    if (!last) {
      box.append(actionButton('Continue', 'continue', () => {
        flow.next()
        // The Continue button is gone; keep keyboard users on the new step.
        const row = steps.querySelector('[data-focus-key="current"]')
        if (row) row.focus()
      }))
    } else {
      const { index, total } = course.getState()
      if (index < total - 1) {
        const next = course.lessons[index + 1]
        box.append(actionButton('Next lesson: ' + next.id + ' ' + next.title, 'next-lesson', () => course.next()))
      } else {
        box.append(paragraph('You finished every lesson so far.'))
      }
    }
    successRegion.replaceChildren(box)
  }

  function actionButton(text, focusKey, onClick) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'run-button success-next'
    button.textContent = text
    button.dataset.focusKey = focusKey
    button.addEventListener('click', onClick)
    return button
  }

  // Two clicks within CONFIRM_MS start the lesson over; the course keeps it done.
  function cancelRestart() {
    clearTimeout(confirmTimer)
    confirmTimer = null
    restart.textContent = RESTART
  }

  restart.addEventListener('click', () => {
    if (confirmTimer === null) {
      restart.textContent = RESTART_CONFIRM
      confirmTimer = setTimeout(cancelRestart, CONFIRM_MS)
      return
    }
    cancelRestart()
    hintsShown = new Set()
    tracker.reset(course.getState().lesson.id)
  })

  renderHeader(course.getState())
  course.subscribe(renderHeader)
  render(flow.getView())
  flow.subscribe(render)
  return { referenceBody }
}

function paragraph(text) {
  const p = document.createElement('p')
  p.className = 'panel-text'
  p.textContent = text
  return p
}

function svg(className) {
  const el = document.createElementNS(SVG_NS, 'svg')
  el.setAttribute('class', className)
  el.setAttribute('width', '18')
  el.setAttribute('height', '18')
  el.setAttribute('viewBox', '0 0 18 18')
  el.setAttribute('aria-hidden', 'true')
  el.setAttribute('focusable', 'false')
  return el
}

function shape(name, attrs) {
  const el = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
  return el
}

function tick() {
  return shape('path', { class: 'icon-tick', d: 'M5 9.2 L7.8 12 L13 6.5' })
}

// Step status: done is a filled circle with a tick, current a ring with a dot,
// locked a small padlock.
function statusIcon(status) {
  const icon = svg('step-icon is-' + status)
  if (status === 'done') icon.append(shape('circle', { class: 'icon-fill', cx: 9, cy: 9, r: 8 }), tick())
  else if (status === 'current') icon.append(shape('circle', { class: 'icon-ring', cx: 9, cy: 9, r: 7 }), shape('circle', { class: 'icon-dot', cx: 9, cy: 9, r: 3 }))
  else icon.append(shape('path', { class: 'icon-shackle', d: 'M6.5 8 V6 a2.5 2.5 0 0 1 5 0 V8' }), shape('rect', { class: 'icon-body', x: 5, y: 8, width: 8, height: 6, rx: 1 }))
  return icon
}

// Checklist item: a filled circle with a tick when ok, a hollow circle when not.
function checkIcon(ok) {
  const icon = svg('check-icon' + (ok ? ' is-ok' : ''))
  if (ok) icon.append(shape('circle', { class: 'icon-fill', cx: 9, cy: 9, r: 8 }), tick())
  else icon.append(shape('circle', { class: 'icon-ring', cx: 9, cy: 9, r: 7 }))
  return icon
}
