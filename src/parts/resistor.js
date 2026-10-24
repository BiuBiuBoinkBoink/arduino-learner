// Procedural through hole resistor lying flat above the board, with four
// colour bands and two legs bent down into the given points (hole tops in the
// parent frame).
import * as THREE from 'three'

const DIGITS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white']

const BAND_COLORS = {
  black: 0x1a1a1a,
  brown: 0x7a4a24,
  red: 0xd0312d,
  orange: 0xf08a24,
  yellow: 0xf4d03f,
  green: 0x2e9e4f,
  blue: 0x2c6fd1,
  violet: 0x8e44ad,
  grey: 0x8c8c8c,
  white: 0xf5f5f5,
  gold: 0xc9a43a
}

const LEG_RADIUS = 0.022
const LIFT = 0.3
const BODY_LENGTH = 0.65
const BODY_RADIUS = 0.11
const BAND_WIDTH = 0.06

// Two significant digits, a multiplier from black (x1) to white (x1e9), gold tolerance.
export function resistorBands(ohms) {
  if (!Number.isFinite(ohms) || ohms < 10) throw new Error(`Resistor value out of range: ${ohms}`)
  for (let exponent = 0; exponent < DIGITS.length; exponent++) {
    const value = ohms / 10 ** exponent
    const rounded = Math.round(value)
    if (rounded >= 10 && rounded <= 99 && Math.abs(value - rounded) < 1e-9) {
      return [DIGITS[Math.floor(rounded / 10)], DIGITS[rounded % 10], DIGITS[exponent], 'gold']
    }
  }
  throw new Error(`Resistor value cannot be written with 4 bands: ${ohms}`)
}

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createResistor({ ohms, from, to }) {
  const bands = resistorBands(ohms)
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const tan = new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: 0.6 })

  const y = Math.max(from.y, to.y) + LIFT
  const centre = new THREE.Vector3((from.x + to.x) / 2, y, (from.z + to.z) / 2)
  const axis = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize()

  // The body and bands are cylinders along local y, turned to lie along the axis.
  const body = new THREE.Group()
  body.position.copy(centre)
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH, 20), tan)
  tube.castShadow = true
  body.add(tube)
  const offsets = [-0.2, -0.1, 0, 0.2]
  bands.forEach((name, i) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(BODY_RADIUS + 0.006, BODY_RADIUS + 0.006, BAND_WIDTH, 20),
      new THREE.MeshStandardMaterial({ color: BAND_COLORS[name], roughness: 0.5 })
    )
    band.position.y = offsets[i]
    band.name = `band-${name}`
    body.add(band)
  })
  group.add(body)

  // Each leg runs out from the body end, then bends straight down into its point.
  const half = axis.clone().multiplyScalar(BODY_LENGTH / 2)
  for (const [end, point] of [[centre.clone().sub(half), from], [centre.clone().add(half), to]]) {
    const corner = new THREE.Vector3(point.x, y, point.z)
    group.add(rod(end, corner, metal), rod(corner, point, metal))
  }
  return { group }
}
