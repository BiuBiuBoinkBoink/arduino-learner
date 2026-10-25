// Placement controller: picking parts up, placing them in holes and drawing
// wires on the canvas, while the circuit is being edited. Scene and DOM, not pure.
//
// createPlacement({ stage, board, breadboard, workbench, getItems, getValues,
//   tooltip, onChange, onHover }) -> { setEnabled(on), isEnabled(), pick(id),
//   toggleWire(on), setWireColor(color), cancel(), rotate(), moveBy(dColumn, dRow),
//   placeAt(name), confirm(), deleteSelected(), showMessage(text), refresh(),
//   setMarks(list), setLocked(ids), setHoverOnly(on), getState(), subscribe(fn) }
//
// setMarks([{ place, tone }]) adds strip highlights under placement's own (the
// step hints and mistakes); setLocked(ids) stops those kit parts being picked
// up (parts of later steps). buildGhost and disposeGroup are shared with the
// hint ghosts. setHoverOnly(true) keeps the hovered strip highlight and the
// hole tooltip while edit mode is off, with no picking (explore steps that
// count strip hovers); the arrow keys then move the hovered hole, starting at
// 15e, while the page itself has focus.
//
// Modes: idle, carry (fixed shapes), bend (resistor, ldr: two clicks) and wire
// (two clicks, repeating until turned off). The target is the hole or pin
// under the pointer, or the one the keyboard moved to. A click is a pointer up
// within 5 px (mouse) or 8 px (touch) of its pointer down; anything longer is
// an orbit drag, and a second finger leaves the gesture to the camera.
//
// Touch has no hover: a tap on a hole or pin moves the target there (the
// carried part's anchor, or the next end of a bend or wire) and shows the
// ghost and the hole tooltip for 2 s, but does not place. getState().touchReady
// is true while a tapped target waits; the tray then shows Place (confirm),
// Turn (rotate) and Cancel. In idle mode a tap picks up a placed part or
// selects a wire as a click does. On hover only steps a tap counts as a hover.
import * as THREE from 'three'
import { buildCircuit } from '../circuits/buildCircuit.js'
import { PART_TYPES, footprint, orientationCount, orientationOf, bendLegs } from '../circuits/footprints.js'
import { ALL_ROWS, isHole, parseHole, holeName } from '../circuits/holes.js'
import { placeOf, isPinName } from '../circuits/netlist.js'
import { nearestHole, HOLE_TOP_Y } from '../parts/breadboard.js'
import { nearestPin, PIN_TOP_Y } from '../parts/unoBoard.js'
import { autoWireColor } from '../build/wireColor.js'
import { REASONS } from '../build/workbench.js'

export const PLACEMENT_COPY = {
  idle: 'Pick a part from the tray, or click a placed part to move it.',
  carryLed: 'Click a hole for the long leg. R turns it. Escape puts it back.',
  carryTurn: 'Click to place. R turns it. Escape puts it back.',
  carry: 'Click to place. Escape puts it back.',
  bendFirst: 'Click a hole for one end.',
  bendSecond: 'Click a hole for the other end.',
  wireFirst: 'Click a pin on the Uno or a hole.',
  wireSecond: 'Click a hole for the other end.',
  selectedWire: 'Press Delete to remove this wire.'
}

const CLICK_SLOP_PX = 5
const TOUCH_SLOP_PX = 8
const TOUCH_TIP_MS = 2000
const BAD_COLOR = new THREE.Color(0xc0392b)
// Where the keyboard starts when nothing is targeted yet.
const START_HOLE = '15e'
const UP = new THREE.Vector3(0, 1, 0)

// A see-through copy of a circuit table (0.5 opacity, no shadows), its colours
// pulled towards tint when one is given; null when the table cannot be built.
export function buildGhost({ table, board, breadboard, values, tint = null }) {
  let built
  try {
    built = buildCircuit(table, { board, breadboard, values })
  } catch {
    return null
  }
  built.group.traverse((object) => {
    if (!object.isMesh) return
    const material = object.material.clone()
    object.material.dispose()
    material.transparent = true
    material.opacity = 0.5
    material.depthWrite = false
    if (tint && material.color) material.color.lerp(tint, 0.6)
    object.material = material
    object.castShadow = false
  })
  return built.group
}

export function disposeGroup(scene, group) {
  scene.remove(group)
  group.traverse((object) => {
    if (!object.isMesh) return
    object.geometry.dispose()
    object.material.dispose()
  })
}

