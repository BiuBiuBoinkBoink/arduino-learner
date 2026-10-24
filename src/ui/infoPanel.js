// Info panel: current lesson heading and summary. Tabs come in a later job.
export function createInfoPanel(panel, course) {
  const heading = document.createElement('h2')
  heading.className = 'panel-heading'
  const summary = document.createElement('p')
  summary.className = 'panel-text'
  panel.append(heading, summary)

  function render({ lesson }) {
    heading.textContent = lesson.id + ' ' + lesson.title
    summary.textContent = lesson.summary
  }

  render(course.getState())
  course.subscribe(render)
}
