// Procedural half size breadboard. 1 unit = 1 cm, top face up, centered on the
// origin in x and z, resting on y = 0. Columns 1 to 30 run left (-x) to right
// (+x). Rows a to e sit on the far side (-z) of the centre channel, f to j on
// the near side (+z). No power rails.
import * as THREE from 'three'
import { PITCH } from './unoBoard.js'

export const BREADBOARD_COLUMNS = 30
export const BREADBOARD_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

const LENGTH = 8.2
const DEPTH = 3.8
const HEIGHT = 0.85
const CHANNEL_WIDTH = 0.3
const CHANNEL_DEPTH = 0.25

export function parseHole(hole) {
  const match = /^(\d+)([a-z])$/.exec(typeof hole === 'string' ? hole : '')
  if (!match) throw new Error(`Bad breadboard hole: '${hole}'`)
  const column = Number(match[1])
  const row = match[2]
  if (column < 1 || column > BREADBOARD_COLUMNS) {
    throw new Error(`Breadboard hole '${hole}' has a column outside 1 to ${BREADBOARD_COLUMNS}`)
  }
  if (!BREADBOARD_ROWS.includes(row)) throw new Error(`Breadboard hole '${hole}' has a row outside a to j`)
  return { column, row }
}

// Rows a to e and f to j are one pitch apart, e to f is three pitches.
function rowZ(row) {
  const i = BREADBOARD_ROWS.indexOf(row)
  return (i < 5 ? i - 5.5 : i - 3.5) * PITCH
}

function columnX(column) {
  return (column - (BREADBOARD_COLUMNS + 1) / 2) * PITCH
}

export function holePosition(hole) {
  const { column, row } = parseHole(hole)
  return new THREE.Vector3(columnX(column), HEIGHT + 0.002, rowZ(row))
}

export function holeStrip(hole) {
  const { column, row } = parseHole(hole)
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
  for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
    for (const row of BREADBOARD_ROWS) {
      const mesh = new THREE.Mesh(holeGeometry, holeMaterial)
      mesh.position.copy(holePosition(`${column}${row}`))
      group.add(mesh)
    }
  }
  return { group }
}
