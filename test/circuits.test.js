import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { circuits } from '../src/circuits/circuits.js'
import { buildCircuit, buttonHoles, potHoles, rgbHoles, buzzerHoles } from '../src/circuits/buildCircuit.js'
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
  if (['potentiometer', 'tmp36', 'servo'].includes(part.type)) return potHoles(part.at)
  if (part.type === 'rgbLed') return rgbHoles(part.at)
  if (part.type === 'buzzer') return buzzerHoles(part.at)
  return part.type === 'led' ? [part.anode, part.cathode] : [part.from, part.to]
}

// The pin that drives each lesson's LED.
const SIGNAL_PINS = { '1.2': 'D13', '1.3': 'D9', '1.4': 'D13', '1.5': 'D13', '1.7': 'D9', '1.9': 'D13', P1: 'D13' }
// Lessons built from the plain pin, resistor, LED, GND circuit.
const LED_ONLY = ['1.2', '1.7']

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
  it('are keyed by lesson ids, only 1.2 to 1.12 and P1', () => {
    const ids = lessons.map((lesson) => lesson.id)
    for (const key of Object.keys(circuits)) expect(ids).toContain(key)
    expect(Object.keys(circuits).sort()).toEqual(['1.10', '1.11', '1.12', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', 'P1'])
  })

  it('expands a potentiometer at 12e to legs at 12e, 13e and 14e', () => {
    expect(potHoles('12e')).toEqual(['12e', '13e', '14e'])
    expect(potHoles('28f')).toEqual(['28f', '29f', '30f'])
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
          // From an Uno pin, or a hole for a jumper.
          if (!/^\d+[a-z]$/.test(wire.from)) expect(UNO_PIN_NAMES).toContain(wire.from)
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

      if (SIGNAL_PINS[id]) it(`gives every LED the pin ${SIGNAL_PINS[id]} that drives it`, () => {
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
          const start = /^\d+[a-z]$/.test(wire.from)
            ? boards.breadboard.group.localToWorld(holePosition(wire.from))
            : boards.board.group.localToWorld(unoPinPosition(wire.from))
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

  describe('lesson 1.3 resistor choice circuit', () => {
    const circuit = circuits['1.3']
    const resistors = circuit.parts.filter((part) => part.type === 'resistor')
    const led = circuit.parts.find((part) => part.type === 'led')

    it('has a 220 ohm, 1 kohm and 10 kohm resistor in the same holes, one per ohms choice', () => {
      expect(resistors.map((part) => part.ohms)).toEqual([220, 1000, 10000])
      for (const part of resistors) {
        expect([part.from, part.to]).toEqual(['5c', '9c'])
        expect(part.showWhen).toEqual({ param: 'ohms', value: part.ohms })
      }
      const choice = lessons.find((lesson) => lesson.id === '1.3').sketch.params.find((param) => param.name === 'ohms')
      expect(choice.options.map((option) => option.value)).toEqual([220, 1000, 10000])
    })

    it('wires D9 through the resistor to a red LED on D9 that dims with ohms', () => {
      expect(led.pin).toBe('D9')
      expect(led.ohmsParam).toBe('ohms')
      expect(holeStrip(circuit.wires.find((wire) => wire.from === 'D9').to)).toBe(holeStrip('5c'))
      expect(holeStrip(led.anode)).toBe(holeStrip('9c'))
      expect(holeStrip(circuit.wires.find((wire) => wire.from === 'GND').to)).toBe(holeStrip(led.cathode))
    })

    it('lists meter targets whose parts exist', () => {
      expect(circuit.meter.map((target) => target.id)).toEqual(['led', 'resistor'])
      const ids = circuit.parts.map((part) => part.id)
      for (const target of circuit.meter) for (const part of target.parts) expect(ids).toContain(part)
    })
  })

  describe('lesson 1.8 RGB LED circuit', () => {
    const circuit = circuits['1.8']
    const rgb = circuit.parts.find((part) => part.type === 'rgbLed')
    const wireTo = (pin) => holeStrip(circuit.wires.find((wire) => wire.from === pin).to)

    it('expands an RGB LED at 14e to red, cathode, green and blue legs', () => {
      expect(rgbHoles('14e')).toEqual(['14e', '15e', '16e', '17e'])
      expect(rgb.at).toBe('14e')
      expect(rgb.pins).toEqual({ red: 'D9', green: 'D10', blue: 'D11' })
    })

    it('reaches each colour leg from its pin through one 220 ohm resistor, cathode to GND', () => {
      const [red, cathode, green, blue] = rgbHoles(rgb.at).map(holeStrip)
      const resistors = circuit.parts.filter((part) => part.type === 'resistor')
      expect(resistors).toHaveLength(3)
      const joins = (a, b) => resistors.some((r) => {
        const ends = [holeStrip(r.from), holeStrip(r.to)]
        return r.ohms === 220 && ends.includes(a) && ends.includes(b)
      })
      expect(joins(wireTo('D9'), red)).toBe(true)
      expect(joins(wireTo('D10'), green)).toBe(true)
      expect(joins(wireTo('D11'), blue)).toBe(true)
      expect(wireTo('GND')).toBe(cathode)
      for (const r of resistors) expect(holeStrip(r.from)).not.toBe(holeStrip(r.to))
    })

    it('builds an RGB LED item with setColor', () => {
      const { items } = buildCircuit(circuit, placedBoards())
      expect(typeof items.rgb1.setColor).toBe('function')
    })
  })

  it('throws naming the item for an RGB LED past column 27', () => {
    const boards = placedBoards()
    expect(() => buildCircuit({ parts: [{ id: 'q1', type: 'rgbLed', at: '28e' }], wires: [] }, boards)).toThrow('q1')
  })

  describe('lesson 1.9 light sensor circuit', () => {
    const circuit = circuits['1.9']
    const part = (id) => circuit.parts.find((item) => item.id === id)
    const wireTo = (pin) => holeStrip(circuit.wires.find((wire) => wire.from === pin).to)

    it('makes a divider: 5V, photoresistor, A0, 10 kohm, GND.2', () => {
      const ldr = part('ldr1')
      const fixed = part('r2')
      expect(ldr.type).toBe('ldr')
      expect(fixed.ohms).toBe(10000)
      const ldrEnds = [holeStrip(ldr.from), holeStrip(ldr.to)]
      const fixedEnds = [holeStrip(fixed.from), holeStrip(fixed.to)]
      expect(ldrEnds).toContain(wireTo('5V'))
      expect(ldrEnds).toContain(wireTo('A0'))
      expect(fixedEnds).toContain(wireTo('A0'))
      expect(fixedEnds).toContain(wireTo('GND.2'))
      expect(new Set([wireTo('5V'), wireTo('A0'), wireTo('GND.2')]).size).toBe(3)
    })

    it('keeps the D13 LED circuit on its own strips', () => {
      const sensorStrips = new Set([wireTo('5V'), wireTo('A0'), wireTo('GND.2')])
      for (const pin of ['D13', 'GND']) expect(sensorStrips.has(wireTo(pin))).toBe(false)
    })
  })

  describe('project P1 room monitor circuit', () => {
    const circuit = circuits.P1
    const part = (id) => circuit.parts.find((item) => item.id === id)
    // Strips joined by jumper wires count as one node.
    const jumpers = circuit.wires.filter((wire) => /^\d+[a-z]$/.test(wire.from))
    const node = (hole) => {
      const strip = holeStrip(hole)
      const jumper = jumpers.find((wire) => holeStrip(wire.from) === strip || holeStrip(wire.to) === strip)
      return jumper ? [holeStrip(jumper.from), holeStrip(jumper.to)].sort().join('+') : strip
    }
    const wireTo = (pin) => node(circuit.wires.find((wire) => wire.from === pin).to)
    const ends = (item) => [node(item.from), node(item.to)].sort()

    it('is driven by the sim, with no room sliders', () => {
      expect(circuit.roomDriven).toBe(true)
    })

    it('makes the photoresistor divider on A0', () => {
      expect(ends(part('ldr1'))).toEqual([wireTo('5V'), wireTo('A0')].sort())
      expect(ends(part('r2'))).toEqual([wireTo('A0'), wireTo('GND.2')].sort())
      expect(part('r2').ohms).toBe(10000)
    })

    it('powers the TMP36 from 3.3V with its output on A1', () => {
      const [vs, out, gnd] = potHoles(part('tmp1').at).map(node)
      expect([wireTo('3.3V'), wireTo('A1'), wireTo('GND.3')]).toEqual([vs, out, gnd])
    })

    it('lights the D13 LED through 220 ohm and grounds the D8 buzzer through the jumper', () => {
      const led = part('led1')
      expect(ends(part('r1'))).toEqual([wireTo('D13'), node(led.anode)].sort())
      expect(node(led.cathode)).toBe(wireTo('GND'))
      const [positive, negative] = buzzerHoles(part('bz1').at).map(node)
      expect(positive).toBe(wireTo('D8'))
      expect(negative).toBe(wireTo('GND'))
    })

    it('keeps every net on its own node', () => {
      const pinsOn = new Map()
      for (const wire of circuit.wires.filter((item) => !jumpers.includes(item))) {
        const key = node(wire.to)
        if (!pinsOn.has(key)) pinsOn.set(key, new Set())
        pinsOn.get(key).add(wire.from)
      }
      for (const pins of pinsOn.values()) expect(pins.size).toBe(1)
    })
  })

  describe('lesson 1.12 servo circuit', () => {
    const circuit = circuits['1.12']
    const servo = circuit.parts.find((item) => item.id === 'sv1')

    it('wires GND.2, 5V and D9 to the brown, red and orange cable ends', () => {
      expect(servo.pin).toBe('D9')
      const [gnd, power, signal] = potHoles(servo.at).map(holeStrip)
      const wireTo = (pin) => holeStrip(circuit.wires.find((wire) => wire.from === pin).to)
      expect([wireTo('GND.2'), wireTo('5V'), wireTo('D9')]).toEqual([gnd, power, signal])
    })

    it('builds a servo item with setAngle that stays on the breadboard', () => {
      const boards = placedBoards()
      const { items } = buildCircuit(circuit, boards)
      expect(typeof items.sv1.setAngle).toBe('function')
      const servoBox = new THREE.Box3().setFromObject(items.sv1.group)
      const boardBox = new THREE.Box3().setFromObject(boards.breadboard.group)
      expect(servoBox.max.x).toBeLessThan(boardBox.max.x)
    })
  })

  describe('lesson 1.11 buzzer circuit', () => {
    const circuit = circuits['1.11']
    const buzzer = circuit.parts.find((item) => item.id === 'bz1')

    it('wires D8 to the positive leg and GND to the negative leg', () => {
      expect(buzzerHoles('12e')).toEqual(['12e', '15e'])
      expect(buzzer.pin).toBe('D8')
      const [positive, negative] = buzzerHoles(buzzer.at).map(holeStrip)
      const wireTo = (pin) => holeStrip(circuit.wires.find((wire) => wire.from === pin).to)
      expect(wireTo('D8')).toBe(positive)
      expect(wireTo('GND')).toBe(negative)
    })

    it('builds a buzzer item with setPlaying, and throws past column 27', () => {
      const { items } = buildCircuit(circuit, placedBoards())
      expect(typeof items.bz1.setPlaying).toBe('function')
      expect(() => buildCircuit({ parts: [{ id: 'b8', type: 'buzzer', at: '28e' }], wires: [] }, placedBoards())).toThrow('b8')
    })
  })

  describe('lesson 1.10 temperature circuit', () => {
    const circuit = circuits['1.10']
    const tmp = circuit.parts.find((item) => item.id === 'tmp1')

    it('wires 5V, A0 and GND.2 to the +Vs, Vout and GND legs', () => {
      expect(tmp.type).toBe('tmp36')
      const [vs, out, gnd] = potHoles(tmp.at).map(holeStrip)
      const wireTo = (pin) => holeStrip(circuit.wires.find((wire) => wire.from === pin).to)
      expect([wireTo('5V'), wireTo('A0'), wireTo('GND.2')]).toEqual([vs, out, gnd])
    })
  })

  describe('lesson 1.6 potentiometer circuit', () => {
    const circuit = circuits['1.6']
    const pot = circuit.parts.find((part) => part.id === 'pot1')

    it('wires 5V, A0 and GND.2 to the three leg strips, one net per strip', () => {
      expect(pot.type).toBe('potentiometer')
      expect(pot.at).toBe('12e')
      const [outer, wiper, other] = potHoles(pot.at).map(holeStrip)
      const stripOf = (pin) => holeStrip(circuit.wires.find((wire) => wire.from === pin).to)
      expect(stripOf('5V')).toBe(outer)
      expect(stripOf('A0')).toBe(wiper)
      expect(stripOf('GND.2')).toBe(other)
      expect(circuit.wires).toHaveLength(3)
      expect(new Set(circuit.wires.map((wire) => holeStrip(wire.to))).size).toBe(3)
    })

    it('builds a turnable potentiometer item', () => {
      const { items } = buildCircuit(circuit, placedBoards())
      expect(items.pot1.group.userData.turnable).toBe(true)
      expect(typeof items.pot1.setValue).toBe('function')
    })
  })

  it('throws naming the item for a potentiometer past column 28', () => {
    const boards = placedBoards()
    const column = { parts: [{ id: 'p9', type: 'potentiometer', at: '29e' }], wires: [] }
    expect(() => buildCircuit(column, boards)).toThrow('p9')
    const ok = { parts: [{ id: 'p8', type: 'potentiometer', at: '28e' }], wires: [] }
    expect(() => buildCircuit(ok, boards)).not.toThrow()
  })

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
