// Procedural Arduino Uno board. 1 unit = 1 cm, top face up, centered on the
// origin in x and z, resting on y = 0. Digital headers run along the far long
// edge (-z), power and analog headers along the near edge (+z), USB port and
// barrel jack overhang the left short edge (-x).
import * as THREE from 'three'

export const UNO_ZONE_IDS = ['digital', 'analog', 'power', 'usb-power', 'chip', 'reset']

const WIDTH = 6.86
const DEPTH = 5.33
const PCB_THICKNESS = 0.16
export const PITCH = 0.254
const HEADER_HEIGHT = 0.85

// Board layout positions are given in cm from the bottom left corner of the
// board seen from above (x to the right, y towards the digital headers).
function toX(x) {
  return x - WIDTH / 2
}
function toZ(y) {
  return DEPTH / 2 - y
}

function material(params) {
  return new THREE.MeshStandardMaterial(params)
}

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

function createPcb() {
  const chamfer = 0.3
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(WIDTH - chamfer, 0)
  shape.lineTo(WIDTH, chamfer)
  shape.lineTo(WIDTH, DEPTH - chamfer)
  shape.lineTo(WIDTH - chamfer, DEPTH)
  shape.lineTo(0, DEPTH)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: PCB_THICKNESS, bevelEnabled: false })
  geometry.translate(-WIDTH / 2, -DEPTH / 2, 0)
  const mesh = new THREE.Mesh(geometry, material({ color: 0x1f6fa8, roughness: 0.7 }))
  // Shape y runs to -z once the slab is laid flat.
  mesh.rotation.x = -Math.PI / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// Female headers in Uno R3 order: centre in board layout cm, pin names left to right.
const HEADERS = {
  digitalHigh: {
    centerX: 3.0,
    centerY: 5.08,
    pins: ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8']
  },
  digitalLow: { centerX: 5.47, centerY: 5.08, pins: ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'] },
  power: {
    centerX: 3.62,
    centerY: 0.25,
    pins: ['NC', 'IOREF', 'RESET', '3.3V', '5V', 'GND.2', 'GND.3', 'VIN']
  },
  analog: { centerX: 5.71, centerY: 0.25, pins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] }
}

export const UNO_PIN_NAMES = Object.values(HEADERS).flatMap((header) => header.pins)

// Centre of the top of hole i in a header, in board local coordinates.
function holePosition(header, i) {
  const length = header.pins.length * PITCH
  return new THREE.Vector3(
    toX(header.centerX) - length / 2 + PITCH * (i + 0.5),
    PCB_THICKNESS + HEADER_HEIGHT + 0.002,
    toZ(header.centerY)
  )
}

export function unoPinPosition(name) {
  for (const header of Object.values(HEADERS)) {
    const i = header.pins.indexOf(name)
    if (i !== -1) return holePosition(header, i)
  }
  throw new Error(`Unknown Uno pin: ${name}`)
}

// Female header strip with one hole per position, along x.
function addHeader(zone, header) {
  const body = material({ color: 0x2b2b2b, roughness: 0.8 })
  const hole = material({ color: 0x050505, roughness: 1 })
  const length = header.pins.length * PITCH
  const x = toX(header.centerX)
  const z = toZ(header.centerY)
  zone.add(box(length, HEADER_HEIGHT, PITCH, body, x, PCB_THICKNESS + HEADER_HEIGHT / 2, z))
  const holeGeometry = new THREE.BoxGeometry(0.1, 0.004, 0.1)
  for (let i = 0; i < header.pins.length; i++) {
    const mesh = new THREE.Mesh(holeGeometry, hole)
    mesh.position.copy(holePosition(header, i))
    zone.add(mesh)
  }
}

function createZone(id) {
  const zone = new THREE.Group()
  zone.name = id
  zone.userData.zoneId = id
  return zone
}

function buildDigital() {
  const zone = createZone('digital')
  addHeader(zone, HEADERS.digitalHigh)
  addHeader(zone, HEADERS.digitalLow)
  return zone
}

function buildPower() {
  const zone = createZone('power')
  addHeader(zone, HEADERS.power)
  return zone
}

function buildAnalog() {
  const zone = createZone('analog')
  addHeader(zone, HEADERS.analog)
  return zone
}

function buildUsbPower() {
  const zone = createZone('usb-power')
  const metal = material({ color: 0xc9ced3, metalness: 0.5, roughness: 0.35 })
  const dark = material({ color: 0x111111, roughness: 0.9 })
  const tongue = material({ color: 0xe8e8e8, roughness: 0.6 })
  const jackBody = material({ color: 0x1b1b1b, roughness: 0.6 })
  const pin = material({ color: 0xb8bcc0, metalness: 0.5, roughness: 0.4 })

  // USB B port: metal shell with a dark opening and a pale tongue on the outer face.
  const usbLength = 1.62
  const usbX = toX(-0.62 + usbLength / 2)
  const usbZ = toZ(4.4)
  const usbHeight = 1.1
  const usbY = PCB_THICKNESS + usbHeight / 2
  zone.add(box(usbLength, usbHeight, 1.2, metal, usbX, usbY, usbZ))
  const faceX = usbX - usbLength / 2
  zone.add(box(0.02, 0.8, 0.85, dark, faceX - 0.01, usbY, usbZ))
  zone.add(box(0.03, 0.32, 0.5, tongue, faceX - 0.02, usbY, usbZ))

  // DC barrel jack: black block with a round socket and centre pin on the outer face.
  const jackLength = 1.45
  const jackX = toX(-0.2 + jackLength / 2)
  const jackZ = toZ(0.8)
  const jackHeight = 1.1
  const jackY = PCB_THICKNESS + jackHeight / 2
  zone.add(box(jackLength, jackHeight, 0.9, jackBody, jackX, jackY, jackZ))
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24), dark)
  socket.rotation.z = Math.PI / 2
  socket.position.set(jackX - jackLength / 2 - 0.01, jackY + 0.05, jackZ)
  zone.add(socket)
  const centrePin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), pin)
  centrePin.rotation.z = Math.PI / 2
  centrePin.position.set(jackX - jackLength / 2 - 0.03, jackY + 0.05, jackZ)
  zone.add(centrePin)
  return zone
}

