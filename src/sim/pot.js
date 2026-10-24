// Lesson 1.6 potentiometer board: the wiper puts the pot1 knob value (a share
// of 5 V) on A0. The sketch prints what it reads. Pure module, no DOM. Goal:
// since Run, A0 has been at or below LOW_END and at or above HIGH_END (raw
// 0 to 1023), in any order.
const POT = 'pot1'
const LOW_END = 100
const HIGH_END = 920

export function createPotSim({ inputs }) {
  let raw = 0
  let seenLow = false
  let seenHigh = false

  function levels() {
    const level = inputs.getValue(POT)
    raw = Math.round(level * 1023)
    if (raw <= LOW_END) seenLow = true
    if (raw >= HIGH_END) seenHigh = true
    return { A0: level }
  }

  function checkGoal() {
    return seenLow && seenHigh
  }

  function readout() {
    return `A0 reads ${raw}, ${(raw * 5 / 1023).toFixed(2)} V`
  }

  function progress() {
    return { seenLow, seenHigh }
  }

  return { levels, checkGoal, readout, progress }
}
