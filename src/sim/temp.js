// Lesson 1.10 temperature board: the TMP36 outputs 0.5 V at 0 deg C plus 10 mV
// per degree on A0. The sketch prints deg C. Pure module, no DOM. Goal: since
// Run, the reading (to the nearest degree) has been at or below COOL_C and at
// or above WARM_C, in any order.
const COOL_C = 15
const WARM_C = 30

// A0 level (share of 5 V) for an air temperature.
export function tmp36Level(tempC) {
  return (0.5 + tempC / 100) / 5
}

// deg C from a raw 0 to 1023 reading, as the sketch computes it.
export function rawToC(raw) {
  return (raw * 5 / 1023 - 0.5) * 100
}

export function createTempSim({ room }) {
  let raw = 0
  let seenCool = false
  let seenWarm = false

  function levels() {
    const level = tmp36Level(room.getTempC())
    raw = Math.round(level * 1023)
    // Whole degrees, so the 4.9 mV ADC step does not push 15 deg C to 15.05.
    const tempC = Math.round(rawToC(raw))
    if (tempC <= COOL_C) seenCool = true
    if (tempC >= WARM_C) seenWarm = true
    return { A0: level }
  }

  function checkGoal() {
    return seenCool && seenWarm
  }

  function readout() {
    return `A0 reads ${raw}, ${rawToC(raw).toFixed(1)} deg C`
  }

  function progress() {
    return { seenCool, seenWarm }
  }

  return { levels, checkGoal, readout, progress }
}
