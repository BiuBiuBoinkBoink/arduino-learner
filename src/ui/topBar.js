// Top bar: brand, level and lesson breadcrumb, step progress (one segment per
// lesson step and 'Step 2 of 3' or 'Done', from the lesson flow), Prev and
// Next, and the Course map button (the course map keeps its aria-expanded in sync).
// Compact layout CSS hides the brand, the level and the segments, and shows
// Prev and Next as chevrons (their text is in a span, the icon beside it).
export function createTopBar(container, course, { levels, onOpenMap, flow }) {
  const brand = document.createElement('span')
  brand.className = 'top-brand'
  brand.textContent = 'Robo Learn'

  const crumb = document.createElement('p')
  crumb.className = 'top-crumb'
  const levelText = document.createElement('span')
  levelText.className = 'top-crumb-level'
  const separator = document.createElement('span')
  separator.className = 'top-crumb-level'
  separator.textContent = ' / '
  const lessonText = document.createElement('strong')
  crumb.append(levelText, separator, lessonText)

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

  const prevBtn = button('Prev', 'Previous lesson', () => course.prev(), 'M10 3L5 8l5 5')
  const nextBtn = button('Next', 'Next lesson', () => course.next(), 'M6 3l5 5-5 5')
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

const SVG_NS = 'http://www.w3.org/2000/svg'

// A top bar button; with an icon path it gets a chevron the compact layout
// shows in place of the text.
function button(text, label, onClick, iconPath = null) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'top-button'
  if (iconPath) {
    el.classList.add('has-icon')
    const words = document.createElement('span')
    words.className = 'top-button-text'
    words.textContent = text
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', 'top-button-icon')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', iconPath)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '1.8')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.append(path)
    el.append(svg, words)
  } else {
    el.textContent = text
  }
  if (label) el.setAttribute('aria-label', label)
  el.addEventListener('click', onClick)
  return el
}
