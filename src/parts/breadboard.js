// Procedural half size breadboard. 1 unit = 1 cm, top face up, centered on the
// origin in x and z, resting on y = 0. Columns 1 to 30 run left (-x) to right
// (+x). Rows a to e sit on the far side (-z) of the centre channel, f to j on
// the near side (+z). Four power rails run along the long edges: T+ and T- on
// the far side, B- and B+ on the near side, with a hole in every column. Rail
// holes are named row then column ('T+12'), terminal holes column then row ('12e').
// The hole grid itself lives in src/circuits/holes.js and is re-exported here.
import * as THREE from 'three'
import { PITCH } from './unoBoard.js'
import { BREADBOARD_COLUMNS, BREADBOARD_ROWS, RAIL_ROWS, ALL_ROWS, ALL_HOLES, parseHole, rowPitchZ, holeName } from '../circuits/holes.js'

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
// X-ray: the body turns see-through and a metal bar shows under each strip and rail.
export const XRAY_OPACITY = 0.25
const BAR_COLOR = 0xb8bec6
const BAR_WIDTH = 0.12
const BAR_HEIGHT = 0.05

// Strip and rail highlight tones: colour and opacity.
export const HIGHLIGHT_TONES = {
  hover: { color: 0x2f6fd6, opacity: 0.12 },
  info: { color: 0x2f6fd6, opacity: 0.25 },
  good: { color: 0x1d7f53, opacity: 0.25 },
  bad: { color: 0xc0392b, opacity: 0.3 }
}

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

// The holes a place key covers: 'strip:9-top' (5 holes) or 'rail:T+' (30).
function placeHoles(place) {
  const rail = /^rail:(T\+|T-|B-|B\+)$/.exec(place)
  if (rail && RAIL_ROWS.includes(rail[1])) {
    return Array.from({ length: BREADBOARD_COLUMNS }, (_, i) => holeName(i + 1, rail[1]))
  }
  const strip = /^strip:(\d+)-(top|bottom)$/.exec(place)
  if (!strip) return null
  const rows = strip[2] === 'top' ? BREADBOARD_ROWS.slice(0, 5) : BREADBOARD_ROWS.slice(5)
  const holes = rows.map((row) => holeName(Number(strip[1]), row))
  return holes.every(Boolean) ? holes : null
}

