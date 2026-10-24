// Procedural half size breadboard. 1 unit = 1 cm, top face up, centered on the
// origin in x and z, resting on y = 0. Columns 1 to 30 run left (-x) to right
// (+x). Rows a to e sit on the far side (-z) of the centre channel, f to j on
// the near side (+z). Four power rails run along the long edges: T+ and T- on
// the far side, B- and B+ on the near side, with a hole in every column. Rail
// holes are named row then column ('T+12'), terminal holes column then row ('12e').
// The hole grid itself lives in src/circuits/holes.js and is re-exported here.
import * as THREE from 'three'
import { PITCH } from './unoBoard.js'
import { BREADBOARD_COLUMNS, ALL_ROWS, ALL_HOLES, parseHole, rowPitchZ, holeName } from '../circuits/holes.js'

export {
  BREADBOARD_COLUMNS,
  BREADBOARD_ROWS,
  RAIL_ROWS,
  ALL_HOLES,
  parseHole,
  isHole,
  rowPitchZ,
  holeStrip
} from '../circuits/holes.js'

const STRIPE_COLORS = { plus: 0xd0312d, minus: 0x2c6fd1 }

const LENGTH = 8.2
// Out to the outer rails plus a margin on each side.
const DEPTH = 2 * (9.5 * PITCH + 0.15)
const HEIGHT = 0.85
const CHANNEL_WIDTH = 0.3
const CHANNEL_DEPTH = 0.25

function rowZ(row) {
  return rowPitchZ(row) * PITCH
}

function columnX(column) {
  return (column - (BREADBOARD_COLUMNS + 1) / 2) * PITCH
}

export function holePosition(hole) {
  const { column, row } = parseHole(hole)
  return new THREE.Vector3(columnX(column), HEIGHT + 0.002, rowZ(row))
}

// Height of the hole tops in breadboard local coordinates, for picking.
export const HOLE_TOP_Y = HEIGHT + 0.002

// The hole nearest a breadboard local point, when it is within maxDistance on
// both axes; else null. Rails included.
export function nearestHole(localX, localZ, maxDistance = 0.6 * PITCH) {
  const column = Math.round(localX / PITCH + (BREADBOARD_COLUMNS + 1) / 2)
  if (column < 1 || column > BREADBOARD_COLUMNS) return null
  if (Math.abs(localX - columnX(column)) > maxDistance) return null
  let best = null
  for (const row of ALL_ROWS) {
    const dz = Math.abs(localZ - rowZ(row))
    if (dz <= maxDistance && (!best || dz < best.dz)) best = { row, dz }
  }
  return best ? holeName(column, best.row) : null
}

function slab(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createBreadboard() {
  const group = new THREE.Group()
  group.name = 'breadboard'
  const body = new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: 0.8 })
  const channel = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.9 })
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 })

  // Two full height halves either side of a lower channel floor.
  const halfDepth = (DEPTH - CHANNEL_WIDTH) / 2
  const halfZ = CHANNEL_WIDTH / 2 + halfDepth / 2
  group.add(slab(LENGTH, HEIGHT, halfDepth, body, 0, HEIGHT / 2, -halfZ))
  group.add(slab(LENGTH, HEIGHT, halfDepth, body, 0, HEIGHT / 2, halfZ))
  const floor = HEIGHT - CHANNEL_DEPTH
  group.add(slab(LENGTH, floor, CHANNEL_WIDTH, channel, 0, floor / 2, 0))

  const holeGeometry = new THREE.BoxGeometry(0.1, 0.004, 0.1)
  for (const name of ALL_HOLES) {
    const mesh = new THREE.Mesh(holeGeometry, holeMaterial)
    mesh.name = 'hole'
    mesh.position.copy(holePosition(name))
    group.add(mesh)
  }

  // A red stripe half a pitch outside each + rail, a blue one half a pitch inside each - rail.
  const stripeGeometry = new THREE.BoxGeometry(LENGTH - 0.4, 0.004, 0.04)
  const stripes = [[STRIPE_COLORS.plus, -9.5], [STRIPE_COLORS.minus, -7.5], [STRIPE_COLORS.minus, 7.5], [STRIPE_COLORS.plus, 9.5]]
  for (const [color, z] of stripes) {
    const mesh = new THREE.Mesh(stripeGeometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    mesh.name = 'stripe'
    mesh.position.set(0, HEIGHT + 0.002, z * PITCH)
    group.add(mesh)
  }
  return { group }
}