export function createPlacement({ stage, board, breadboard, workbench, getItems, getValues, tooltip = null, onChange = () => {}, onHover = () => {} }) {
  const canvas = stage.renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const plane = new THREE.Plane()
  const point = new THREE.Vector3()
  const listeners = new Set()

  let enabled = false
  let mode = 'idle'
  let id = null
  let type = null
  let orientation = 0
  // Legs of a carried part before it was picked up; null for a tray part.
  let oldLegs = null
  // The first end of a bend or a wire.
  let first = null
  let target = null
  let selectedWire = null
  let message = null
  let wireColor = 'auto'
  let hoveredHole = null
  let down = null
  let ghost = null
  let ghostKey = null
  let hidden = null
  let marks = []
  let locked = []
  let hoverOnly = false
  // The last pointer was a finger: placing waits for Place.
  let touch = false
  const touches = new Set()
  let tipTimer = null

  function reset() {
    mode = 'idle'
    id = null
    type = null
    orientation = 0
    oldLegs = null
    first = null
    message = null
  }

  // The legs the current target would give, with whether they fit.
  function candidate() {
    if (!target) return null
    const fits = (legs) => {
      if (!legs) return { legs: null, ok: false, reason: REASONS.noFit }
      const result = workbench.canPlace(id, legs)
      return { legs, ok: result.ok, reason: result.ok ? null : result.reason }
    }
    if (mode === 'carry') return isHole(target) ? fits(footprint(type, target, orientation)) : null
    if (mode === 'bend' && first) {
      if (target === first) return null
      return isHole(target) ? fits(bendLegs(type, first, target)) : { legs: null, ok: false, reason: REASONS.noFit }
    }
    if (mode === 'wire' && first) {
      if (target === first) return null
      if (!isHole(target)) return { legs: null, ok: false, reason: REASONS.wireEnds }
      const result = workbench.canWire(first, target)
      return { legs: [first, target], ok: result.ok, reason: result.ok ? null : result.reason }
    }
    return null
  }

  function step() {
    return (mode === 'bend' || mode === 'wire') && first ? 2 : 1
  }

  function status(c = candidate()) {
    if (message) return message
    if (c && !c.ok) return c.reason
    if (mode === 'carry') {
      if (type === 'led') return PLACEMENT_COPY.carryLed
      return orientationCount(type) > 1 ? PLACEMENT_COPY.carryTurn : PLACEMENT_COPY.carry
    }
    if (mode === 'bend') return first ? PLACEMENT_COPY.bendSecond : PLACEMENT_COPY.bendFirst
    if (mode === 'wire') return first ? PLACEMENT_COPY.wireSecond : PLACEMENT_COPY.wireFirst
    return selectedWire ? PLACEMENT_COPY.selectedWire : PLACEMENT_COPY.idle
  }

  function getState() {
    const c = candidate()
    const touchReady = touch && enabled && mode !== 'idle' && target !== null && target !== first
    return { mode, id, candidate: c, step: step(), selectedWire, status: status(c), wireColor, target, first, touch, touchReady }
  }

  function chosenColor(from) {
    return wireColor === 'auto' ? autoWireColor(from, workbench.getBuild()) : wireColor
  }

  // Strip and rail highlights: what each leg or end will join.
  function places(c) {
    const list = []
    const add = (hole, tone) => {
      if (!isHole(hole)) return
      const place = placeOf(hole)
      if (!list.some((entry) => entry.place === place)) list.push({ place, tone })
    }
    if (first) add(first, 'info')
    if (c && c.legs) for (const hole of c.legs) add(hole, c.ok ? 'info' : 'bad')
    else if (target) add(target, c && !c.ok ? 'bad' : 'hover')
    if (mode === 'idle' && selectedWire) {
      const wire = workbench.getBuild().wires.find((item) => item.id === selectedWire)
      if (wire) for (const end of [wire.from, wire.to]) add(end, 'info')
    }
    return list
  }

  function disposeGhost() {
    if (!ghost) return
    disposeGroup(stage.scene, ghost)
    ghost = null
  }

  // A see-through copy of the carried part or the wire being drawn, tinted
  // red when it does not fit. Rebuilt only when its legs change.
  function updateGhost(c) {
    let table = null
    if (enabled && c && c.legs) {
      if (mode === 'wire') {
        table = { parts: [], wires: [{ id: 'ghost', from: c.legs[0], to: c.legs[1], color: chosenColor(c.legs[0]) }] }
      } else {
        const part = workbench.kitPart(id)
        if (part) table = { parts: [{ ...part, legs: c.legs }], wires: [] }
      }
    }
    const key = table ? JSON.stringify(table) + c.ok : null
    if (key === ghostKey) return
    ghostKey = key
    disposeGhost()
    if (!table) return
    ghost = buildGhost({ table, board, breadboard, values: getValues(), tint: c.ok ? null : BAD_COLOR })
    if (!ghost) return
    ghost.name = 'ghost'
    stage.scene.add(ghost)
  }

  // A part that was picked up is hidden while it is carried.
  function syncHidden() {
    const items = getItems()
    const want = enabled && oldLegs && (mode === 'carry' || mode === 'bend') && items && items[id] ? items[id].group : null
    if (hidden && hidden.group !== want) {
      hidden.group.visible = hidden.was
      hidden = null
    }
    if (want && !hidden) {
      hidden = { group: want, was: want.visible }
      want.visible = false
    }
  }

  function update() {
    const c = candidate()
    syncHidden()
    if (enabled || hoverOnly) {
      // Placement's own highlights win over a mark on the same place.
      const own = places(c)
      breadboard.highlightPlaces([...marks.filter((mark) => !own.some((entry) => entry.place === mark.place)), ...own])
    } else {
      breadboard.clearHighlights()
    }
    updateGhost(c)
    canvas.style.cursor = enabled && mode !== 'idle' ? 'crosshair' : ''
    stage.invalidate()
    const state = getState()
    listeners.forEach((fn) => fn(state))
  }

  function setRay(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, stage.camera)
  }

  // The hole or pin under the ray: the ray meets the board's top plane, in its local frame.
  function onBoard(group, localY, nearest) {
    const top = group.localToWorld(new THREE.Vector3(0, localY, 0)).y
    plane.set(UP, -top)
    if (!raycaster.ray.intersectPlane(plane, point)) return null
    const local = group.worldToLocal(point.clone())
    return nearest(local.x, local.z)
  }

  function targetUnderRay() {
    return onBoard(breadboard.group, HOLE_TOP_Y, nearestHole) || onBoard(board.group, PIN_TOP_Y, nearestPin)
  }

  // The placed part or wire under the ray: { part } or { wire }, or null.
  function itemUnderRay() {
    const items = getItems()
    if (!items) return null
    const groups = Object.values(items).map((item) => item.group).filter((group) => group.visible)
    const hit = raycaster.intersectObjects(groups, true)[0]
    let object = hit ? hit.object : null
    while (object && !object.userData.partId && !object.userData.wireId) object = object.parent
    if (!object) return null
    return object.userData.partId ? { part: object.userData.partId } : { wire: object.userData.wireId }
  }

  function setTarget(name) {
    if (name === target) return false
    target = name
    message = null
    return true
  }

  function startAnchor() {
    if (target && isHole(target)) return target
    if (first && isHole(first)) return first
    if (oldLegs) {
      const found = orientationOf(type, oldLegs)
      return found ? found.anchor : oldLegs[0]
    }
    return START_HOLE
  }

  function holeFree(hole) {
    const used = workbench.occupancy().get(hole)
    return !used || (mode !== 'wire' && used.kind === 'leg' && used.id === id)
  }

  function pinFree(pin) {
    return !workbench.getBuild().wires.some((wire) => wire.from === pin)
  }

  function finished() {
    reset()
    update()
    onChange()
  }

  function pick(partId) {
    if (!enabled) return
    const part = workbench.kitPart(partId)
    if (!part || !PART_TYPES[part.type] || locked.includes(partId)) return
    reset()
    selectedWire = null
    id = partId
    type = part.type
    mode = PART_TYPES[type].shape === 'bend' ? 'bend' : 'carry'
    const placed = workbench.getBuild().parts.find((item) => item.id === partId)
    oldLegs = placed ? placed.legs : null
    if (oldLegs && mode === 'carry') {
      const found = orientationOf(type, oldLegs)
      if (found) {
        orientation = found.orientation
        target = found.anchor
      }
    }
    update()
  }

  function confirm() {
    if (!enabled || mode === 'idle') return false
    const c = candidate()
    if (mode === 'carry') {
      if (!c) return false
      if (!c.ok) {
        message = c.reason
        update()
        return false
      }
      workbench.place(id, c.legs)
      finished()
      return true
    }
    if (!first) {
      if (!target) return false
      if (mode === 'bend' && !isHole(target)) message = REASONS.noFit
      else if (isHole(target) ? !holeFree(target) : !pinFree(target)) message = REASONS.holeUsed
      else if (mode === 'wire' && workbench.tray().wires.used >= workbench.tray().wires.total) message = REASONS.noWires
      else first = target
      if (touch && first) target = null
      update()
      return first !== null
    }
    if (!c) return false
    if (!c.ok) {
      message = c.reason
      update()
      return false
    }
    if (mode === 'bend') {
      workbench.place(id, c.legs)
      finished()
      return true
    }
    workbench.addWire(first, target, wireColor === 'auto' ? undefined : wireColor)
    first = null
    if (touch) target = null
    message = null
    update()
    onChange()
    return true
  }

  function cancel() {
    if (mode === 'bend' || mode === 'wire') {
      if (first) first = null
      else reset()
    } else if (mode === 'carry') {
      reset()
    } else {
      selectedWire = null
    }
    message = null
    update()
  }

  function rotate() {
    if (mode !== 'carry' || orientationCount(type) < 2) return
    orientation = (orientation + 1) % orientationCount(type)
    message = null
    update()
  }

  function moveBy(dColumn, dRow) {
    if (!enabled || mode === 'idle') return
    if (!target || !isHole(target)) {
      setTarget(startAnchor())
      update()
      return
    }
    const { column, row } = parseHole(target)
    const nextColumn = Math.min(30, Math.max(1, column + dColumn))
    const index = Math.min(ALL_ROWS.length - 1, Math.max(0, ALL_ROWS.indexOf(row) + dRow))
    setTarget(holeName(nextColumn, ALL_ROWS[index]))
    update()
  }

  function placeAt(name) {
    if (!enabled || !(isHole(name) || isPinName(name))) return false
    setTarget(name)
    update()
    return true
  }

  function deleteSelected() {
    if (!enabled) return
    if (mode === 'idle' && selectedWire) {
      workbench.removeWire(selectedWire)
      selectedWire = null
      update()
      onChange()
    } else if ((mode === 'carry' || mode === 'bend') && oldLegs) {
      workbench.remove(id)
      finished()
    }
  }

  function toggleWire(on) {
    if (!enabled) return
    reset()
    selectedWire = null
    if (on) mode = 'wire'
    update()
  }

  function setWireColor(color) {
    wireColor = color || 'auto'
    update()
  }

  function setEnabled(on) {
    enabled = Boolean(on)
    reset()
    selectedWire = null
    target = null
    hoveredHole = null
    if (tooltip) tooltip.hide()
    update()
  }

  function showMessage(text) {
    message = text
    update()
  }

  function setMarks(list) {
    marks = Array.isArray(list) ? list.slice() : []
    update()
  }

  function setLocked(ids) {
    locked = Array.isArray(ids) ? ids.slice() : []
    if (id !== null && locked.includes(id) && (mode === 'carry' || mode === 'bend')) {
      reset()
      update()
    }
  }

  function click() {
    if (mode !== 'idle') {
      confirm()
      return
    }
    const item = itemUnderRay()
    if (item && item.part) {
      pick(item.part)
      return
    }
    selectedWire = item && item.wire ? item.wire : wireEndingAt(target)
    update()
  }

  // Wires are thin, so clicking the hole or pin a wire ends in selects it too.
  function wireEndingAt(name) {
    if (!name) return null
    const wire = workbench.getBuild().wires.find((item) => item.from === name || item.to === name)
    return wire ? wire.id : null
  }

  function hover(event) {
    const name = targetUnderRay()
    const changed = setTarget(name)
    const hole = name && isHole(name) ? name : null
    if (hole !== hoveredHole) {
      hoveredHole = hole
      onHover(hole)
    }
    if (tooltip) {
      if (name) tooltip.show(name, event.clientX, event.clientY)
      else tooltip.hide()
    }
    if (changed) update()
  }

  // A tap: move the target to the hole or pin under the finger, show its
  // tooltip for a while, and on hover only steps count it as a hover.
  function tap(event) {
    const name = targetUnderRay()
    if (enabled && mode === 'idle') {
      setTarget(name)
      click()
    } else {
      if (name) setTarget(name)
      const hole = name && isHole(name) ? name : null
      if (!enabled && hole !== hoveredHole) {
        hoveredHole = hole
        onHover(hole)
      }
      update()
    }
    if (!tooltip) return
    clearTimeout(tipTimer)
    if (!name) {
      tooltip.hide()
      return
    }
    tooltip.show(name, event.clientX, event.clientY)
    tipTimer = setTimeout(() => tooltip.hide(), TOUCH_TIP_MS)
  }

  canvas.addEventListener('pointerdown', (event) => {
    const isTouch = event.pointerType === 'touch'
    if (isTouch) touches.add(event.pointerId)
    else if (touch) {
      touch = false
      update()
    }
    const active = enabled || (hoverOnly && isTouch)
    down = active && event.button === 0 && touches.size <= 1 ? { x: event.clientX, y: event.clientY } : null
  })

  function endTouch(event) {
    touches.delete(event.pointerId)
  }

  canvas.addEventListener('pointerup', (event) => {
    const isTouch = event.pointerType === 'touch'
    if (isTouch) endTouch(event)
    if (!down || (!enabled && !(hoverOnly && isTouch))) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    down = null
    if (moved > (isTouch ? TOUCH_SLOP_PX : CLICK_SLOP_PX)) return
    setRay(event)
    if (isTouch) {
      touch = true
      tap(event)
      return
    }
    hover(event)
    click()
  })

  canvas.addEventListener('pointercancel', (event) => {
    endTouch(event)
    down = null
  })

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return
    if ((!enabled && !hoverOnly) || event.buttons !== 0) return
    setRay(event)
    hover(event)
  })

  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return
    if (!enabled && !hoverOnly) return
    if (tooltip) tooltip.hide()
    if (hoveredHole) {
      hoveredHole = null
      onHover(null)
    }
    if (setTarget(null)) update()
  })

  // Keyboard path: arrows move the target, R turns, Enter places, Escape
  // cancels, Delete removes. Ignored in text fields (the tray handles Enter in
  // its own inputs) and Enter is left to a focused button.
  window.addEventListener('keydown', (event) => {
    if (!enabled && hoverOnly) {
      hoverKey(event)
      return
    }
    if (!enabled || (mode === 'idle' && !selectedWire)) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const element = event.target
    const tag = element && element.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (element && element.isContentEditable)) {
      if (event.key === 'Escape' && element.closest && element.closest('#parts-tray')) {
        event.preventDefault()
        cancel()
      }
      return
    }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (Object.hasOwn(moves, event.key)) moveBy(...moves[event.key])
    else if (event.key === 'r' || event.key === 'R') rotate()
    else if (event.key === 'Enter' && tag !== 'BUTTON') confirm()
    else if (event.key === 'Escape') cancel()
    else if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected()
    else return
    event.preventDefault()
  })

  // Hover only keyboard path: the arrows move the hovered hole while nothing
  // else on the page has focus (so tabs and menus keep their own arrows).
  function hoverKey(event) {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (!Object.hasOwn(moves, event.key) || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.target !== document.body && event.target !== canvas) return
    event.preventDefault()
    const [dColumn, dRow] = moves[event.key]
    let next = START_HOLE
    if (target && isHole(target)) {
      const { column, row } = parseHole(target)
      const index = Math.min(ALL_ROWS.length - 1, Math.max(0, ALL_ROWS.indexOf(row) + dRow))
      next = holeName(Math.min(30, Math.max(1, column + dColumn)), ALL_ROWS[index])
    }
    setTarget(next)
    hoveredHole = next
    onHover(next)
    update()
  }

  function setHoverOnly(on) {
    if (Boolean(on) === hoverOnly) return
    hoverOnly = Boolean(on)
    if (!enabled) {
      target = null
      hoveredHole = null
      if (tooltip) tooltip.hide()
    }
    update()
  }

  // Undo, reset or a lesson change drop whatever is being carried.
  workbench.subscribe((event) => {
    if (['undo', 'reset', 'load'].includes(event.type) && (mode !== 'idle' || selectedWire)) {
      reset()
      selectedWire = null
    }
  })

  // After the circuit view rebuilds: hide the carried part again, redraw.
  function refresh() {
    const items = getItems()
    if (hidden && !(items && Object.values(items).some((item) => item.group === hidden.group))) hidden = null
    update()
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return {
    setEnabled,
    isEnabled: () => enabled,
    pick,
    toggleWire,
    setWireColor,
    cancel,
    rotate,
    moveBy,
    placeAt,
    confirm,
    deleteSelected,
    showMessage,
    refresh,
    setMarks,
    setLocked,
    setHoverOnly,
    isLocked: (partId) => locked.includes(partId),
    getState,
    subscribe
  }
}
