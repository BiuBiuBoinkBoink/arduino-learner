// A running sketch with its hardware state: the glue between the interpreter
// and the outside world, kept free of Worker APIs so it can be unit tested.
// createSession(source, { random }) parses (throwing a CodeError) and returns
// { advance(untilMs) -> batch, setInputs(levels), sendSerial(text) }.
// Input levels are 0 to 1 per pin name, set by the circuit; null means the
// circuit does not drive the pin, so it reads its INPUT_PULLUP state (HIGH)
// or LOW. A batch holds what happened since the last advance:
// { pins, tones, servos } (the last value of each), events (every change in
// order, as [ms, kind, pin, value] with kind 'pin', 'tone' or 'servo', plus
// 'input' when the circuit changes an input level, at the time the sketch
// first sees it),
// serial text, millis and error.
import { createProgram } from './interpreter.js'

export function createSession(source, { random = Math.random } = {}) {
  const modes = {}
  const last = {}
  const toneEnds = {}
  let levels = {}
  let input = ''
  let batch = null
  let program = null

  function fresh() {
    batch = { pins: {}, tones: {}, servos: {}, events: [], serial: '' }
  }
  fresh()

  // Ends every timed tone due by time t, at its own end time.
  function flushToneEnds(t) {
    for (const pin of Object.keys(toneEnds)) {
      if (toneEnds[pin] !== null && toneEnds[pin] <= t) {
        const end = toneEnds[pin]
        toneEnds[pin] = null
        record('tone', pin, 0, end)
      }
    }
  }

  // Records a change of an output, after any tone that ended before it.
  function emit(kind, pin, value, at = program.millis()) {
    flushToneEnds(at)
    record(kind, pin, value, at)
  }

  // Records a change of an output, once per real change.
  function record(kind, pin, value, at) {
    const key = `${kind}:${pin}`
    if (last[key] === value) return
    last[key] = value
    batch[kind === 'pin' ? 'pins' : `${kind}s`][pin] = value
    batch.events.push([at, kind, pin, value])
  }

  const hw = {
    pinMode(pin, mode) {
      modes[pin] = mode
    },
    digitalWrite(pin, level) {
      emit('pin', pin, level)
    },
    analogWrite(pin, value) {
      emit('pin', pin, value / 255)
    },
    digitalRead(pin) {
      const level = levels[pin]
      if (level === undefined || level === null) return modes[pin] === 'INPUT_PULLUP' ? 1 : 0
      return level >= 0.5 ? 1 : 0
    },
    analogRead(pin) {
      const level = levels[pin] === undefined || levels[pin] === null ? 0 : levels[pin]
      return Math.round(Math.min(1, Math.max(0, level)) * 1023)
    },
    // A tone with a duration stops by itself, like on the Uno.
    tone(pin, hz, ms) {
      emit('tone', pin, hz)
      toneEnds[pin] = ms ? program.millis() + ms : null
    },
    noTone(pin) {
      emit('tone', pin, 0)
      toneEnds[pin] = null
    },
    servoWrite(pin, degrees) {
      emit('servo', pin, degrees)
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

  program = createProgram(source, hw)

  function advance(untilMs) {
    const error = program.advance(untilMs)
    // Tones whose time ran out in this slice end at their own time.
    flushToneEnds(program.millis())
    const out = { ...batch, millis: program.millis(), error: error ? { message: error.message, line: error.line } : null }
    fresh()
    return out
  }

  return {
    advance,
    setInputs(next) {
      for (const [pin, level] of Object.entries(next)) {
        const before = levels[pin] === undefined ? null : levels[pin]
        const after = level === undefined ? null : level
        if (before !== after) batch.events.push([program.millis(), 'input', pin, after])
      }
      levels = { ...levels, ...next }
    },
    sendSerial(text) {
      input += text + '\n'
    }
  }
}
