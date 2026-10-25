// Step marks: what the current build or wire step shows in the scene. Strip
// highlights go through placement (under its own), pin rings through the
// board, the show me suggestion is drawn as accent ghosts, and labels are
// pinned at holes or pins. Scene and DOM, not pure.
//
// createStepMarks({ stage, board, breadboard, placement, labels, getValues })
//   -> { set({ places, pins, ghost, labels }), clear() }
// places: [{ place, tone }]; pins: [names]; ghost: a circuit table or null;
// labels: [{ id, at: [holes or pins], text, tone }], placed above the middle
// of their points.
import * as THREE from 'three'
import { isHole } from '../circuits/holes.js'
import { holePosition } from '../parts/breadboard.js'
import { unoPinPosition, UNO_PIN_NAMES } from '../parts/unoBoard.js'
import { buildGhost, disposeGroup } from './placement.js'

const ACCENT = new THREE.Color(0x2f6fd6)
// Labels sit a little above the hole tops, so the pointer clears the parts.
const LABEL_LIFT = 0.25

export function createStepMarks({ stage, board, breadboard, placement, labels, getValues }) {
  let ghost = null
  let ghostKey = null

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

  function setGhost(table) {
    const key = table ? JSON.stringify(table) : null
    if (key === ghostKey) return
    ghostKey = key
    if (ghost) disposeGroup(stage.scene, ghost)
    ghost = table ? buildGhost({ table, board, breadboard, values: getValues(), tint: ACCENT }) : null
    if (ghost) {
      ghost.name = 'hint-ghost'
      stage.scene.add(ghost)
    }
  }

  function set({ places = [], pins = [], ghost: table = null, labels: list = [] } = {}) {
    placement.setMarks(places)
    board.highlightPins(pins)
    setGhost(table)
    const pinned = []
    for (const item of list) {
      const points = item.at.map(pointOf).filter(Boolean)
      if (points.length === 0) continue
      const position = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(points.length)
      position.y += LABEL_LIFT
      pinned.push({ id: item.id, position, text: item.text, tone: item.tone })
    }
    labels.set(pinned)
    stage.invalidate()
  }

  function clear() {
    set({})
  }

  return { set, clear }
}
