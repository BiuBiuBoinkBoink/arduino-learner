// Course map: a popover under the top bar listing every lesson by level, with
// overall progress. Lessons are never locked; the first not done lesson is
// marked Up next. Escape or a click outside closes it; arrow keys move focus.
import { lessonStatus } from '../course/progress.js'

const STATUS_TEXT = { done: 'Done', next: 'Up next', '': '' }

export function createCourseMap({ container, course, levels, button }) {
  const map = document.createElement('div')
  map.id = 'course-map'
  map.setAttribute('role', 'dialog')
  map.setAttribute('aria-label', 'Course map')
  map.hidden = true

  const heading = document.createElement('h2')
  heading.className = 'map-heading'
  heading.textContent = 'Course map'
  const progressText = document.createElement('p')
  progressText.className = 'map-progress-text'
  const progress = document.createElement('progress')
  progress.className = 'map-progress'
  progress.setAttribute('aria-label', 'Lessons done')
  const sections = document.createElement('div')
  const more = document.createElement('p')
  more.className = 'map-more'
  more.textContent = 'More levels arrive as they are built.'
  map.append(heading, progressText, progress, sections, more)
  container.append(map)

  let buttons = []

  function render({ lesson: current, completed, total }) {
    progressText.textContent = completed.length + ' of ' + total + ' lessons done'
    progress.max = total
    progress.value = completed.length
    buttons = []
    sections.replaceChildren(...levels.map((level) => {
      const items = course.lessons.filter((lesson) => lesson.level === level.id)
      if (items.length === 0) return null
      const section = document.createElement('section')
      section.className = 'map-level'
      const title = document.createElement('h3')
      title.className = 'map-level-title'
      title.textContent = 'Level ' + level.id + ' ' + level.title
      const list = document.createElement('ul')
      list.className = 'map-lessons'
      for (const lesson of items) {
        const status = lessonStatus(course.lessons, completed, lesson.id)
        const item = document.createElement('li')
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'map-lesson'
        if (status) btn.classList.add('is-' + status)
        if (lesson.id === current.id) btn.setAttribute('aria-current', 'true')
        const id = document.createElement('span')
        id.className = 'map-lesson-id'
        id.textContent = lesson.id
        const name = document.createElement('span')
        name.className = 'map-lesson-title'
        name.textContent = lesson.title
        const state = document.createElement('span')
        state.className = 'map-lesson-status'
        state.textContent = STATUS_TEXT[status]
        btn.append(id, name, state)
        btn.addEventListener('click', () => {
          course.goTo(lesson.id)
          close(false)
        })
        btn.addEventListener('keydown', (event) => moveFocus(event, btn))
        buttons.push(btn)
        item.append(btn)
        list.append(item)
      }
      section.append(title, list)
      return section
    }).filter(Boolean))
  }

  function moveFocus(event, btn) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const index = buttons.indexOf(btn)
    const next = event.key === 'ArrowDown'
      ? Math.min(buttons.length - 1, index + 1)
      : Math.max(0, index - 1)
    buttons[next].focus()
  }

  function open() {
    map.hidden = false
    button.setAttribute('aria-expanded', 'true')
    const current = buttons.find((btn) => btn.getAttribute('aria-current') === 'true')
    if (current) {
      current.focus()
      current.scrollIntoView({ block: 'nearest' })
    }
  }

  function close(returnFocus = true) {
    if (map.hidden) return
    map.hidden = true
    button.setAttribute('aria-expanded', 'false')
    if (returnFocus) button.focus()
  }

  map.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    close()
  })
  document.addEventListener('pointerdown', (event) => {
    if (map.hidden || map.contains(event.target) || button.contains(event.target)) return
    close(false)
  })

  render(course.getState())
  course.subscribe(render)
  return { open, close, isOpen: () => !map.hidden }
}
