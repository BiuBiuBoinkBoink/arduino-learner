// A running sketch with its hardware state: the glue between the interpreter
// and the outside world, kept free of Worker APIs so it can be unit tested.
// createSession(source, { random }) parses (throwing a CodeError) and returns
// { advance(untilMs) -> batch, setInputs(levels), sendSerial(text) }.
// Input levels are 0 to 1 per pin name, set by the circuit sim; a pin with no
// level reads its INPUT_PULLUP state (HIGH) or LOW. A batch holds what changed
// since the last advance: { pins, tones, servos, serial, millis, error }.
import { createProgram } from './interpreter.js'

export function createSession(source, { random = Math.random } = {}) {
  const modes = {}
  let levels = {}
  let input = ''
  let batch = null

  function fresh() {
    batch = { pins: {}, tones: {}, servos: {}, serial: '' }
  }
  fresh()

  const hw = {
    pinMode(pin, mode) {
      modes[pin] = mode
    },
    digitalWrite(pin, level) {
      batch.pins[pin] = level
    },
    analogWrite(pin, value) {
      batch.pins[pin] = value / 255
    },
    digitalRead(pin) {
      const level = levels[pin]
      if (level === undefined) return modes[pin] === 'INPUT_PULLUP' ? 1 : 0
      return level >= 0.5 ? 1 : 0
    },
    analogRead(pin) {
      const level = levels[pin] === undefined ? 0 : levels[pin]
      return Math.round(Math.min(1, Math.max(0, level)) * 1023)
    },
    tone(pin, hz) {
      batch.tones[pin] = hz
    },
    noTone(pin) {
      batch.tones[pin] = 0
    },
    servoWrite(pin, degrees) {
      batch.servos[pin] = degrees
    },
    serialWrite(text) {
      batch.serial += text
    },
    serialAvailable: () => input.length,
    serialRead() {
      if (input === '') return -1
      const code = input.charCodeAt(0)
      input = input.slice(1)
      return code
    },
    random
  }

  const program = createProgram(source, hw)

  function advance(untilMs) {
    const error = program.advance(untilMs)
    const out = { ...batch, millis: program.millis(), error: error ? { message: error.message, line: error.line } : null }
    fresh()
    return out
  }

  return {
    advance,
    setInputs(next) {
      levels = { ...levels, ...next }
    },
    sendSerial(text) {
      input += text + '\n'
    }
  }
}
