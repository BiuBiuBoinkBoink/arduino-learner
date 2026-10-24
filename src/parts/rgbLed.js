// Procedural 5 mm common cathode RGB LED on four legs in a row: red, cathode,
// green, blue. Leg end points are given in the parent frame (hole tops). The
// diffused lens glows in the mix of its three channel levels.
import * as THREE from 'three'

const LEG_RADIUS = 0.022
const LEG_HEIGHT = 0.6
const DOME_RADIUS = 0.27
const DOME_HEIGHT = 0.55
const FLANGE_RADIUS = 0.31
const FLANGE_HEIGHT = 0.1
// Lower than a single colour LED, so mixed hues do not wash out to white.
const LIT_INTENSITY = 0.9
const LENS_COLOR = 0xf2f2ee
// The cathode is the longest leg, so it rises a little higher into the body.
const CATHODE_EXTRA = 0.08

// Metal rod between two points.
function rod(a, b, mat) {
  const length = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, length, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  mesh.castShadow = true
  return mesh
}

export function createRgbLed({ legs }) {
  if (legs.length !== 4) throw new Error('An RGB LED needs 4 legs')
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.6, roughness: 0.35 })
  const lens = new THREE.MeshStandardMaterial({
    color: LENS_COLOR,
    roughness: 0.4,
    transparent: true,
    opacity: 0.85
  })

  const baseY = Math.max(...legs.map((leg) => leg.y)) + LEG_HEIGHT
  const mid = legs[0].clone().add(legs[3]).multiplyScalar(0.5)

  const flange = new THREE.Mesh(new THREE.CylinderGeometry(FLANGE_RADIUS, FLANGE_RADIUS, FLANGE_HEIGHT, 24), lens)
  flange.position.set(mid.x, baseY + FLANGE_HEIGHT / 2, mid.z)
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(DOME_RADIUS, DOME_RADIUS, DOME_HEIGHT, 24), lens)
  dome.position.set(mid.x, baseY + FLANGE_HEIGHT + DOME_HEIGHT / 2, mid.z)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens)
  cap.position.set(mid.x, baseY + FLANGE_HEIGHT + DOME_HEIGHT, mid.z)
  for (const mesh of [flange, dome, cap]) mesh.castShadow = true
  group.add(flange, dome, cap)

  legs.forEach((leg, i) => {
    const top = new THREE.Vector3(leg.x, baseY + (i === 1 ? CATHODE_EXTRA : 0), leg.z)
    group.add(rod(leg, top, metal))
  })

  // Channel levels 0 to 1 mix into one emissive colour; all zero has no glow.
  function setColor(r, g, b) {
    const [red, green, blue] = [r, g, b].map((v) => Math.min(1, Math.max(0, v)))
    const peak = Math.max(red, green, blue)
    if (peak === 0) {
      lens.color.setHex(LENS_COLOR)
      lens.emissive.setHex(0x000000)
      lens.emissiveIntensity = 1
      return
    }
    // Hue from the mix read as sRGB, like a colour picker, so 255, 128, 0 looks
    // orange; glow strength from the brightest channel. The diffused lens takes
    // on the hue too, so it does not wash out to white.
    const hue = new THREE.Color().setRGB(red / peak, green / peak, blue / peak, THREE.SRGBColorSpace)
    lens.color.setHex(LENS_COLOR).lerp(hue, peak)
    lens.emissive.copy(hue)
    lens.emissiveIntensity = LIT_INTENSITY * peak
  }

  return { group, setColor }
}
