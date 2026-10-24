// Lesson 1.7 PWM fade sim: the analogWrite value on D9 counts 0 to 255, then
// 255 to 0, one step every stepMs (read live), like the two for loops of the
// sketch, so one full fade takes 512 * stepMs. D9 level is value / 255.
// Pure module, no DOM. Goal: one complete fade (peak to peak or trough to
// trough through the other end) took MIN_FADE_MS to MAX_FADE_MS, and the
// current stepMs also gives a fade in that range.
const PIN = 'D9'
const MAX = 255
const STEPS = 2 * (MAX + 1)
export const MIN_FADE_MS = 1000
export const MAX_FADE_MS = 3000

function inRange(ms) {
  return ms >= MIN_FADE_MS && ms <= MAX_FADE_MS
}

export function createFadeSim({ pins, getValues, startedAt }) {
  let index = 0
  let value = 0
  let stepAt = startedAt
  // Arrival times at each end, oldest first; the run starts at the trough.
  const arrivals = [{ end: 0, at: startedAt }]
  let fadeSeen = false

  function stepMs() {
    return Math.max(1, getValues().stepMs)
  }

  function step(at) {
    index = (index + 1) % STEPS
    const next = index <= MAX ? index : STEPS - 1 - index
    if ((next === 0 || next === MAX) && next !== value) {
      arrivals.push({ end: next, at })
      if (arrivals.length > 3) arrivals.shift()
      // Ends alternate, so two arrivals back is the same end: one full fade.
      if (arrivals.length === 3 && inRange(at - arrivals[0].at)) fadeSeen = true
    }
    value = next
  }

  function update(now) {
    while (now - stepAt >= stepMs()) {
      stepAt += stepMs()
      step(stepAt)
    }
    pins.set(PIN, value / MAX)
  }

  function stop() {
    pins.set(PIN, 0)
  }

  function checkGoal() {
    return fadeSeen && inRange(STEPS * stepMs())
  }

  function readout() {
    return `analogWrite(9, ${value}), duty ${Math.round(value / MAX * 100)}%`
  }

  return { update, stop, checkGoal, readout }
}
