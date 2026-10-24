// Level 1 project sim, Room monitor. A sim day of DAY_MS (1 s per hour,
// starting at midnight) drives the room light and temperature. The monitor
// reads the photoresistor divider on A0 and the TMP36 on A1, lights the D13
// night light while A0 is under darkLevel, and sounds ALARM_HZ on D8 while the
// temperature is at or above alarmC (both params, live). Pure module, no DOM.
// Goal: one whole sim day with the LED on through the night, off through the
// day, the alarm on at the hottest hours and silent when cool.
import { dividerLevel } from './light.js'
import { tmp36Level, rawToC } from './temp.js'

export const DAY_MS = 24000
export const ALARM_HZ = 880
// Checked bands: outside them the monitor may do either.
export const NIGHT_LIGHT = 0.2
export const DAY_LIGHT = 0.5
export const HOT_C = 32
export const COOL_C = 28

// Room light (0 to 1) at an hour of the day: sun up from 6 to 18.
export function lightAt(hour) {
  const sun = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12))
  return 0.05 + 0.9 * sun
}

// Air temperature at an hour: 18 deg C at 3 am up to 34 deg C at 3 pm.
export function tempAt(hour) {
  return 26 + 8 * Math.sin(2 * Math.PI * (hour - 9) / 24)
}

export function createMonitorSim({ pins, tones, room, getValues, startedAt }) {
  let day = -1
  let dayOk = true
  let seen = null
  let passed = false
  let state = { hour: 0, light: 0, tempC: 0, led: false, alarm: false }

  function startDay(index) {
    day = index
    dayOk = true
    seen = { night: false, day: false, hot: false, cool: false }
  }

  function update(now) {
    const elapsed = Math.max(0, now - startedAt)
    const index = Math.floor(elapsed / DAY_MS)
    // A day that ran its full length with no mistakes and every band seen passes.
    if (index !== day) {
      if (day >= 0 && dayOk && Object.values(seen).every(Boolean)) passed = true
      startDay(index)
    }
    const hour = (elapsed % DAY_MS) / (DAY_MS / 24)
    room.setLight(lightAt(hour))
    room.setTempC(tempAt(hour))

    const values = getValues()
    const lightLevel = dividerLevel(room.getLight())
    const tempLevel = tmp36Level(room.getTempC())
    const lightRaw = Math.round(lightLevel * 1023)
    const tempC = rawToC(Math.round(tempLevel * 1023))
    const led = lightRaw < values.darkLevel
    const alarm = tempC >= values.alarmC

    const light = room.getLight()
    if (light <= NIGHT_LIGHT) {
      seen.night = true
      if (!led) dayOk = false
    }
    if (light >= DAY_LIGHT) {
      seen.day = true
      if (led) dayOk = false
    }
    if (tempC >= HOT_C) {
      seen.hot = true
      if (!alarm) dayOk = false
    }
    if (tempC <= COOL_C) {
      seen.cool = true
      if (alarm) dayOk = false
    }

    state = { hour, light, tempC, led, alarm }
    pins.set('A0', lightLevel)
    pins.set('A1', tempLevel)
    pins.set('D13', led ? 1 : 0)
    tones.set('D8', alarm ? ALARM_HZ : 0)
  }

  function stop() {
    pins.set('D13', 0)
    tones.set('D8', 0)
    room.reset()
  }

  function checkGoal() {
    return passed
  }

  function readout() {
    const hh = String(Math.floor(state.hour)).padStart(2, '0')
    const verdict = dayOk ? 'ok so far' : 'missed, try the next day'
    return `Day ${day + 1} ${hh}:00, light ${Math.round(state.light * 100)}%, ${state.tempC.toFixed(1)} deg C. ` +
      `LED ${state.led ? 'on' : 'off'}, alarm ${state.alarm ? 'on' : 'off'}. Day ${verdict}`
  }

  return { update, stop, checkGoal, readout }
}
