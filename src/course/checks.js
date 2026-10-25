// Step checks: evaluate(step, ctx) -> { passed, items, feedback } says whether
// a lesson step passes, the checklist under "To pass" ([{ text, ok }]) and an
// optional feedback line ({ tone: 'good' | 'bad' | 'info', text }). Pure module.
// ctx: { lessonId, lessonCompleted, answers, latched, sim: { phase, progress },
// code: { error }, tour: { complete }, events, build, reference, scope, attempts,
// busy, stepPassed }. Sim items latch: a key reported once while the step was
// current (ctx.latched) stays ok after Stop. Tour and event items of a step
// stored as passed (ctx.stepPassed) stay ok, since tours and events live in
// memory only.
import { createRuleContext, evaluateRule } from '../circuits/rules.js'
import { diagnose } from '../circuits/netlist.js'

export const CHECK_TYPES = ['legacy', 'quiz', 'predict', 'sim', 'code', 'tour', 'event', 'circuit', 'all']

const RUN_AND_WATCH = 'Now press Run and watch.'
// A lesson with no reference circuit (1.1) checks its item rules against an
// empty one, so only rules that need no answer key can pass there.
const EMPTY_REFERENCE = { parts: [], wires: [] }

export function evaluate(step, ctx) {
  return check(step.check, step, ctx)
}

// The sim progress key of a sim check: its progress name, or 'goal'.
export function simKey(simCheck) {
  return simCheck.goal ? 'goal' : simCheck.progress
}

// Every sim key a check looks at, inner checks included.
export function simKeys(spec) {
  if (!spec) return []
  if (spec.type === 'sim') return [simKey(spec)]
  if (spec.type === 'predict') return simKeys(spec.then)
  if (spec.type === 'all') return spec.checks.flatMap(simKeys)
  return []
}

// Circuit results by build object, then by step and scope: the flow evaluates
// done steps on every run frame, and the build object only changes on an edit.
const circuitCache = new WeakMap()

function circuitResult(spec, step, ctx) {
  const build = ctx.build || { parts: [], wires: [] }
  const reference = ctx.reference || EMPTY_REFERENCE
  const scope = Array.isArray(ctx.scope) ? ctx.scope : []
  const key = step.id + '|' + scope.join()
  let byStep = circuitCache.get(build)
  if (!byStep || byStep.reference !== reference) {
    byStep = { reference, results: new Map() }
    circuitCache.set(build, byStep)
  }
  if (byStep.results.has(key)) return byStep.results.get(key)
  // One rule context per evaluation: the build is aligned once.
  const rules = createRuleContext(build, reference)
  const items = spec.items.map((item) => ({ text: item.text, ok: evaluateRule(item.rule, rules) }))
  const passed = items.every((item) => item.ok) && (!spec.pass || evaluateRule(spec.pass, rules))
  let first
  // Build steps name mistakes in the scope only; wire steps look at everything.
  const mistake = () => {
    if (first === undefined) first = diagnose(build, reference, step.kind === 'build' ? { only: scope } : {})[0] || null
    return first
  }
  const entry = { items, passed, mistake }
  byStep.results.set(key, entry)
  return entry
}

function result(passed, items, feedback = null) {
  return { passed, items, feedback }
}

function check(spec, step, ctx) {
  const answers = ctx.answers || {}
  switch (spec && spec.type) {
    case 'legacy': {
      const ok = Boolean(ctx.lessonCompleted)
      return result(ok, [{ text: 'Meet the goal', ok }])
    }
    case 'quiz': {
      const picked = answers[step.id]
      const ok = picked === spec.answer
      let feedback = null
      if (picked !== undefined) feedback = ok ? { tone: 'good', text: spec.explain[spec.answer] } : { tone: 'bad', text: spec.explain[picked] }
      return result(ok, [{ text: 'Answer the question', ok }], feedback)
    }
    case 'predict': {
      const picked = answers[step.id]
      const guessed = picked !== undefined
      const then = check(spec.then, step, ctx)
      const passed = guessed && then.passed
      let feedback = null
      if (passed) feedback = picked === spec.answer ? { tone: 'good', text: spec.explain[spec.answer] } : { tone: 'info', text: spec.explain[picked] }
      else if (guessed) feedback = { tone: 'info', text: RUN_AND_WATCH }
      return result(passed, [{ text: 'Make a guess', ok: guessed }, ...then.items], feedback)
    }
    case 'sim': {
      const key = simKey(spec)
      const progress = (ctx.sim && ctx.sim.progress) || {}
      const ok = progress[key] === true || (ctx.latched || []).includes(key)
      return result(ok, [{ text: spec.text, ok }])
    }
    case 'code': {
      const error = ctx.code ? ctx.code.error : null
      const ok = !error
      const feedback = ok ? null : { tone: 'bad', text: 'The sketch does not compile. ' + error.message }
      return result(ok, [{ text: spec.text, ok }], feedback)
    }
    case 'tour': {
      const ok = Boolean(ctx.stepPassed || (ctx.tour && ctx.tour.complete))
      return result(ok, [{ text: spec.text, ok }])
    }
    case 'event': {
      // ctx.events counts what the learner did while this step was current: a
      // Set of places for strip-hover, numbers for part-moved and part-returned.
      const events = ctx.events || {}
      const items = spec.items.map((item) => {
        const value = events[item.event]
        const count = value instanceof Set ? value.size : Number.isFinite(value) ? value : 0
        return { text: item.text, ok: Boolean(ctx.stepPassed) || count >= item.count }
      })
      return result(items.every((item) => item.ok), items)
    }
    case 'circuit': {
      const { items, passed, mistake } = circuitResult(spec, step, ctx)
      let feedback = null
      // A mistake shows only after the learner changed the build on this step,
      // and not while a part or wire is in their hand.
      if (!passed && ctx.attempts > 0 && !ctx.busy) {
        const found = mistake()
        if (found) feedback = { tone: 'bad', text: found.text, targets: found.targets }
      }
      return result(passed, items.map((item) => ({ ...item })), feedback)
    }
    case 'all': {
      const inner = spec.checks.map((item) => check(item, step, ctx))
      const feedback = inner.map((item) => item.feedback).find((item) => item !== null) || null
      return result(inner.every((item) => item.passed), inner.flatMap((item) => item.items), feedback)
    }
    default:
      return result(false, [])
  }
}
