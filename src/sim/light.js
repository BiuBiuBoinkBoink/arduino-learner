// Lesson 1.9 light sensor sim. The photoresistor sits between 5 V and A0, with
// a 10 kohm resistor from A0 to GND, so more light gives a higher reading.
// D13 lights the LED while the reading is under the darkLevel param (live).
// Pure module, no DOM. Goal: the LED has turned on and back off since Run.
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

export function createLightSim({ pins, room, getValues }) {
  let raw = 0
  let ledOn = null
  let changes = 0

  function update() {
    const level = dividerLevel(room.getLight())
    raw = Math.round(level * 1023)
    const on = raw < getValues().darkLevel
    // The first update only records the state, so the LED must change twice.
    if (ledOn !== null && on !== ledOn) changes += 1
    ledOn = on
    pins.set('A0', level)
    pins.set('D13', on ? 1 : 0)
  }

  function stop() {
    pins.set('D13', 0)
  }

  function checkGoal() {
    return changes >= 2
  }

  function readout() {
    return `A0 reads ${raw}, LED ${ledOn ? 'on' : 'off'}`
  }

  return { update, stop, checkGoal, readout }
}
