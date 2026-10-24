// Lesson 1.12 servo board: the sketch commands the servo on D9 with
// arm.write(angle); the arm moves there at SPEED_DEG_PER_MS, like an SG90
// (about 0.1 s per 60 deg), and its angle goes into the servos store. Pure
// module, no DOM. Goal: since Run the arm has come to rest at each TARGETS
// angle while commanded there, in any order.
export const TARGETS = [45, 90, 135]
export const SPEED_DEG_PER_MS = 0.6
const PIN = 'D9'
const SETTLE_DEG = 1

export function createSweepSim({ servos, startedAt }) {
  let arm = servos.get(PIN)
  let commanded = null
  let last = startedAt
  const reached = new Set()

  function output({ kind, pin, value }) {
    if (kind === 'servo' && pin === PIN) commanded = value
  }

  function update(now) {
    const step = SPEED_DEG_PER_MS * Math.max(0, now - last)
    last = now
    if (commanded === null) return
    const diff = commanded - arm
    arm = Math.abs(diff) <= step ? commanded : arm + Math.sign(diff) * step
    for (const target of TARGETS) {
      if (Math.abs(arm - target) <= SETTLE_DEG && commanded === target) reached.add(target)
    }
    servos.set(PIN, arm)
  }

  function checkGoal() {
    return TARGETS.every((target) => reached.has(target))
  }

  function readout() {
    const left = TARGETS.filter((target) => !reached.has(target))
    const rest = left.length ? `Targets left: ${left.join(', ')}` : 'All targets reached'
    const command = commanded === null ? 'not attached' : `arm.write(${commanded})`
    return `${command}, arm at ${Math.round(arm)} deg. ${rest}`
  }

  return { levels: () => ({}), output, update, checkGoal, readout }
}
