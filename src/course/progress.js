// Course progress helpers for the course map.

// 'done' for a completed lesson, 'next' for the first lesson in course order
// that is not done, '' otherwise.
export function lessonStatus(lessons, completed, id) {
  if (completed.includes(id)) return 'done'
  const next = lessons.find((lesson) => !completed.includes(lesson.id))
  return next && next.id === id ? 'next' : ''
}
