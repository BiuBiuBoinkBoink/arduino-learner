// Procedural half size breadboard. 1 unit = 1 cm, top face up, centered on the
// origin in x and z, resting on y = 0. Columns 1 to 30 run left (-x) to right
// (+x). Rows a to e sit on the far side (-z) of the centre channel, f to j on
// the near side (+z). Four power rails run along the long edges: T+ and T- on
// the far side, B- and B+ on the near side, with a hole in every column. Rail
// holes are named row then column ('T+12'), terminal holes column then row ('12e').
import * as THREE from 'three'
import { PITCH } from './unoBoard.js'

export const BREADBOARD_COLUMNS = 30
export const BREADBOARD_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
export const RAIL_ROWS = ['T+', 'T-', 'B-', 'B+']

// Rail rows in pitches along z from the centre line; rows a to j are in rowPitchZ.
const RAIL_Z = { 'T+': -9, 'T-': -8, 'B-': 8, 'B+': 9 }
const STRIPE_COLORS = { plus: 0xd0312d, minus: 0x2c6fd1 }

const LENGTH = 8.2
// Out to the outer rails plus a margin on each side.
const DEPTH = 2 * (9.5 * PITCH + 0.15)
const HEIGHT = 0.85
const CHANNEL_WIDTH = 0.3
const CHANNEL_DEPTH = 0.25

export function parseHole(hole) {
  const text = typeof hole === 'string' ? hole : ''
  const rail = /^(T\+|T-|B-|B\+)(\d+)$/.exec(text)
  const match = rail ? [rail[0], rail[2], rail[1]] : /^(\d+)([a-z])$/.exec(text)
  if (!match) throw new Error(`Bad breadboard hole: '${hole}'`)
  const column = Number(match[1])
  const row = match[2]
  if (column < 1 || column > BREADBOARD_COLUMNS) {
    throw new Error(`Breadboard hole '${hole}' has a column outside 1 to ${BREADBOARD_COLUMNS}`)
  }
  if (!rail && !BREADBOARD_ROWS.includes(row)) throw new Error(`Breadboard hole '${hole}' has a row outside a to j`)
  return { column, row }
}

// True for any terminal or rail hole name; never throws.
export function isHole(name) {
  try {
    parseHole(name)
    return true
  } catch {
    return false
  }
}

function holeName(column, row) {
  return RAIL_ROWS.includes(row) ? `${row}${column}` : `${column}${row}`
}

// Every hole, rails included: rows T+, T-, a to j, B-, B+, each by column.
export const ALL_HOLES = ['T+', 'T-', ...BREADBOARD_ROWS, 'B-', 'B+'].flatMap((row) =>
  Array.from({ length: BREADBOARD_COLUMNS }, (_, i) => holeName(i + 1, row)))

// Row position in pitches along z: rows a to e and f to j are one pitch apart,
// e to f is three pitches, and the rails sit outside them.
export function rowPitchZ(row) {
  if (Object.hasOwn(RAIL_Z, row)) return RAIL_Z[row]
  const i = BREADBOARD_ROWS.indexOf(row)
  if (i === -1) throw new Error(`Unknown breadboard row '${row}'`)
  return i < 5 ? i - 5.5 : i - 3.5
}

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

// The joined set a hole belongs to: '12-top' (12a to 12e), '12-bottom' (12f to
// 12j), or a whole rail ('rail-T+').
export function holeStrip(hole) {
  const { column, row } = parseHole(hole)
  if (RAIL_ROWS.includes(row)) return `rail-${row}`
  return `${column}-${BREADBOARD_ROWS.indexOf(row) < 5 ? 'top' : 'bottom'}`
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
