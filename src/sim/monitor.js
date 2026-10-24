// Level 1 project board, Room monitor. A sim day of DAY_MS (1 s per hour,
// starting at midnight) drives the room light and temperature, which feed the
// photoresistor divider on A0 and the TMP36 on A1. The sketch drives the D13
// night light and the D8 alarm. Pure module, no DOM. Goal: one whole sim day
// with the LED on through the night, off through the day, the alarm on at the
// hottest hours and silent when cool. The sketch gets REACT_MS to respond, so
// a mistake counts only once it has lasted that long.
import { dividerLevel } from './light.js'
import { tmp36Level, rawToC } from './temp.js'

export const DAY_MS = 24000
// Checked bands: outside them the monitor may do either.
export const NIGHT_LIGHT = 0.2
export const DAY_LIGHT = 0.5
export const HOT_C = 32
export const COOL_C = 28
export const REACT_MS = 300

// Room light (0 to 1) at an hour of the day: sun up from 6 to 18.
export function lightAt(hour) {
  const sun = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12))
  return 0.05 + 0.9 * sun
}

// Air temperature at an hour: 18 deg C at 3 am up to 34 deg C at 3 pm.
export function tempAt(hour) {
  return 26 + 8 * Math.sin(2 * Math.PI * (hour - 9) / 24)
}

export function createMonitorSim({ pins, tones, room, startedAt }) {
  let day = -1
  let dayOk = true
  let seen = null
  let passed = false
  let hour = 0
  let tempC = 0
  let wrongSince = null

  function startDay(index) {
    day = index
    dayOk = true
    seen = { night: false, day: false, hot: false, cool: false }
    wrongSince = null
  }

  // Sets the room for the time of day and returns the sensor levels.
  function levels(now) {
    const elapsed = Math.max(0, now - startedAt)
    const index = Math.floor(elapsed / DAY_MS)
    // A day that ran its full length with no mistakes and every band seen passes.
    if (index !== day) {
      if (day >= 0 && dayOk && Object.values(seen).every(Boolean)) passed = true
      startDay(index)
    }
    hour = (elapsed % DAY_MS) / (DAY_MS / 24)
    room.setLight(lightAt(hour))
    room.setTempC(tempAt(hour))
    const tempLevel = tmp36Level(room.getTempC())
    tempC = rawToC(Math.round(tempLevel * 1023))
    return { A0: dividerLevel(room.getLight()), A1: tempLevel }
  }

  // Checks what the monitor is doing against the room right now.
  function update(now) {
    if (!seen) return
    const led = pins.get('D13') >= 0.5
    const alarm = tones.get('D8') > 0
    const light = room.getLight()
    let wrong = false
    if (light <= NIGHT_LIGHT) {
      seen.night = true
      if (!led) wrong = true
    }
    if (light >= DAY_LIGHT) {
      seen.day = true
      if (led) wrong = true
    }
    if (tempC >= HOT_C) {
      seen.hot = true
      if (!alarm) wrong = true
    }
    if (tempC <= COOL_C) {
      seen.cool = true
      if (alarm) wrong = true
    }
    if (!wrong) wrongSince = null
    else if (wrongSince === null) wrongSince = now
    else if (now - wrongSince > REACT_MS) dayOk = false
  }

  function stop() {
    room.reset()
  }

  function checkGoal() {
    return passed
  }

  function readout() {
    const hh = String(Math.floor(hour)).padStart(2, '0')
    const verdict = dayOk ? 'ok so far' : 'missed, try the next day'
    return `Day ${day + 1} ${hh}:00, light ${Math.round(room.getLight() * 100)}%, ${tempC.toFixed(1)} deg C. ` +
      `LED ${pins.get('D13') >= 0.5 ? 'on' : 'off'}, alarm ${tones.get('D8') > 0 ? 'on' : 'off'}. Day ${verdict}`
  }

  return { levels, update, stop, checkGoal, readout, progress: () => ({}) }
}
