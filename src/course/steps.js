// Lesson steps: the milestones inside a lesson. Lessons with their own steps
// return them; the others get one step made from the lesson goal text, which
// passes when the lesson goal is met (a legacy check).
import { splitGoal } from './goalText.js'

// Build and wire steps show while this is true; false hides them (and main.js
// then opens every lesson with its whole circuit built).
export const BUILD_STEPS_ENABLED = true
export const BUILD_KINDS = ['build', 'wire']

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

// The step scope: the lesson's prebuilt ids, then the parts of this build or
// wire step and every build or wire step before it, without repeats. diagnose and the level 0 hints look at these parts only.
export function scopeFor(lesson, stepIndex) {
  const steps = stepsFor(lesson)
  const ids = [...(Array.isArray(lesson.prebuilt) ? lesson.prebuilt : [])]
  steps.slice(0, Math.max(0, stepIndex + 1)).forEach((step) => {
    if (BUILD_KINDS.includes(step.kind) && Array.isArray(step.parts)) ids.push(...step.parts)
  })
  return [...new Set(ids)]
}
