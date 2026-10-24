// Procedural potentiometer: a blue body about 1 cm square on three legs (outer,
// wiper, outer), with a round knob on top that turns over 270 degrees. Leg end
// points are given in the parent frame (hole tops). The group is tagged
// turnable for raycasts.
import * as THREE from 'three'

const LEG_RADIUS = 0.022
const LIFT = 0.1
const BODY_SIZE = 1
const BODY_HEIGHT = 0.45
const KNOB_RADIUS = 0.34
const KNOB_HEIGHT = 0.3
const POINTER_WIDTH = 0.06
const POINTER_HEIGHT = 0.02
// Full travel; value 0.5 points straight ahead (-z).
const SWEEP = THREE.MathUtils.degToRad(270)

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createPotentiometer({ legs }) {
  const group = new THREE.Group()
  group.userData.turnable = true
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const blue = new THREE.MeshStandardMaterial({ color: 0x2c5fb3, roughness: 0.6 })
  const knobMaterial = new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.5 })
  const markMaterial = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6 })

  const baseY = Math.max(...legs.map((leg) => leg.y)) + LIFT
  const mid = legs[1]

  const body = new THREE.Mesh(new THREE.BoxGeometry(BODY_SIZE, BODY_HEIGHT, BODY_SIZE), blue)
  body.position.set(mid.x, baseY + BODY_HEIGHT / 2, mid.z)
  body.castShadow = true
  group.add(body)

  // The knob turns about its own vertical axis; the pointer mark rides on top.
  const knob = new THREE.Group()
  knob.name = 'knob'
  knob.position.set(mid.x, baseY + BODY_HEIGHT, mid.z)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(KNOB_RADIUS, KNOB_RADIUS, KNOB_HEIGHT, 32), knobMaterial)
  cap.position.y = KNOB_HEIGHT / 2
  cap.castShadow = true
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(POINTER_WIDTH, POINTER_HEIGHT, KNOB_RADIUS * 0.8), markMaterial)
  pointer.name = 'pointer'
  pointer.position.set(0, KNOB_HEIGHT + POINTER_HEIGHT / 2, -KNOB_RADIUS * 0.45)
  pointer.castShadow = true
  knob.add(cap, pointer)
  group.add(knob)

  for (const leg of legs) group.add(rod(leg, new THREE.Vector3(leg.x, baseY, leg.z), metal))

  // Rising values turn clockwise seen from above, which is a negative turn about +y.
  function setValue(v) {
    const value = Math.min(1, Math.max(0, v))
    knob.rotation.y = -(value - 0.5) * SWEEP
  }
  setValue(0.5)

  return { group, setValue }
}
