// Procedural SG90 style micro servo lying on the breadboard to the right of its
// three pin cable ends (GND brown, 5V red, signal orange), which are given as
// hole tops in the parent frame. A white one arm horn on the output shaft turns
// with setAngle: 90 deg points straight ahead (-z), 0 deg to the right (+x),
// 180 deg to the left (-x), as seen from above.
import * as THREE from 'three'

const BODY_LENGTH = 2.3
const BODY_DEPTH = 1.2
const BODY_HEIGHT = 2.2
const TAB_LENGTH = 3.2
const TAB_HEIGHT = 0.25
// Gap from the signal cable end to the body.
const BODY_GAP = 1.2
const SHAFT_RADIUS = 0.25
const SHAFT_HEIGHT = 0.3
const HORN_LENGTH = 1.6
const HORN_WIDTH = 0.35
const HORN_THICKNESS = 0.15
const CABLE_RADIUS = 0.035
const CABLE_COLORS = [0x6b3f1f, 0xd0312d, 0xf08a24]

export function createServo({ legs }) {
  if (legs.length !== 3) throw new Error('A servo needs 3 cable ends')
  const group = new THREE.Group()
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.5, transparent: true, opacity: 0.92 })
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 })

  const baseY = Math.max(...legs.map((leg) => leg.y))
  const end = legs[2]
  const centre = new THREE.Vector3(end.x + BODY_GAP + BODY_LENGTH / 2, baseY, legs[1].z)

  const body = new THREE.Mesh(new THREE.BoxGeometry(BODY_LENGTH, BODY_HEIGHT, BODY_DEPTH), blue)
  body.position.set(centre.x, baseY + BODY_HEIGHT / 2, centre.z)
  body.castShadow = true
  const tabs = new THREE.Mesh(new THREE.BoxGeometry(TAB_LENGTH, TAB_HEIGHT, BODY_DEPTH), blue)
  tabs.position.set(centre.x, baseY + BODY_HEIGHT * 0.7, centre.z)
  tabs.castShadow = true
  group.add(body, tabs)

  // Output shaft near the end away from the cable, horn on top of it.
  const shaft = new THREE.Group()
  shaft.name = 'shaft'
  shaft.position.set(centre.x + BODY_LENGTH / 2 - SHAFT_RADIUS * 1.6, baseY + BODY_HEIGHT, centre.z)
  const spline = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, SHAFT_HEIGHT, 20), white)
  spline.position.y = SHAFT_HEIGHT / 2
  spline.castShadow = true
  const horn = new THREE.Mesh(new THREE.BoxGeometry(HORN_WIDTH, HORN_THICKNESS, HORN_LENGTH), white)
  horn.name = 'horn'
  horn.position.set(0, SHAFT_HEIGHT + HORN_THICKNESS / 2, -HORN_LENGTH / 2 + HORN_WIDTH / 2)
  horn.castShadow = true
  shaft.add(spline, horn)
  group.add(shaft)

  // Each cable rises out of its hole, then runs into the body side.
  legs.forEach((leg, i) => {
    const entry = new THREE.Vector3(centre.x - BODY_LENGTH / 2, baseY + 0.4 + i * 0.08, centre.z + (i - 1) * 0.08)
    const curve = new THREE.CubicBezierCurve3(
      leg.clone(),
      new THREE.Vector3(leg.x, baseY + 0.6, leg.z),
      new THREE.Vector3(entry.x - 0.5, entry.y, entry.z),
      entry
    )
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, CABLE_RADIUS, 6, false),
      new THREE.MeshStandardMaterial({ color: CABLE_COLORS[i], roughness: 0.6 })
    )
    cable.castShadow = true
    group.add(cable)
  })

  function setAngle(degrees) {
    const angle = Math.min(180, Math.max(0, degrees))
    shaft.rotation.y = THREE.MathUtils.degToRad(angle - 90)
  }
  setAngle(90)

  return { group, setAngle }
}
