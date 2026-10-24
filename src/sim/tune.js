// Lesson 1.11 sound board: the sketch plays tones on the D8 buzzer. Pure
// module, no DOM. Goal: three notes in a row played the TARGET tune, E D C,
// each starting within PHRASE_GAP_MS of the one before, so a pause between
// loops breaks the phrase.
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
const PHRASE_GAP_MS = 600
const PIN = 'D8'

export function noteName(hz) {
  const note = NOTES.find((item) => item.hz === hz)
  return note ? note.name : `${hz} Hz`
}

export function createTuneSim() {
  let current = 0
  let starts = []
  let matched = false
  let played = 0

  function output({ kind, pin, value, at }) {
    if (kind !== 'tone' || pin !== PIN) return
    current = value
    if (value === 0) return
    played += 1
    const last = starts[starts.length - 1]
    if (last && at - last.at > PHRASE_GAP_MS) starts = []
    starts.push({ hz: value, at })
    if (starts.length > 3) starts.shift()
    if (starts.length === 3 && starts.every((note, i) => note.hz === TARGET[i])) matched = true
  }

  function checkGoal() {
    return matched
  }

  function readout() {
    const target = TARGET.map(noteName).join(' ')
    const now = current ? `tone(8, ${current}), note ${noteName(current)}` : 'Silent'
    return `${now}. Target tune ${target}`
  }

  function progress() {
    return { played: played >= 3 }
  }

  return { levels: () => ({}), output, checkGoal, readout, progress }
}
