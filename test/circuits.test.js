import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { circuits } from '../src/circuits/circuits.js'
import { buildCircuit } from '../src/circuits/buildCircuit.js'
import { lessons } from '../src/course/lessons.js'
import { createUnoBoard, unoPinPosition, UNO_PIN_NAMES } from '../src/parts/unoBoard.js'
import { createBreadboard, holePosition, holeStrip, parseHole } from '../src/parts/breadboard.js'

// Board and breadboard placed in a scene, offset from the origin.
function placedBoards() {
  const scene = new THREE.Scene()
  const board = createUnoBoard()
  const breadboard = createBreadboard()
  board.group.position.set(-4.3, 0, 0.2)
  breadboard.group.position.set(4.2, 0, -0.3)
  scene.add(board.group, breadboard.group)
  return { board, breadboard }
}

function partHoles(part) {
  return part.type === 'led' ? [part.anode, part.cathode] : [part.from, part.to]
}

const SIGNAL_PINS = { '1.2': 'D13', '1.3': 'D9', '1.7': 'D9' }

describe('circuit tables', () => {
  it('are keyed by lesson ids, only 1.2, 1.3 and 1.7', () => {
    const ids = lessons.map((lesson) => lesson.id)
    for (const key of Object.keys(circuits)) expect(ids).toContain(key)
    expect(Object.keys(circuits).sort()).toEqual(['1.2', '1.3', '1.7'])
  })

  for (const [id, circuit] of Object.entries(circuits)) {
    describe(`lesson ${id}`, () => {
      it('uses valid holes, known pins and unique ids', () => {
        for (const part of circuit.parts) {
          for (const hole of partHoles(part)) expect(() => parseHole(hole)).not.toThrow()
        }
        for (const wire of circuit.wires) {
          expect(() => parseHole(wire.to)).not.toThrow()
          expect(UNO_PIN_NAMES).toContain(wire.from)
        }
        const itemIds = [...circuit.parts, ...circuit.wires].map((item) => item.id)
        expect(new Set(itemIds).size).toBe(itemIds.length)
      })

      it(`wires ${SIGNAL_PINS[id]} through a 220 ohm resistor and a red LED to GND`, () => {
        const resistor = circuit.parts.find((part) => part.type === 'resistor')
        const led = circuit.parts.find((part) => part.type === 'led')
        const signal = circuit.wires.find((wire) => wire.from === SIGNAL_PINS[id])
        const ground = circuit.wires.find((wire) => wire.from === 'GND')
        expect(circuit.parts).toHaveLength(2)
        expect(circuit.wires).toHaveLength(2)
        expect(resistor.ohms).toBe(220)
        expect(led.color).toBe('red')
        expect(signal).toBeDefined()
        expect(ground).toBeDefined()

        const holes = [...circuit.parts.flatMap(partHoles), ...circuit.wires.map((wire) => wire.to)]
        const pinStrip = holeStrip(signal.to)
        const resistorStrips = [holeStrip(resistor.from), holeStrip(resistor.to)]
        expect(resistorStrips).toContain(pinStrip)
        const otherEnd = resistorStrips[0] === pinStrip ? resistor.to : resistor.from
        const ledStrip = holeStrip(otherEnd)
        const groundStrip = holeStrip(ground.to)
        expect(holeStrip(led.anode)).toBe(ledStrip)
        expect(holeStrip(led.cathode)).toBe(groundStrip)
        expect(new Set([pinStrip, ledStrip, groundStrip]).size).toBe(3)
        // Each strip holds exactly its two connections and nothing else.
        for (const strip of [pinStrip, ledStrip, groundStrip]) {
          expect(holes.filter((hole) => holeStrip(hole) === strip)).toHaveLength(2)
        }

        const anode = parseHole(led.anode)
        const cathode = parseHole(led.cathode)
        expect(anode.row).toBe(cathode.row)
        expect(Math.abs(anode.column - cathode.column)).toBe(1)
      })

      it('builds an item per id with wires ending at the pin and hole', () => {
        const boards = placedBoards()
        const { group, items } = buildCircuit(circuit, boards)
        const itemIds = [...circuit.parts, ...circuit.wires].map((item) => item.id)
        expect(Object.keys(items).sort()).toEqual([...itemIds].sort())
        for (const itemId of itemIds) {
          expect(items[itemId].group.name).toBe(itemId)
          expect(items[itemId].group.parent).toBe(group)
        }
        for (const wire of circuit.wires) {
          const start = boards.board.group.localToWorld(unoPinPosition(wire.from))
          const end = boards.breadboard.group.localToWorld(holePosition(wire.to))
          expect(items[wire.id].curve.getPoint(0).distanceTo(start)).toBeLessThan(0.001)
          expect(items[wire.id].curve.getPoint(1).distanceTo(end)).toBeLessThan(0.001)
        }
      })
    })
  }

  it('throws naming the item for an unknown part type, pin or hole', () => {
    const boards = placedBoards()
    const part = { parts: [{ id: 'x1', type: 'capacitor', from: '1a', to: '2a' }], wires: [] }
    expect(() => buildCircuit(part, boards)).toThrow('x1')
    const pin = { parts: [], wires: [{ id: 'w9', color: 'red', from: 'D99', to: '1a' }] }
    expect(() => buildCircuit(pin, boards)).toThrow('w9')
    const hole = { parts: [{ id: 'r7', type: 'resistor', ohms: 220, from: '1a', to: '40a' }], wires: [] }
    expect(() => buildCircuit(hole, boards)).toThrow('r7')
  })
})
