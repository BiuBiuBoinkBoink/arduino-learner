// Lesson 1.11 sound sim: plays the three note params (Hz, read live at the
// start of each note) on D8 like the sketch: tone for NOTE_MS, delay(GAP_MS
// after it starts), then PAUSE_MS of silence after the third note. The tone
// frequency goes into the tones store (Hz per pin, 0 is silent). Pure module,
// no DOM. Goal: one loop played the TARGET tune, E D C, in order.
export const NOTES = [
  { name: 'C', hz: 262 },
  { name: 'D', hz: 294 },
  { name: 'E', hz: 330 },
  { name: 'F', hz: 349 },
  { name: 'G', hz: 392 },
  { name: 'A', hz: 440 },
  { name: 'B', hz: 494 }
]
export const TARGET = [330, 294, 262]
export const NOTE_MS = 300
export const STEP_MS = 350
export const PAUSE_MS = 1000
const PIN = 'D8'
const LOOP_MS = 3 * STEP_MS + PAUSE_MS

export function noteName(hz) {
  const note = NOTES.find((item) => item.hz === hz)
  return note ? note.name : `${hz} Hz`
}

export function createTuneSim({ tones, getValues, startedAt }) {
  let loopIndex = -1
  let played = []
  let current = 0
  let matched = false

  function update(now) {
    const elapsed = Math.max(0, now - startedAt)
    const loop = Math.floor(elapsed / LOOP_MS)
    const inLoop = elapsed - loop * LOOP_MS
    const step = Math.floor(inLoop / STEP_MS)
    if (loop !== loopIndex) {
      loopIndex = loop
      played = []
    }
    // Each note reads its param once, when it starts; a slow frame that skips a
    // note still records it, so the order is kept.
    const reached = Math.min(step, 2)
    while (played.length <= reached) {
      played.push(getValues()[`note${played.length + 1}`])
      if (played.length === 3 && played.every((value, i) => value === TARGET[i])) matched = true
    }
    const hz = step < 3 && inLoop - step * STEP_MS < NOTE_MS ? played[step] : 0
    current = hz
    tones.set(PIN, hz)
  }

  function stop() {
    tones.set(PIN, 0)
  }

  function checkGoal() {
    return matched
  }

  function readout() {
    const target = TARGET.map(noteName).join(' ')
    const now = current ? `tone(8, ${current}), note ${noteName(current)}` : 'Silent'
    return `${now}. Target tune ${target}`
  }

  return { update, stop, checkGoal, readout }
}
