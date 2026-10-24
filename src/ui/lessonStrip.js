// Bottom strip: prev and next buttons, one card per lesson and a progress bar.
// Renders from the course state only; lesson text comes from the course data.
export function createLessonStrip(strip, course) {
  const prevBtn = document.createElement('button')
  prevBtn.type = 'button'
  prevBtn.className = 'strip-nav'
  prevBtn.textContent = 'Prev'
  prevBtn.addEventListener('click', () => course.prev())

  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'strip-nav'
  nextBtn.textContent = 'Next'
  nextBtn.addEventListener('click', () => course.next())

  const list = document.createElement('div')
  list.className = 'lesson-cards'

  const cards = course.lessons.map((lesson) => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'lesson-card'
    const id = document.createElement('span')
    id.className = 'lesson-card-id'
    id.textContent = lesson.id
    const title = document.createElement('span')
    title.className = 'lesson-card-title'
    title.textContent = lesson.title
    const done = document.createElement('span')
    done.className = 'lesson-card-done'
    done.textContent = 'Done'
    const top = document.createElement('span')
    top.className = 'lesson-card-top'
    top.append(id, done)
    card.append(top, title)
    card.addEventListener('click', () => course.goTo(lesson.id))
    list.append(card)
    return { card, lesson }
  })

  const progressWrap = document.createElement('div')
  progressWrap.className = 'lesson-progress'
  const progress = document.createElement('progress')
  progress.setAttribute('aria-label', 'Lessons done')
  const progressText = document.createElement('span')
  progressWrap.append(progress, progressText)

  strip.append(prevBtn, list, nextBtn, progressWrap)

  let shownId = null

  function render(state) {
    const { lesson, index, completed, total } = state
    prevBtn.disabled = index === 0
    nextBtn.disabled = index === total - 1
    cards.forEach(({ card, lesson: item }) => {
      const isDone = completed.includes(item.id)
      card.classList.toggle('is-done', isDone)
      card.setAttribute('aria-label', item.id + ' ' + item.title + (isDone ? ', done' : ''))
      if (item.id === lesson.id) card.setAttribute('aria-current', 'true')
      else card.removeAttribute('aria-current')
    })
    progress.max = total
    progress.value = completed.length
    progressText.textContent = completed.length + ' of ' + total + ' done'
    if (lesson.id !== shownId) {
      shownId = lesson.id
      cards[index].card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

  render(course.getState())
  course.subscribe(render)
}
