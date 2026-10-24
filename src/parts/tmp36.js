// Procedural TMP36 temperature sensor in a TO-92 case: a black half cylinder
// with its flat face towards the viewer (+z), on three legs (+Vs, Vout, GND
// from left to right). Leg end points are given in the parent frame.
import * as THREE from 'three'

const LEG_RADIUS = 0.022
const LEG_HEIGHT = 0.4
const BODY_RADIUS = 0.24
const BODY_HEIGHT = 0.5

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createTmp36({ legs }) {
  if (legs.length !== 3) throw new Error('A TMP36 needs 3 legs')
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const black = new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.55 })

  const baseY = Math.max(...legs.map((leg) => leg.y)) + LEG_HEIGHT
  const mid = legs[1]

  // Half cylinder: the round back faces -z, the flat face +z.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_HEIGHT, 24, 1, false, Math.PI / 2, Math.PI),
    black
  )
  body.position.set(mid.x, baseY + BODY_HEIGHT / 2, mid.z)
  body.castShadow = true
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(BODY_RADIUS * 2, BODY_HEIGHT), black)
  flat.position.set(mid.x, baseY + BODY_HEIGHT / 2, mid.z)
  flat.castShadow = true
  group.add(body, flat)

  for (const leg of legs) group.add(rod(leg, new THREE.Vector3(leg.x, baseY, leg.z), metal))

  return { group }
}
