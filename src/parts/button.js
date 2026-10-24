// Procedural 4 leg tactile push button. Leg end points are given in the parent
// frame (hole tops); the square body sits above their middle with a round cap
// that moves down while pressed. The group is tagged pressable for raycasts.
import * as THREE from 'three'

const LEG_RADIUS = 0.022
const LIFT = 0.08
const BODY_SIZE = 0.6
const BODY_HEIGHT = 0.3
const CAP_RADIUS = 0.17
const CAP_HEIGHT = 0.18
const PRESS_DEPTH = 0.05

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createButton({ legs }) {
  const group = new THREE.Group()
  group.userData.pressable = true
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.7 })
  const capMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.5 })

  const baseY = Math.max(...legs.map((leg) => leg.y)) + LIFT
  const mid = legs.reduce((sum, leg) => sum.add(leg), new THREE.Vector3()).multiplyScalar(1 / legs.length)

  const body = new THREE.Mesh(new THREE.BoxGeometry(BODY_SIZE, BODY_HEIGHT, BODY_SIZE), dark)
  body.position.set(mid.x, baseY + BODY_HEIGHT / 2, mid.z)
  body.castShadow = true
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(CAP_RADIUS, CAP_RADIUS, CAP_HEIGHT, 24), capMaterial)
  const capY = baseY + BODY_HEIGHT + CAP_HEIGHT / 2
  cap.position.set(mid.x, capY, mid.z)
  cap.castShadow = true
  group.add(body, cap)

  // Each leg runs straight up from its point, then bends in to the body edge.
  const edge = BODY_SIZE / 2 - LEG_RADIUS
  for (const leg of legs) {
    const top = new THREE.Vector3(leg.x, baseY, leg.z)
    const inner = new THREE.Vector3(
      mid.x + THREE.MathUtils.clamp(leg.x - mid.x, -edge, edge),
      baseY,
      mid.z + THREE.MathUtils.clamp(leg.z - mid.z, -edge, edge)
    )
    group.add(rod(leg, top, metal))
    if (inner.distanceTo(top) > 1e-6) group.add(rod(top, inner, metal))
  }

  function setPressed(on) {
    cap.position.y = on ? capY - PRESS_DEPTH : capY
  }

  return { group, setPressed }
}
