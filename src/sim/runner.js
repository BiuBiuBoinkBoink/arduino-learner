// Sim runner: idle -> uploading (fake upload) -> running -> idle on stop.
// Time only comes in through now; the runner never marks progress itself,
// it calls onGoal(lessonId) once per run when the sim goal first passes.
// Sims also get the shared inputs (held buttons); stop leaves them as they are.
export const UPLOAD_MS = 1500

export function createSimRunner({ sims, pins, inputs, onGoal, uploadMs = UPLOAD_MS }) {
  let phase = 'idle'
  let lessonId = null
  let getValues = null
  let runStart = 0
  let sim = null
  let goalMet = false

  function hasSim(id) {
    return Object.prototype.hasOwnProperty.call(sims, id)
  }

  function run(options) {
    if (phase !== 'idle' || !hasSim(options.lessonId)) return false
    lessonId = options.lessonId
    getValues = options.getValues
    runStart = options.now
    goalMet = false
    phase = 'uploading'
    return true
  }

  function tick(now) {
    if (phase === 'uploading') {
      if (now - runStart < uploadMs) return
      sim = sims[lessonId]({ pins, inputs, getValues, startedAt: now })
      phase = 'running'
    }
    if (phase !== 'running') return
    sim.update(now)
    if (!goalMet && typeof sim.checkGoal === 'function' && sim.checkGoal()) {
      goalMet = true
      onGoal(lessonId)
    }
  }

  function stop() {
    if (phase === 'running') {
      sim.stop()
      pins.reset()
    }
    sim = null
    phase = 'idle'
  }

  return {
    hasSim,
    run,
    tick,
    stop,
    getPhase: () => phase,
    isGoalMet: () => goalMet
  }
}
