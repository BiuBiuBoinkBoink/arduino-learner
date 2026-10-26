// Current trace in the scene: eight small glowing spheres move along a
// tracePath result at 2 cm per second for 6 seconds, then everything goes.
// Wire hops follow the drawn wire's curve, strip hops run straight just above
// the holes and part hops run straight leg to leg 0.3 cm above the board. At a
// stop a red ring sits on the stop hole with a pinned label 'The path stops
// here'. Under reduced motion a still accent tube shows the path for the 6
// seconds instead. Scene and DOM, not pure.
//
// createCurrentTrace({ stage, board, breadboard, getItems, setLabels })
//   -> { show(path), clear() }
// setLabels(list) pins the stop label ([] removes it).
import * as THREE from 'three'
import { isHole } from '../circuits/holes.js'
import { holePosition } from '../parts/breadboard.js'
import { unoPinPosition, UNO_PIN_NAMES } from '../parts/unoBoard.js'
import { wireCurve } from '../parts/wire.js'

export const TRACE_MS = 6000
export const DOT_COUNT = 8
const SPEED_CM_PER_S = 2
const DOT_RADIUS = 0.035
const ACCENT = 0x2f6fd6
const STOP_COLOR = 0xc0392b
const STRIP_LIFT = 0.05
const PART_LIFT = 0.3
const LABEL_LIFT = 0.3
export const STOP_TEXT = 'The path stops here'

export function createCurrentTrace({ stage, board, breadboard, getItems, setLabels }) {
  let group = null
  let frame = null
  let started = 0
  let points = []
  let lengths = []
  let dots = []

  function pointOf(name) {
    if (isHole(name)) {
      breadboard.group.updateWorldMatrix(true, false)
      return breadboard.group.localToWorld(holePosition(name))
    }
    if (UNO_PIN_NAMES.includes(name)) {
      board.group.updateWorldMatrix(true, false)
      return board.group.localToWorld(unoPinPosition(name))
    }
    return null
  }

  const lifted = (point, y) => point.clone().add(new THREE.Vector3(0, y, 0))

  // The path as one polyline of world points.
  function polyline(hops) {
    const out = []
    const push = (point) => {
      if (point && (out.length === 0 || out[out.length - 1].distanceTo(point) > 1e-6)) out.push(point)
    }
    const items = getItems() || {}
    for (const hop of hops) {
      const from = pointOf(hop.from)
      const to = pointOf(hop.to)
      if (!from || !to) continue
      if (hop.kind === 'wire') {
        const item = items[hop.id]
        const curve = item && item.curve ? item.curve : wireCurve(from, to)
        let samples = curve.getPoints(24)
        if (samples[0].distanceTo(from) > samples[samples.length - 1].distanceTo(from)) samples = samples.reverse()
        samples.forEach(push)
      } else {
        const lift = hop.kind === 'part' ? PART_LIFT : STRIP_LIFT
        push(lifted(from, lift))
        push(lifted(to, lift))
      }
    }
    return out
  }

  function pointAt(distance) {
    const total = lengths[lengths.length - 1]
    const d = ((distance % total) + total) % total
    let i = 1
    while (i < lengths.length - 1 && lengths[i] < d) i++
    const span = lengths[i] - lengths[i - 1] || 1
    return points[i - 1].clone().lerp(points[i], (d - lengths[i - 1]) / span)
  }

  function tick(time) {
    frame = null
    if (!group) return
    const elapsed = time - started
    if (elapsed >= TRACE_MS) {
      clear()
      return
    }
    const total = lengths[lengths.length - 1]
    dots.forEach((dot, i) => dot.position.copy(pointAt((elapsed / 1000) * SPEED_CM_PER_S + (i * total) / DOT_COUNT)))
    stage.invalidate()
    frame = requestAnimationFrame(tick)
  }

  function clear() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    clearTimeout(stillTimer)
    stillTimer = null
    if (group) {
      stage.scene.remove(group)
      group.traverse((object) => {
        if (!object.isMesh) return
        object.geometry.dispose()
        object.material.dispose()
      })
      group = null
    }
    dots = []
    setLabels([])
    stage.invalidate()
  }

  let stillTimer = null
  function show(path) {
    clear()
    group = new THREE.Group()
    group.name = 'current-trace'
    points = polyline(path.hops || [])
    lengths = [0]
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]))
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (points.length > 1) {
      if (still) {
        const curve = new THREE.CurvePath()
        for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1], points[i]))
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), 0.02, 6, false), new THREE.MeshBasicMaterial({ color: ACCENT }))
        group.add(tube)
      } else {
        dots = Array.from({ length: DOT_COUNT }, () => {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(DOT_RADIUS, 12, 8), new THREE.MeshBasicMaterial({ color: ACCENT }))
          group.add(dot)
          return dot
        })
      }
    }
    const stopPoint = path.stop ? pointOf(path.stop.hole) : null
    if (stopPoint) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.12, 24), new THREE.MeshBasicMaterial({ color: STOP_COLOR, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(lifted(stopPoint, 0.01))
      ring.renderOrder = 3
      group.add(ring)
      setLabels([{ id: 'trace-stop', position: lifted(stopPoint, LABEL_LIFT), text: STOP_TEXT, tone: 'bad' }])
    }
    stage.scene.add(group)
    stage.invalidate()
    started = performance.now()
    if (dots.length > 0) frame = requestAnimationFrame(tick)
    else stillTimer = setTimeout(clear, TRACE_MS)
  }

  return { show, clear }
}
