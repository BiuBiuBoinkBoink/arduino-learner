// Lesson 1.12 servo sim: arm.write(angle) commands the servo on D9; the arm
// moves towards the angle param (read live) at SPEED_DEG_PER_MS, like an SG90
// (about 0.1 s per 60 deg). The arm angle goes into the servos store (deg per
// pin). Pure module, no DOM. Goal: since Run the arm has come to rest at each
// TARGETS angle, in any order.
export const TARGETS = [45, 90, 135]
export const SPEED_DEG_PER_MS = 0.6
const PIN = 'D9'
const SETTLE_DEG = 1

export function createSweepSim({ servos, getValues, startedAt }) {
  let arm = servos.get(PIN)
  let last = startedAt
  let commanded = arm
  const reached = new Set()

  function update(now) {
    commanded = Math.min(180, Math.max(0, getValues().angle))
    const step = SPEED_DEG_PER_MS * Math.max(0, now - last)
    last = now
    const diff = commanded - arm
    arm = Math.abs(diff) <= step ? commanded : arm + Math.sign(diff) * step
    for (const target of TARGETS) {
      if (Math.abs(arm - target) <= SETTLE_DEG && commanded === target) reached.add(target)
    }
    servos.set(PIN, arm)
  }

  // A servo holds its last angle when the sketch stops.
  function stop() {}

  function checkGoal() {
    return TARGETS.every((target) => reached.has(target))
  }

  function readout() {
    const left = TARGETS.filter((target) => !reached.has(target))
    const rest = left.length ? `Targets left: ${left.join(', ')}` : 'All targets reached'
    return `arm.write(${commanded}), arm at ${Math.round(arm)} deg. ${rest}`
  }

  return { update, stop, checkGoal, readout }
}
