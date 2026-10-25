// Auto nudge: on a lesson that is not a project, raise the current step's hint
// level to at least 1 (the hint box shows) when a mistake is shown, or after
// NUDGE_MS on the step with no checklist change and no workbench change.
// Pure module: the flow and the timer functions are passed in.
//
// createNudge({ flow, delayMs, setTimer, clearTimer }) -> { poke(), stop() }
// poke() is a workbench change: it starts the wait again.
export const NUDGE_MS = 40000

export function createNudge({ flow, delayMs = NUDGE_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null
  let stepKey = null
  let checklistKey = null

  function cancel() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  // The current step, or null when it passed, the lesson is a project or it
  // already shows a hint.
  function waiting(view) {
    const entry = view && view.steps[view.index]
    if (!entry || entry.passed || view.lesson.project || entry.hintLevel >= 1) return null
    return entry
  }

  function restart() {
    cancel()
    const view = flow.getView()
    if (!waiting(view)) return
    const key = stepKey
    timer = setTimer(() => {
      timer = null
      if (stepKey === key && waiting(flow.getView())) flow.raiseHint(1)
    }, delayMs)
  }

  function onView(view) {
    const entry = view.steps[view.index]
    const nextStep = view.lesson.id + ':' + view.index
    const nextChecklist = entry && entry.result ? entry.result.items.map((item) => item.ok).join() : ''
    const changed = nextStep !== stepKey || nextChecklist !== checklistKey
    stepKey = nextStep
    checklistKey = nextChecklist
    const current = waiting(view)
    if (!current) {
      cancel()
      return
    }
    const feedback = current.result && current.result.feedback
    if (feedback && feedback.tone === 'bad') {
      cancel()
      flow.raiseHint(1)
      return
    }
    if (changed || timer === null) restart()
  }

  const unsubscribe = flow.subscribe(onView)
  if (flow.getView()) onView(flow.getView())

  return {
    poke: restart,
    stop() {
      cancel()
      unsubscribe()
    }
  }
}
