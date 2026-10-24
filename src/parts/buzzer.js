// Procedural passive piezo buzzer: a black round case with a sound hole on
// top, on two legs (positive, negative). Leg end points are given in the
// parent frame (hole tops). setPlaying shows a faint ring above the hole
// while a tone plays.
import * as THREE from 'three'

const LEG_RADIUS = 0.022
const LIFT = 0.08
const CASE_RADIUS = 0.6
const CASE_HEIGHT = 0.45
const HOLE_RADIUS = 0.1
const RING_RADIUS = 0.32

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createBuzzer({ legs }) {
  if (legs.length !== 2) throw new Error('A buzzer needs 2 legs')
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const black = new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.5 })
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 })
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x2f6fd6, transparent: true, opacity: 0.55 })

  const baseY = Math.max(...legs.map((leg) => leg.y)) + LIFT
  const mid = legs[0].clone().add(legs[1]).multiplyScalar(0.5)
  const topY = baseY + CASE_HEIGHT

  const body = new THREE.Mesh(new THREE.CylinderGeometry(CASE_RADIUS, CASE_RADIUS, CASE_HEIGHT, 36), black)
  body.position.set(mid.x, baseY + CASE_HEIGHT / 2, mid.z)
  body.castShadow = true
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(HOLE_RADIUS, HOLE_RADIUS, 0.01, 20), holeMaterial)
  hole.position.set(mid.x, topY + 0.005, mid.z)
  hole.castShadow = true
  group.add(body, hole)

  // Sound ring: a flat torus hovering over the hole, hidden while silent.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.02, 8, 40), ringMaterial)
  ring.name = 'sound-ring'
  ring.rotation.x = Math.PI / 2
  ring.position.set(mid.x, topY + 0.12, mid.z)
  ring.visible = false
  ring.castShadow = true
  group.add(ring)

  for (const leg of legs) group.add(rod(leg, new THREE.Vector3(leg.x, baseY, leg.z), metal))

  function setPlaying(on) {
    ring.visible = Boolean(on)
  }

  return { group, setPlaying }
}
