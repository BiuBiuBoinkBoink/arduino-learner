// Lesson steps: the milestones inside a lesson. Lessons with their own steps
// return them; the others get one step made from the lesson goal text, which
// passes when the lesson goal is met (a legacy check).
import { splitGoal } from './goalText.js'

// Build and wire steps stay hidden until learners can place parts (phase 5).
export const BUILD_STEPS_ENABLED = false
const BUILD_KINDS = ['build', 'wire']

// Step kinds that open the code panel by default.
export const CODE_OPEN_KINDS = ['predict', 'run', 'code']

export const STEP_KINDS = ['learn', 'explore', 'build', 'wire', 'predict', 'run', 'code']

export function stepsFor(lesson) {
  if (lesson.steps) return lesson.steps.filter((step) => BUILD_STEPS_ENABLED || !BUILD_KINDS.includes(step.kind))
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

// True for a lesson whose steps are the one generated goal step.
export function hasGeneratedSteps(lesson) {
  return !lesson.steps
}
