// Part footprints: the part types, their terminals, and which breadboard holes
// each part's legs use for every way it can be placed. Pure module.
//
// A placed part is described by legs, hole names in terminal order, except the
// button, which has four legs [c r1, c+2 r1, c r2, c+2 r2]: terminal a is legs
// 0 and 2 (always joined inside the button), terminal b legs 1 and 3. Reference
// circuits give positions instead (anode and cathode, from and to, or at);
// legsOf turns either form into legs. Spans are in pitches.
import { BREADBOARD_COLUMNS, parseHole, isHole, holeName, rowAt, rowPitchZ } from './holes.js'

export const PART_TYPES = {
  led: { label: 'LED', terminals: ['anode', 'cathode'], polar: true, shape: 'pair' },
  resistor: { label: 'resistor', terminals: ['a', 'b'], polar: false, shape: 'bend', minSpan: 2, maxSpan: 8 },
  ldr: { label: 'photoresistor', terminals: ['a', 'b'], polar: false, shape: 'bend', minSpan: 2, maxSpan: 6 },
  button: { label: 'button', terminals: ['a', 'b'], polar: false, shape: 'button' },
  potentiometer: { label: 'potentiometer', terminals: ['end1', 'wiper', 'end2'], polar: false, shape: 'row', count: 3, flip: true },
  tmp36: { label: 'TMP36', terminals: ['vs', 'vout', 'gnd'], polar: true, shape: 'row', count: 3, flip: false },
  servo: { label: 'servo', terminals: ['gnd', 'vcc', 'signal'], polar: true, shape: 'row', count: 3, flip: false },
  rgbLed: { label: 'RGB LED', terminals: ['red', 'cathode', 'green', 'blue'], polar: true, shape: 'row', count: 4, flip: true },
  buzzer: { label: 'buzzer', terminals: ['a', 'b'], polar: false, shape: 'gap', gap: 3, flip: true }
}

// Plain words for each terminal, used in mistake messages.
export const TERMINAL_LABELS = {
  led: { anode: 'long leg', cathode: 'short leg' },
  resistor: { a: 'end', b: 'end' },
  ldr: { a: 'end', b: 'end' },
  buzzer: { a: 'end', b: 'end' },
  button: { a: 'left side', b: 'right side' },
  potentiometer: { end1: 'outer leg', wiper: 'middle leg', end2: 'outer leg' },
  tmp36: { vs: '+Vs leg', vout: 'Vout leg', gnd: 'GND leg' },
  servo: { gnd: 'brown GND wire', vcc: 'red 5V wire', signal: 'orange signal wire' },
  rgbLed: { red: 'red leg', cathode: 'long leg', green: 'green leg', blue: 'blue leg' }
}

// A button at '12e' straddles the centre channel: legs at 12e, 14e, 12f, 14f.
export function buttonHoles(at) {
  const { column, row } = parseHole(at)
  if (row !== 'e') throw new Error(`Button hole '${at}' must be in row e`)
  if (column > BREADBOARD_COLUMNS - 2) throw new Error(`Button hole '${at}' needs a column of at most ${BREADBOARD_COLUMNS - 2}`)
  return [`${column}e`, `${column + 2}e`, `${column}f`, `${column + 2}f`]
}

// A potentiometer at '12e' has its legs at 12e, 13e and 14e; the middle one is the wiper.
export function potHoles(at) {
  const { column, row } = parseHole(at)
  if (column > BREADBOARD_COLUMNS - 2) throw new Error(`Potentiometer hole '${at}' needs a column of at most ${BREADBOARD_COLUMNS - 2}`)
  return [`${column}${row}`, `${column + 1}${row}`, `${column + 2}${row}`]
}

// An RGB LED at '14e' has its legs at 14e (red), 15e (cathode), 16e (green) and 17e (blue).
export function rgbHoles(at) {
  const { column, row } = parseHole(at)
  if (column > BREADBOARD_COLUMNS - 3) throw new Error(`RGB LED hole '${at}' needs a column of at most ${BREADBOARD_COLUMNS - 3}`)
  return [0, 1, 2, 3].map((offset) => `${column + offset}${row}`)
}

