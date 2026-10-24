// Lesson 1.7 PWM fade board: the sketch fades D9 with analogWrite. Pure
// module, no DOM. Goal: one complete fade, from one end (0 or 255) through the
// other end and back, took MIN_FADE_MS to MAX_FADE_MS on the sketch's clock.
const PIN = 'D9'
export const MIN_FADE_MS = 1000
export const MAX_FADE_MS = 3000
// Within half a step of an end counts as at the end.
const END = 0.5 / 255

export function createFadeSim() {
  let value = 0
  let atEnd = 0
  // Arrival times at each end, oldest first; the run starts at the low end.
  let arrivals = [{ end: 0, at: null }]
  let fadeSeen = false
  // Ends reached since Run, for progress: a ramp is one end then the other.
  let seenLow = false
  let seenHigh = false
  let rampSeen = false

  function output({ kind, pin, value: level, at }) {
    if (kind !== 'pin' || pin !== PIN) return
    value = Math.round(level * 255)
    const end = level <= END ? 0 : level >= 1 - END ? 1 : null
    if (end === 0) {
      if (seenHigh) rampSeen = true
      seenLow = true
    } else if (end === 1) {
      if (seenLow) rampSeen = true
      seenHigh = true
    }
    if (arrivals[0].at === null) arrivals[0].at = at
    if (end === null || end === atEnd) {
      if (end === null) atEnd = null
      return
    }
    atEnd = end
    const last = arrivals[arrivals.length - 1]
    if (last.end === end) return
    arrivals.push({ end, at })
    if (arrivals.length > 3) arrivals.shift()
    // Ends alternate, so two arrivals back is the same end: one full fade.
    if (arrivals.length === 3) {
      const took = at - arrivals[0].at
      if (took >= MIN_FADE_MS && took <= MAX_FADE_MS) fadeSeen = true
    }
  }

  function checkGoal() {
    return fadeSeen
  }

  function readout() {
    return `analogWrite(9, ${value}), duty ${Math.round(value / 255 * 100)}%`
  }

  // New code starts from 0 again, so a fade across the swap does not count.
  function reload() {
    atEnd = 0
    arrivals = [{ end: 0, at: null }]
  }

  function progress() {
    return { rampSeen }
  }

  return { levels: () => ({}), output, reload, checkGoal, readout, progress }
}