function buildChip() {
  const zone = createZone('chip')
  const body = material({ color: 0x1a1a1a, roughness: 0.55 })
  const leg = material({ color: 0xbfc3c7, metalness: 0.5, roughness: 0.4 })
  const notch = material({ color: 0x0a0a0a, roughness: 0.9 })

  // DIP-28: 14 legs per side, rows 0.762 apart, body lifted off the board.
  const length = 3.55
  const width = 0.66
  const height = 0.34
  const lift = 0.1
  const x = toX(4.75)
  const z = toZ(1.4)
  const bodyY = PCB_THICKNESS + lift + height / 2
  zone.add(box(length, height, width, body, x, bodyY, z))

  const legGeometry = new THREE.BoxGeometry(0.06, lift + height / 2, 0.06)
  const tabGeometry = new THREE.BoxGeometry(0.06, 0.03, 0.08)
  for (let i = 0; i < 14; i++) {
    const legX = x - (13 * PITCH) / 2 + i * PITCH
    for (const side of [-1, 1]) {
      const legZ = z + side * 0.381
      const down = new THREE.Mesh(legGeometry, leg)
      down.position.set(legX, PCB_THICKNESS + (lift + height / 2) / 2, legZ)
      down.castShadow = true
      zone.add(down)
      const tab = new THREE.Mesh(tabGeometry, leg)
      tab.position.set(legX, PCB_THICKNESS + lift + height / 2, z + side * (width / 2 + 0.03))
      zone.add(tab)
    }
  }

  const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 16), notch)
  mark.position.set(x - length / 2 + 0.2, bodyY + height / 2 + 0.005, z)
  zone.add(mark)
  return zone
}

function buildReset() {
  const zone = createZone('reset')
  const base = material({ color: 0xbfc3c7, metalness: 0.5, roughness: 0.4 })
  const cap = material({ color: 0xb8432f, roughness: 0.5 })
  const x = toX(1.3)
  const z = toZ(4.55)
  zone.add(box(0.6, 0.25, 0.6, base, x, PCB_THICKNESS + 0.125, z))
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.15, 20), cap)
  button.position.set(x, PCB_THICKNESS + 0.25 + 0.075, z)
  button.castShadow = true
  zone.add(button)
  return zone
}

// Small non interactive details: USB serial chip, crystal, ICSP header,
// status LEDs and the two supply capacitors.
function buildDetails() {
  const details = new THREE.Group()
  details.name = 'details'
  const black = material({ color: 0x1a1a1a, roughness: 0.55 })
  const silver = material({ color: 0xc9ced3, metalness: 0.5, roughness: 0.35 })
  const ledOff = material({ color: 0xf2e7c4, roughness: 0.4 })
  const capTop = material({ color: 0x9aa0a6, metalness: 0.4, roughness: 0.4 })

  details.add(box(0.5, 0.1, 0.5, black, toX(2.25), PCB_THICKNESS + 0.05, toZ(3.95)))

  const crystal = box(0.45, 0.35, 0.18, silver, toX(3.15), PCB_THICKNESS + 0.175, toZ(2.45))
  details.add(crystal)

  const pinGeometry = new THREE.BoxGeometry(0.06, 0.6, 0.06)
  details.add(box(0.51, 0.25, 0.76, black, toX(6.4), PCB_THICKNESS + 0.125, toZ(2.75)))
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      const pin = new THREE.Mesh(pinGeometry, silver)
      pin.position.set(toX(6.4) + (i - 0.5) * PITCH, PCB_THICKNESS + 0.3, toZ(2.75) + (j - 1) * PITCH)
      pin.castShadow = true
      details.add(pin)
    }
  }

  for (let i = 0; i < 4; i++) {
    details.add(box(0.12, 0.06, 0.08, ledOff, toX(2.45), PCB_THICKNESS + 0.03, toZ(3.2) + i * 0.18))
  }

  for (const y of [1.55, 2.1]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 20), black)
    can.position.set(toX(1.6), PCB_THICKNESS + 0.275, toZ(y))
    can.castShadow = true
    details.add(can)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.01, 20), capTop)
    top.position.set(toX(1.6), PCB_THICKNESS + 0.555, toZ(y))
    details.add(top)
  }
  return details
}

const BUILDERS = {
  digital: buildDigital,
  analog: buildAnalog,
  power: buildPower,
  'usb-power': buildUsbPower,
  chip: buildChip,
  reset: buildReset
}

export function createUnoBoard() {
  const group = new THREE.Group()
  group.name = 'uno-board'
  group.add(createPcb(), buildDetails())
  const zones = {}
  for (const id of UNO_ZONE_IDS) {
    zones[id] = BUILDERS[id]()
    group.add(zones[id])
  }
  return { group, zones }
}
