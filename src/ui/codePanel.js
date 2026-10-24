// Code panel: heading plus the current lesson. Sketch content comes later.
export function createCodePanel(panel, course) {
  const heading = document.createElement('h2')
  heading.className = 'panel-heading'
  heading.textContent = 'Code'
  const lessonLine = document.createElement('p')
  lessonLine.className = 'panel-text'
  panel.append(heading, lessonLine)

  function render({ lesson }) {
    lessonLine.textContent = lesson.id + ' ' + lesson.title
  }

  render(course.getState())
  course.subscribe(render)
}
