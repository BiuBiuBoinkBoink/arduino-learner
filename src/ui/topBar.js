// Top bar: brand, level and lesson breadcrumb, step progress (one segment per
// lesson step and 'Step 2 of 3' or 'Done', from the lesson flow), Prev and
// Next, and the Course map button (the course map keeps its aria-expanded in sync).
export function createTopBar(container, course, { levels, onOpenMap, flow }) {
  const brand = document.createElement('span')
  brand.className = 'top-brand'
  brand.textContent = 'Robo Learn'

  const crumb = document.createElement('p')
  crumb.className = 'top-crumb'
  const levelText = document.createElement('span')
  const lessonText = document.createElement('strong')
  crumb.append(levelText, ' / ', lessonText)

  const progress = document.createElement('div')
  progress.className = 'top-steps'
  progress.setAttribute('role', 'group')
  const segments = document.createElement('span')
  segments.className = 'top-segments'
  segments.setAttribute('aria-hidden', 'true')
  const stepText = document.createElement('span')
  stepText.className = 'top-step-text'
  stepText.setAttribute('aria-hidden', 'true')
  progress.append(segments, stepText)

  const prevBtn = button('Prev', 'Previous lesson', () => course.prev())
  const nextBtn = button('Next', 'Next lesson', () => course.next())
  const nav = document.createElement('div')
  nav.className = 'top-nav'
  const mapButton = button('Course map', null, () => onOpenMap())
  mapButton.setAttribute('aria-haspopup', 'dialog')
  mapButton.setAttribute('aria-expanded', 'false')
  nav.append(prevBtn, nextBtn, mapButton)

  container.append(brand, crumb, progress, nav)

  function render({ lesson, index, total }) {
    const level = levels.find((item) => item.id === lesson.level)
    levelText.textContent = 'Level ' + lesson.level + (level ? ' ' + level.title : '')
    lessonText.textContent = lesson.id + ' ' + lesson.title
    prevBtn.disabled = index === 0
    nextBtn.disabled = index === total - 1
  }

  function renderSteps(view) {
    segments.replaceChildren(...view.steps.map((entry) => {
      const segment = document.createElement('span')
      const state = entry.passed ? 'done' : entry.status === 'current' ? 'current' : 'locked'
      segment.className = 'top-segment is-' + state
      return segment
    }))
    const label = view.lessonDone ? 'Lesson done' : 'Step ' + (view.index + 1) + ' of ' + view.steps.length
    stepText.textContent = view.lessonDone ? 'Done' : label
    progress.setAttribute('aria-label', label)
  }

  render(course.getState())
  course.subscribe(render)
  renderSteps(flow.getView())
  flow.subscribe(renderSteps)
  return { mapButton }
}

function button(text, label, onClick) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'top-button'
  el.textContent = text
  if (label) el.setAttribute('aria-label', label)
  el.addEventListener('click', onClick)
  return el
}
