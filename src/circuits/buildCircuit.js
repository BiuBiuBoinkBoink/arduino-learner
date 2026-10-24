// Builds the scene parts for a circuit table. Uno pins and breadboard holes are
// looked up in their local frames and converted to world positions, so the
// returned group belongs directly in the scene.
import * as THREE from 'three'
import { unoPinPosition } from '../parts/unoBoard.js'
import { holePosition, parseHole, BREADBOARD_COLUMNS } from '../parts/breadboard.js'
import { createButton } from '../parts/button.js'
import { createLed } from '../parts/led.js'
import { createPotentiometer } from '../parts/potentiometer.js'
import { createRgbLed } from '../parts/rgbLed.js'
import { createLdr } from '../parts/ldr.js'
import { createTmp36 } from '../parts/tmp36.js'
import { createBuzzer } from '../parts/buzzer.js'
import { createResistor } from '../parts/resistor.js'
import { createWire } from '../parts/wire.js'

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

const PART_FACTORIES = {
  button: (part, hole) => createButton({ legs: buttonHoles(part.at).map(hole) }),
  led: (part, hole) => createLed({ color: part.color, anode: hole(part.anode), cathode: hole(part.cathode) }),
  potentiometer: (part, hole) => createPotentiometer({ legs: potHoles(part.at).map(hole) }),
  rgbLed: (part, hole) => createRgbLed({ legs: rgbHoles(part.at).map(hole) }),
  buzzer: (part, hole) => createBuzzer({ legs: buzzerHoles(part.at).map(hole) }),
  ldr: (part, hole) => createLdr({ from: hole(part.from), to: hole(part.to) }),
  // A TMP36 uses the same three holes in a row as a potentiometer: +Vs, Vout, GND.
  tmp36: (part, hole) => createTmp36({ legs: potHoles(part.at).map(hole) }),
  resistor: (part, hole) => createResistor({ ohms: part.ohms, from: hole(part.from), to: hole(part.to) })
}

export function buildCircuit(circuit, { board, breadboard }) {
  board.group.updateMatrixWorld(true)
  breadboard.group.updateMatrixWorld(true)
  const hole = (name) => breadboard.group.localToWorld(holePosition(name))
  const pin = (name) => board.group.localToWorld(unoPinPosition(name))

  const group = new THREE.Group()
  group.name = 'circuit'
  const items = {}

  function add(id, build) {
    let item
    try {
      item = build()
    } catch (error) {
      throw new Error(`Circuit item ${id}: ${error.message}`)
    }
    item.group.name = id
    items[id] = item
    group.add(item.group)
  }

  for (const part of circuit.parts) {
    add(part.id, () => {
      if (!Object.hasOwn(PART_FACTORIES, part.type)) throw new Error(`unknown part type ${part.type}`)
      return PART_FACTORIES[part.type](part, hole)
    })
  }
  for (const wire of circuit.wires) {
    add(wire.id, () => createWire({ color: wire.color, from: pin(wire.from), to: hole(wire.to) }))
  }
  return { group, items }
}
