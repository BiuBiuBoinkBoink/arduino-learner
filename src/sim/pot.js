// Lesson 1.6 potentiometer sim: A0 follows the pot1 knob, as a share of 5 V.
// Like the sketch, it prints the volts to Serial every PRINT_MS.
// Pure module, no DOM. Goal: since Run, update has seen A0 read at or below
// LOW_END and at or above HIGH_END, in any order.
import { createTicker } from './serial.js'

const POT = 'pot1'
const LOW_END = 100
const HIGH_END = 920
const PRINT_MS = 200

export function createPotSim({ pins, inputs, serial, startedAt = 0 }) {
  const ticker = createTicker(PRINT_MS, startedAt)
  let raw = 0
  let level = 0
  let seenLow = false
  let seenHigh = false

  function update(now) {
    level = inputs.getValue(POT)
    raw = Math.round(level * 1023)
    if (raw <= LOW_END) seenLow = true
    if (raw >= HIGH_END) seenHigh = true
    pins.set('A0', level)
    const prints = ticker.due(now)
    if (serial) for (let i = 0; i < prints; i++) serial.println((raw * 5 / 1023).toFixed(2))
  }

  function stop() {
    pins.set('A0', 0)
  }

  function checkGoal() {
    return seenLow && seenHigh
  }

  function readout() {
    return `A0 reads ${raw}, ${(raw * 5 / 1023).toFixed(2)} V`
  }

  return { update, stop, checkGoal, readout }
}
