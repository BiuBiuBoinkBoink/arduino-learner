// Builds the scene parts for a circuit table. Uno pins and breadboard holes are
// looked up in their local frames and converted to world positions, so the
// returned group belongs directly in the scene.
import * as THREE from 'three'
import { unoPinPosition } from '../parts/unoBoard.js'
import { holePosition } from '../parts/breadboard.js'
import { createLed } from '../parts/led.js'
import { createResistor } from '../parts/resistor.js'
import { createWire } from '../parts/wire.js'

const PART_FACTORIES = {
  led: (part, hole) => createLed({ color: part.color, anode: hole(part.anode), cathode: hole(part.cathode) }),
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
