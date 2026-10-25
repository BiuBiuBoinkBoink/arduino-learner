// The bottom sheet's peek: the current step's kind and title on one line, a
// summary of its checklist ('2 of 3 done') and, once the step has passed, the
// success line with Continue (or the next lesson), so a learner can move on
// without opening the sheet. Rendered from the lesson flow view.
import { KIND_LABELS } from './guidePanel.js'

export function createSheetPeek({ container, flow, course }) {
  const line = document.createElement('p')
  line.className = 'peek-step'
  const kind = document.createElement('span')
  kind.className = 'step-kind'
  const title = document.createElement('span')
  title.className = 'peek-title'
  line.append(kind, title)
  const summary = document.createElement('p')
  summary.className = 'peek-summary'
  const success = document.createElement('div')
  success.className = 'peek-success'
  container.append(line, summary, success)

  let successKey = null

  function render(view) {
    const entry = view.steps[view.index]
    if (!entry) {
      line.hidden = true
      summary.hidden = true
      success.hidden = true
      return
    }
    line.hidden = false
    kind.textContent = KIND_LABELS[entry.step.kind] || entry.step.kind
    title.textContent = entry.step.title
    title.title = entry.step.title
    const items = entry.result && Array.isArray(entry.result.items) ? entry.result.items : []
    summary.hidden = items.length === 0
    summary.textContent = items.filter((item) => item.ok).length + ' of ' + items.length + ' done'
    renderSuccess(view, entry)
  }

  // Remade only when the passed step changes, so a focused Continue keeps focus.
  function renderSuccess(view, entry) {
    const key = entry.passed ? view.lesson.id + ':' + view.index : ''
    if (key === successKey) return
    successKey = key
    success.hidden = !entry.passed
    if (!entry.passed) {
      success.replaceChildren()
      return
    }
    const last = view.index === view.steps.length - 1
    const strong = document.createElement('strong')
    strong.className = 'peek-success-text'
    strong.textContent = last ? 'Lesson done' : 'Milestone done'
    const nodes = [strong]
    if (!last) {
      nodes.push(actionButton('Continue', () => flow.next()))
    } else {
      const { index, total } = course.getState()
      if (index < total - 1) {
        const next = course.lessons[index + 1]
        nodes.push(actionButton('Next lesson: ' + next.id + ' ' + next.title, () => course.next()))
      }
    }
    success.replaceChildren(...nodes)
  }

  render(flow.getView())
  flow.subscribe(render)
}

function actionButton(text, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'run-button success-next'
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}
