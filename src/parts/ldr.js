// Procedural photoresistor (LDR): a small upright disc with a wavy cadmium
// sulphide track on its face, on two legs. Leg end points are given in the
// parent frame (hole tops).
import * as THREE from 'three'

const LEG_RADIUS = 0.022
const LEG_HEIGHT = 0.45
const DISC_RADIUS = 0.25
const DISC_DEPTH = 0.12
const TRACK_RADIUS = 0.018

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createLdr({ from, to }) {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const face = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.4 })
  const trackMaterial = new THREE.MeshStandardMaterial({ color: 0xb5562a, roughness: 0.6 })

  const baseY = Math.max(from.y, to.y) + LEG_HEIGHT
  const mid = from.clone().add(to).multiplyScalar(0.5)
  const across = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize()

  // The disc stands upright with its face across the legs, facing the viewer side.
  const head = new THREE.Group()
  head.position.set(mid.x, baseY + DISC_RADIUS, mid.z)
  head.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), across)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_DEPTH, 28), face)
  disc.rotation.x = Math.PI / 2
  disc.castShadow = true
  head.add(disc)

  // Wavy track across the face, a zigzag tube just proud of the front.
  const points = []
  for (let i = 0; i <= 8; i++) {
    const x = -DISC_RADIUS * 0.7 + (i / 8) * DISC_RADIUS * 1.4
    const y = (i % 2 === 0 ? 1 : -1) * DISC_RADIUS * 0.45
    points.push(new THREE.Vector3(x, y, DISC_DEPTH / 2 + TRACK_RADIUS))
  }
  const track = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, TRACK_RADIUS, 6, false),
    trackMaterial
  )
  track.castShadow = true
  head.add(track)
  group.add(head)

  for (const leg of [from, to]) group.add(rod(leg, new THREE.Vector3(leg.x, baseY + DISC_RADIUS * 0.3, leg.z), metal))

  return { group }
}
