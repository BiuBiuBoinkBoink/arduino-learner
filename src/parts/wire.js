// Jumper wire as an arched tube. It leaves its start point and enters its end
// point vertically, and arches higher the further apart the ends are.
import * as THREE from 'three'

export const WIRE_COLORS = {
  red: 0xd0312d,
  black: 0x222222,
  yellow: 0xf2c81f,
  green: 0x2e9e4f,
  blue: 0x2c6fd1,
  orange: 0xf08a24,
  white: 0xf2f2f2
}

const RADIUS = 0.05
const MIN_RISE = 1
const RISE_PER_CM = 0.15

export function wireCurve(from, to) {
  const top = Math.max(from.y, to.y)
  const low = Math.min(from.y, to.y)
  const rise = MIN_RISE + RISE_PER_CM * from.distanceTo(to)
  // Both control points share height h; the midpoint of the curve is then at
  // (from.y + to.y) / 8 + 3h / 4, so pick h to put it rise above the top end.
  const h = (4 / 3) * (top + rise - (top + low) / 8)
  return new THREE.CubicBezierCurve3(
    from.clone(),
    new THREE.Vector3(from.x, h, from.z),
    new THREE.Vector3(to.x, h, to.z),
    to.clone()
  )
}

export function createWire({ color, from, to }) {
  if (!Object.hasOwn(WIRE_COLORS, color)) throw new Error(`Unknown wire color: ${color}`)
  const curve = wireCurve(from, to)
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 64, RADIUS, 8, false),
    new THREE.MeshStandardMaterial({ color: WIRE_COLORS[color], roughness: 0.5 })
  )
  mesh.castShadow = true
  const group = new THREE.Group()
  group.add(mesh)
  return { group, curve }
}
