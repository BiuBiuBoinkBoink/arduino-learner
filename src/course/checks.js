// Step checks: evaluate(step, ctx) -> { passed, items, feedback } says whether
// a lesson step passes, the checklist under "To pass" ([{ text, ok }]) and an
// optional feedback line ({ tone: 'good' | 'bad' | 'info', text }). Pure module.
// ctx: { lessonId, lessonCompleted, answers, latched, sim: { phase, progress },
// code: { error }, tour: { complete } }. Sim items latch: a key reported once
// while the step was current (ctx.latched) stays ok after Stop.
export const CHECK_TYPES = ['legacy', 'quiz', 'predict', 'sim', 'code', 'tour', 'all']

const RUN_AND_WATCH = 'Now press Run and watch.'

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
      const ok = Boolean(ctx.tour && ctx.tour.complete)
      return result(ok, [{ text: spec.text, ok }])
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
