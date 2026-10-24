// Lesson 1.9 light sensor board. The photoresistor sits between 5 V and A0,
// with a 10 kohm resistor from A0 to GND, so more room light gives a higher
// reading. The sketch drives the D13 night light. Pure module, no DOM. Goal:
// the LED has turned on and back off since Run.
const FIXED_OHMS = 10000
const BRIGHT_OHMS = 1000
const DARK_OHMS = 1000000

// Photoresistor resistance for a room light level from 0 (dark) to 1 (bright),
// on a log scale from about 1 Mohm in the dark to 1 kohm in bright light.
export function ldrOhms(light) {
  const level = Math.min(1, Math.max(0, light))
  return BRIGHT_OHMS * (DARK_OHMS / BRIGHT_OHMS) ** (1 - level)
}

// A0 level (share of 5 V) at the divider middle.
export function dividerLevel(light) {
  return FIXED_OHMS / (FIXED_OHMS + ldrOhms(light))
}

export function createLightSim({ room }) {
  let raw = 0
  let ledOn = false
  let changes = 0

  function levels() {
    const level = dividerLevel(room.getLight())
    raw = Math.round(level * 1023)
    return { A0: level }
  }

  function output({ kind, pin, value }) {
    if (kind !== 'pin' || pin !== 'D13') return
    const on = value >= 0.5
    if (on !== ledOn) changes += 1
    ledOn = on
  }

  function checkGoal() {
    return changes >= 2
  }

  function readout() {
    return `A0 reads ${raw}, LED ${ledOn ? 'on' : 'off'}`
  }

  return { levels, output, checkGoal, readout }
}
