// Procedural 5 mm LED standing on its two legs. Leg end points are given in
// the parent frame (hole tops); the body stands above their midpoint. The
// anode leg has a kink so the two legs can be told apart.
import * as THREE from 'three'

const COLORS = {
  red: 0xe8322a,
  green: 0x2fbf4a,
  yellow: 0xf2c81f,
  blue: 0x2f6fe0
}

const LEG_RADIUS = 0.022
const LEG_HEIGHT = 0.6
const DOME_RADIUS = 0.25
const DOME_HEIGHT = 0.55
const FLANGE_RADIUS = 0.29
const FLANGE_HEIGHT = 0.1

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

function addLeg(group, points, mat) {
  for (let i = 0; i < points.length - 1; i++) group.add(rod(points[i], points[i + 1], mat))
}

export function createLed({ color, anode, cathode }) {
  if (!Object.hasOwn(COLORS, color)) throw new Error(`Unknown LED color: ${color}`)
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const lens = new THREE.MeshStandardMaterial({
    color: COLORS[color],
    roughness: 0.25,
    transparent: true,
    opacity: 0.8
  })

  const baseY = Math.max(anode.y, cathode.y) + LEG_HEIGHT
  const mid = anode.clone().add(cathode).multiplyScalar(0.5)

  const flange = new THREE.Mesh(new THREE.CylinderGeometry(FLANGE_RADIUS, FLANGE_RADIUS, FLANGE_HEIGHT, 24), lens)
  flange.position.set(mid.x, baseY + FLANGE_HEIGHT / 2, mid.z)
  flange.castShadow = true
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(DOME_RADIUS, DOME_RADIUS, DOME_HEIGHT, 24), lens)
  dome.position.set(mid.x, baseY + FLANGE_HEIGHT + DOME_HEIGHT / 2, mid.z)
  dome.castShadow = true
  const cap = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens)
  cap.position.set(mid.x, baseY + FLANGE_HEIGHT + DOME_HEIGHT, mid.z)
  cap.castShadow = true
  group.add(flange, dome, cap)

  // Cathode leg runs straight up; the anode leg jogs outwards halfway up.
  addLeg(group, [cathode, new THREE.Vector3(cathode.x, baseY, cathode.z)], metal)
  const out = new THREE.Vector3(anode.x - cathode.x, 0, anode.z - cathode.z).normalize().multiplyScalar(0.09)
  const span = baseY - anode.y
  addLeg(group, [
    anode,
    new THREE.Vector3(anode.x, anode.y + span * 0.35, anode.z),
    new THREE.Vector3(anode.x, anode.y + span * 0.5, anode.z).add(out),
    new THREE.Vector3(anode.x, anode.y + span * 0.65, anode.z),
    new THREE.Vector3(anode.x, baseY, anode.z)
  ], metal)
  return { group }
}