// A buzzer at '12e' has its positive leg at 12e and its negative leg 3 columns on, at 15e.
export function buzzerHoles(at) {
  const { column, row } = parseHole(at)
  if (column > BREADBOARD_COLUMNS - 3) throw new Error(`Buzzer hole '${at}' needs a column of at most ${BREADBOARD_COLUMNS - 3}`)
  return [`${column}${row}`, `${column + 3}${row}`]
}

const AT_LEGS = {
  button: buttonHoles,
  potentiometer: potHoles,
  tmp36: potHoles,
  servo: potHoles,
  rgbLed: rgbHoles,
  buzzer: buzzerHoles
}

// The holes of a part's legs, in terminal order (four for a button); [] when
// the part is not placed.
export function legsOf(part) {
  if (Array.isArray(part.legs)) return part.legs.slice()
  if (part.type === 'led') return part.anode && part.cathode ? [part.anode, part.cathode] : []
  if (part.type === 'resistor' || part.type === 'ldr') return part.from && part.to ? [part.from, part.to] : []
  if (Object.hasOwn(AT_LEGS, part.type) && part.at) return AT_LEGS[part.type](part.at)
  return []
}

// The holes of each terminal: { [terminal]: [holes] }; {} when not placed.
export function terminalHoles(part) {
  const legs = legsOf(part)
  const type = PART_TYPES[part.type]
  if (!type || legs.length === 0) return {}
  if (part.type === 'button') return { a: [legs[0], legs[2]], b: [legs[1], legs[3]] }
  return Object.fromEntries(type.terminals.map((terminal, i) => [terminal, [legs[i]]]))
}

// Ways a fixed shape part can be placed at one anchor hole.
export function orientationCount(type) {
  const spec = PART_TYPES[type]
  if (!spec) return 0
  if (spec.shape === 'pair') return 4
  if (spec.shape === 'row' || spec.shape === 'gap') return spec.flip ? 2 : 1
  return 1
}

// The legs of a fixed shape part with its first leg at anchor, or null when a
// leg is off the board, the orientation does not exist, or the shape bends.
export function footprint(type, anchor, orientation = 0) {
  const spec = PART_TYPES[type]
  if (!spec || !isHole(anchor) || !Number.isInteger(orientation)) return null
  if (orientation < 0 || orientation >= orientationCount(type)) return null
  const { column, row } = parseHole(anchor)
  const at = (c, r) => (r ? holeName(c, r) : null)
  let legs
  if (spec.shape === 'pair') {
    // The cathode one column right, one row towards +z, one column left or one row towards -z.
    const other = [at(column + 1, row), at(column, rowAt(row, 1)), at(column - 1, row), at(column, rowAt(row, -1))][orientation]
    legs = [anchor, other]
  } else if (spec.shape === 'button') {
    // The second pair of legs is exactly 3 pitches towards +z.
    const r2 = rowAt(row, 3)
    legs = [anchor, at(column + 2, row), at(column, r2), at(column + 2, r2)]
  } else if (spec.shape === 'row') {
    legs = Array.from({ length: spec.count }, (_, i) => at(column + i, row))
    if (orientation === 1) legs.reverse()
  } else if (spec.shape === 'gap') {
    legs = [anchor, at(column + spec.gap, row)]
    if (orientation === 1) legs.reverse()
  } else {
    return null
  }
  return legs.every(Boolean) ? legs : null
}

// The legs of a bending part (resistor, photoresistor) from one hole to
// another: in one row from minSpan to maxSpan columns apart, or in one column
// from minSpan to maxSpan pitches apart (across the channel too). Else null.
export function bendLegs(type, from, to) {
  const spec = PART_TYPES[type]
  if (!spec || spec.shape !== 'bend' || !isHole(from) || !isHole(to) || from === to) return null
  const a = parseHole(from)
  const b = parseHole(to)
  let span = null
  if (a.row === b.row) span = Math.abs(a.column - b.column)
  else if (a.column === b.column) span = Math.abs(rowPitchZ(a.row) - rowPitchZ(b.row))
  if (span === null || span < spec.minSpan || span > spec.maxSpan) return null
  return [from, to]
}
