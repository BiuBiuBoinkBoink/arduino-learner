// Builds the scene parts for a circuit table. Uno pins and breadboard holes are
// looked up in their local frames and converted to world positions, so the
// returned group belongs directly in the scene.
import * as THREE from 'three'
import { unoPinPosition } from '../parts/unoBoard.js'
import { holePosition, isHole } from '../parts/breadboard.js'
import { buttonHoles, potHoles, rgbHoles, buzzerHoles, legsOf } from './footprints.js'
import { createButton } from '../parts/button.js'
import { createLed } from '../parts/led.js'
import { createPotentiometer } from '../parts/potentiometer.js'
import { createRgbLed } from '../parts/rgbLed.js'
import { createLdr } from '../parts/ldr.js'
import { createTmp36 } from '../parts/tmp36.js'
import { createBuzzer } from '../parts/buzzer.js'
import { createServo } from '../parts/servo.js'
import { createResistor } from '../parts/resistor.js'
import { createWire } from '../parts/wire.js'

// The leg hole helpers live in footprints.js; re-exported so old imports keep working.
export { buttonHoles, potHoles, rgbHoles, buzzerHoles }

// Each factory takes the part, its legs as world positions in terminal order
// (four for a button) and the code panel values.
const PART_FACTORIES = {
  button: (part, legs) => createButton({ legs }),
  led: (part, legs) => createLed({ color: part.color, anode: legs[0], cathode: legs[1] }),
  potentiometer: (part, legs) => createPotentiometer({ legs }),
  rgbLed: (part, legs) => createRgbLed({ legs }),
  buzzer: (part, legs) => createBuzzer({ legs }),
  // A servo cable ends in three holes in a row like a potentiometer: GND, 5V, signal.
  servo: (part, legs) => createServo({ legs }),
  ldr: (part, legs) => createLdr({ from: legs[0], to: legs[1] }),
  // A TMP36 uses the same three holes in a row as a potentiometer: +Vs, Vout, GND.
  tmp36: (part, legs) => createTmp36({ legs }),
  // A resistor with ohmsParam takes its ohms, and so its bands, from that code panel value.
  resistor: (part, legs, values) => {
    const ohms = part.ohmsParam && values && Number.isFinite(values[part.ohmsParam]) ? values[part.ohmsParam] : part.ohms
    return createResistor({ ohms, from: legs[0], to: legs[1] })
  }
}

// Parts may give legs or the reference position fields (legsOf reads both).
export function buildCircuit(circuit, { board, breadboard, values = {} }) {
  board.group.updateMatrixWorld(true)
  breadboard.group.updateMatrixWorld(true)
  const hole = (name) => breadboard.group.localToWorld(holePosition(name))
  const pin = (name) => board.group.localToWorld(unoPinPosition(name))

  const group = new THREE.Group()
  group.name = 'circuit'
  const items = {}

  function add(id, tag, build) {
    let item
    try {
      item = build()
    } catch (error) {
      throw new Error(`Circuit item ${id}: ${error.message}`)
    }
    item.group.name = id
    item.group.userData[tag] = id
    items[id] = item
    group.add(item.group)
  }

  for (const part of circuit.parts) {
    add(part.id, 'partId', () => {
      if (!Object.hasOwn(PART_FACTORIES, part.type)) throw new Error(`unknown part type ${part.type}`)
      const legs = legsOf(part)
      if (legs.length === 0) throw new Error('not placed')
      return PART_FACTORIES[part.type](part, legs.map(hole), values)
    })
  }
  // A wire starts at an Uno pin, or at a hole (rails included) for a jumper.
  const start = (name) => (isHole(name) ? hole(name) : pin(name))
  for (const wire of circuit.wires) {
    add(wire.id, 'wireId', () => createWire({ color: wire.color, from: start(wire.from), to: hole(wire.to) }))
  }
  return { group, items }
}
