// Guide panel: lesson header, the lesson steps as cards and a closed Reference
// drawer at the bottom whose body hosts the info tabs. Every lesson has one
// generated step for now; the card shows the intro text and the goal box, plus
// a success box once the lesson is done.
import { stepsFor } from '../course/steps.js'
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

export function createGuidePanel(container, course) {
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

  const reference = document.createElement('details')
  reference.className = 'guide-reference'
  const referenceSummary = document.createElement('summary')
  referenceSummary.textContent = 'Reference'
  const referenceBody = document.createElement('div')
  referenceBody.className = 'guide-reference-body'
  reference.append(referenceSummary, referenceBody)

  container.append(header, steps, reference)

  function render({ lesson, index, completed, total }) {
    eyebrow.textContent = 'Lesson ' + lesson.id
    title.textContent = lesson.title
    summary.textContent = lesson.summary
    const { intro, goal } = splitGoal(lesson.overview)
    const isDone = completed.includes(lesson.id)
    steps.replaceChildren(...stepsFor(lesson).map((step) => {
      const card = document.createElement('li')
      card.className = 'step-card is-open'
      const kind = document.createElement('p')
      kind.className = 'step-kind'
      kind.textContent = KIND_LABELS[step.kind] || step.kind
      const name = document.createElement('h3')
      name.className = 'step-title'
      name.textContent = step.title
      card.append(kind, name, ...intro.map(paragraph))
      // The tour step has no goal sentence; its own body says what to do.
      const goalText = goal || step.body.join(' ')
      if (goalText) {
        const box = document.createElement('div')
        box.className = 'goal-box'
        const label = document.createElement('p')
        label.className = 'goal-label'
        label.textContent = 'Goal'
        box.append(label, paragraph(goalText))
        card.append(box)
      }
      if (isDone) card.append(successBox(lesson, index, total))
      return card
    }))
  }

  function successBox(lesson, index, total) {
    const box = document.createElement('div')
    box.className = 'success-box'
    box.append(paragraph('Lesson done.'))
    if (index < total - 1) {
      const next = course.lessons[index + 1]
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'run-button success-next'
      btn.textContent = 'Next lesson: ' + next.id + ' ' + next.title
      btn.addEventListener('click', () => course.next())
      box.append(btn)
    }
    return box
  }

  render(course.getState())
  course.subscribe(render)
  return { referenceBody }
}

function paragraph(text) {
  const p = document.createElement('p')
  p.className = 'panel-text'
  p.textContent = text
  return p
}
