import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { circuits } from '../src/circuits/circuits.js'
import { buildCircuit, buttonHoles } from '../src/circuits/buildCircuit.js'
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
  if (part.type === 'button') return buttonHoles(part.at)
  return part.type === 'led' ? [part.anode, part.cathode] : [part.from, part.to]
}

// The pin that drives each lesson's LED.
const SIGNAL_PINS = { '1.2': 'D13', '1.3': 'D9', '1.4': 'D13', '1.5': 'D13', '1.7': 'D9' }
// Lessons built from the plain pin, resistor, LED, GND circuit.
const LED_ONLY = ['1.2', '1.3', '1.7']

// Electrical node of a hole: its strip, with a button's facing legs joined
// across the channel, so column c top and bottom are one node.
function nodeOf(circuit) {
  const joined = new Set()
  for (const part of circuit.parts.filter((item) => item.type === 'button')) {
    for (const hole of buttonHoles(part.at)) joined.add(parseHole(hole).column)
  }
  return (hole) => {
    const { column } = parseHole(hole)
    return joined.has(column) ? `${column}-joined` : holeStrip(hole)
  }
}

describe('circuit tables', () => {
  it('are keyed by lesson ids, only 1.2, 1.3, 1.4, 1.5 and 1.7', () => {
    const ids = lessons.map((lesson) => lesson.id)
    for (const key of Object.keys(circuits)) expect(ids).toContain(key)
    expect(Object.keys(circuits).sort()).toEqual(['1.2', '1.3', '1.4', '1.5', '1.7'])
  })

  it('expands a button at 12e to legs at 12e, 14e, 12f and 14f', () => {
    expect(buttonHoles('12e')).toEqual(['12e', '14e', '12f', '14f'])
    expect(buttonHoles('28e')).toEqual(['28e', '30e', '28f', '30f'])
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

      if (LED_ONLY.includes(id)) it(`wires ${SIGNAL_PINS[id]} through a 220 ohm resistor and a red LED to GND`, () => {
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

      it(`gives every LED the pin ${SIGNAL_PINS[id]} that drives it`, () => {
        const leds = circuit.parts.filter((part) => part.type === 'led')
        expect(leds.length).toBeGreaterThan(0)
        for (const led of leds) {
          expect(led.pin).toBe(SIGNAL_PINS[id])
          expect(UNO_PIN_NAMES).toContain(led.pin)
        }
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

  for (const id of ['1.4', '1.5']) {
    describe(`lesson ${id} button circuit`, () => {
      const circuit = circuits[id]
      const node = nodeOf(circuit)
      const part = (partId) => circuit.parts.find((item) => item.id === partId)
      const wireNode = (pin) => node(circuit.wires.find((wire) => wire.from === pin).to)

      it('never puts connections from two different nets on one node', () => {
        const pinsOn = new Map()
        for (const wire of circuit.wires) {
          const key = node(wire.to)
          if (!pinsOn.has(key)) pinsOn.set(key, new Set())
          pinsOn.get(key).add(wire.from)
        }
        for (const pins of pinsOn.values()) expect(pins.size).toBe(1)
        for (const item of circuit.parts.filter((entry) => entry.type !== 'button')) {
          const [a, b] = partHoles(item)
          expect(node(a)).not.toBe(node(b))
        }
        const [left, right] = buttonHoles(part('btn1').at)
        expect(node(left)).not.toBe(node(right))
      })

      it('wires D2 to one side of the button and the other side to its supply', () => {
        const [left, right] = buttonHoles(part('btn1').at)
        expect(part('btn1').at).toBe('12e')
        expect(wireNode('D2')).toBe(node(left))
        expect(wireNode(id === '1.4' ? 'GND.2' : '5V')).toBe(node(right))
      })

      it('wires the D13 LED through 220 ohm in columns 20 to 25', () => {
        const resistor = part('r1')
        const led = part('led1')
        expect(resistor.ohms).toBe(220)
        expect(led.pin).toBe('D13')
        expect(node(resistor.from)).toBe(wireNode('D13'))
        expect(node(resistor.to)).toBe(node(led.anode))
        expect(node(led.cathode)).toBe(wireNode('GND'))
        for (const hole of [...partHoles(resistor), ...partHoles(led)]) {
          expect(parseHole(hole).column).toBeGreaterThanOrEqual(20)
          expect(parseHole(hole).column).toBeLessThanOrEqual(25)
        }
      })

      if (id === '1.5') it('pulls D2 down to GND.2 through a 10 kohm resistor shown only when pull is down', () => {
        const pullDown = part('r2')
        expect(pullDown.ohms).toBe(10000)
        expect([node(pullDown.from), node(pullDown.to)].sort()).toEqual([wireNode('D2'), wireNode('GND.2')].sort())
        expect(pullDown.showWhen).toEqual({ param: 'pull', value: 'down' })
      })

      it('builds a pressable button item', () => {
        const { items } = buildCircuit(circuit, placedBoards())
        expect(items.btn1.group.userData.pressable).toBe(true)
        expect(typeof items.btn1.setPressed).toBe('function')
      })
    })
  }

  it('throws naming the item for a button not in row e or past column 28', () => {
    const boards = placedBoards()
    const row = { parts: [{ id: 'b1', type: 'button', at: '12d' }], wires: [] }
    expect(() => buildCircuit(row, boards)).toThrow('b1')
    const column = { parts: [{ id: 'b2', type: 'button', at: '29e' }], wires: [] }
    expect(() => buildCircuit(column, boards)).toThrow('b2')
  })

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