// The metal bars under the holes: one per strip (5 holes along z) and one
// per rail (30 holes along x), as { x, z, length, along: 'x' | 'z' }.
export function xrayBars() {
  const bars = []
  for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
    for (const rows of [BREADBOARD_ROWS.slice(0, 5), BREADBOARD_ROWS.slice(5)]) {
      const first = rowZ(rows[0])
      const last = rowZ(rows[rows.length - 1])
      bars.push({ x: columnX(column), z: (first + last) / 2, length: last - first + PITCH * 0.6, along: 'z' })
    }
  }
  for (const row of RAIL_ROWS) {
    bars.push({ x: 0, z: rowZ(row), length: columnX(BREADBOARD_COLUMNS) - columnX(1) + PITCH * 0.6, along: 'x' })
  }
  return bars
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
  const floor = HEIGHT - CHANNEL_DEPTH
  const slabs = [
    slab(LENGTH, HEIGHT, halfDepth, body, 0, HEIGHT / 2, -halfZ),
    slab(LENGTH, HEIGHT, halfDepth, body, 0, HEIGHT / 2, halfZ),
    slab(LENGTH, floor, CHANNEL_WIDTH, channel, 0, floor / 2, 0)
  ]
  group.add(...slabs)

  // All 420 hole marks are one instanced mesh, one draw call.
  const holeGeometry = new THREE.BoxGeometry(0.1, 0.004, 0.1)
  const holes = new THREE.InstancedMesh(holeGeometry, holeMaterial, ALL_HOLES.length)
  holes.name = 'hole'
  const matrix = new THREE.Matrix4()
  ALL_HOLES.forEach((name, i) => holes.setMatrixAt(i, matrix.makeTranslation(holePosition(name))))
  holes.instanceMatrix.needsUpdate = true
  holes.computeBoundingSphere()
  group.add(holes)

  // A red stripe half a pitch outside each + rail, a blue one half a pitch inside each - rail.
  const stripeGeometry = new THREE.BoxGeometry(LENGTH - 0.4, 0.004, 0.04)
  const stripes = [[STRIPE_COLORS.plus, -9.5], [STRIPE_COLORS.minus, -7.5], [STRIPE_COLORS.minus, 7.5], [STRIPE_COLORS.plus, 9.5]]
  for (const [color, z] of stripes) {
    const mesh = new THREE.Mesh(stripeGeometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    mesh.name = 'stripe'
    mesh.position.set(0, HEIGHT + 0.002, z * PITCH)
    group.add(mesh)
  }

  // Highlights: flat see-through boxes just above the holes of a strip or rail.
  // One shared unit box, scaled per highlight, from a pool that only grows.
  const highlightGeometry = new THREE.BoxGeometry(1, 0.01, 1)
  const pool = []
  function highlightMesh(i) {
    if (!pool[i]) {
      const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
      const mesh = new THREE.Mesh(highlightGeometry, material)
      mesh.name = 'highlight'
      mesh.renderOrder = 2
      mesh.visible = false
      group.add(mesh)
      pool[i] = mesh
    }
    return pool[i]
  }

  // list: [{ place: 'strip:9-top' | 'rail:T+', tone: 'hover' | 'info' | 'good' | 'bad' }]
  function highlightPlaces(list) {
    let used = 0
    for (const { place, tone } of list || []) {
      const holeList = placeHoles(place)
      const look = HIGHLIGHT_TONES[tone]
      if (!holeList || !look) continue
      const first = holePosition(holeList[0])
      const last = holePosition(holeList[holeList.length - 1])
      const mesh = highlightMesh(used++)
      mesh.material.color.setHex(look.color)
      mesh.material.opacity = look.opacity
      mesh.position.set((first.x + last.x) / 2, HEIGHT + 0.008, (first.z + last.z) / 2)
      mesh.scale.set(Math.abs(last.x - first.x) + 0.2, 1, Math.abs(last.z - first.z) + 0.2)
      mesh.visible = true
    }
    for (let i = used; i < pool.length; i++) pool[i].visible = false
  }

  function clearHighlights() {
    for (const mesh of pool) mesh.visible = false
  }

  // X-ray bars: built once, one instanced mesh, hidden until setXray(true).
  const barList = xrayBars()
  const barMaterial = new THREE.MeshStandardMaterial({ color: BAR_COLOR, metalness: 0.6, roughness: 0.4 })
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMaterial, barList.length)
  bars.name = 'xray-bar'
  const barY = HEIGHT - 0.12
  const scale = new THREE.Vector3()
  const position = new THREE.Vector3()
  const turn = new THREE.Quaternion()
  barList.forEach((bar, i) => {
    position.set(bar.x, barY, bar.z)
    if (bar.along === 'z') scale.set(BAR_WIDTH, BAR_HEIGHT, bar.length)
    else scale.set(bar.length, BAR_HEIGHT, BAR_WIDTH)
    bars.setMatrixAt(i, matrix.compose(position, turn, scale))
  })
  bars.instanceMatrix.needsUpdate = true
  bars.computeBoundingSphere()
  bars.visible = false
  group.add(bars)

  let xray = false
  // On: the body materials turn see-through (no depth writes, no shadows from
  // the body, so the bars stay lit) and the bars show. Callers invalidate.
  function setXray(on) {
    xray = Boolean(on)
    for (const material of [body, channel]) {
      material.transparent = xray
      material.opacity = xray ? XRAY_OPACITY : 1
      material.depthWrite = !xray
      material.needsUpdate = true
    }
    for (const mesh of slabs) mesh.castShadow = !xray
    bars.visible = xray
  }

  return { group, highlightPlaces, clearHighlights, setXray, isXray: () => xray }
}
