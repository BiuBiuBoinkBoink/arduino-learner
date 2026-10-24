// Top bar: brand, level and lesson breadcrumb, a Done pill, Prev and Next,
// and the Course map button (the course map keeps its aria-expanded in sync).
export function createTopBar(container, course, { levels, onOpenMap }) {
  const brand = document.createElement('span')
  brand.className = 'top-brand'
  brand.textContent = 'Robo Learn'

  const crumb = document.createElement('p')
  crumb.className = 'top-crumb'
  const levelText = document.createElement('span')
  const lessonText = document.createElement('strong')
  crumb.append(levelText, ' / ', lessonText)

  const pill = document.createElement('span')
  pill.className = 'top-pill'
  pill.textContent = 'Done'
  pill.hidden = true

  const prevBtn = button('Prev', 'Previous lesson', () => course.prev())
  const nextBtn = button('Next', 'Next lesson', () => course.next())
  const nav = document.createElement('div')
  nav.className = 'top-nav'
  const mapButton = button('Course map', null, () => onOpenMap())
  mapButton.setAttribute('aria-haspopup', 'dialog')
  mapButton.setAttribute('aria-expanded', 'false')
  nav.append(prevBtn, nextBtn, mapButton)

  container.append(brand, crumb, pill, nav)

  function render({ lesson, index, completed, total }) {
    const level = levels.find((item) => item.id === lesson.level)
    levelText.textContent = 'Level ' + lesson.level + (level ? ' ' + level.title : '')
    lessonText.textContent = lesson.id + ' ' + lesson.title
    pill.hidden = !completed.includes(lesson.id)
    prevBtn.disabled = index === 0
    nextBtn.disabled = index === total - 1
  }

  render(course.getState())
  course.subscribe(render)
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
