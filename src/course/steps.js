// Lesson steps: the milestones inside a lesson. Lessons with their own steps
// return them; the others get one step made from the lesson goal text.
import { splitGoal } from './goalText.js'

export function stepsFor(lesson) {
  if (lesson.steps) return lesson.steps
  if (lesson.tour) {
    return [{
      id: 'goal',
      kind: 'explore',
      title: 'Tour the board',
      body: ['Click each part of the Uno to see what it does.'],
      check: { type: 'legacy' }
    }]
  }
  const { goal } = splitGoal(lesson.overview)
  return [{ id: 'goal', kind: 'run', title: 'Goal', body: goal ? [goal] : [], check: { type: 'legacy' } }]
}
