// Scene setup: the stage with the Uno on the left and the breadboard on the
// right, 1 cm apart, the pair centred on x = 0. frameBox() is the box around
// both boards as plain min and max objects, for the camera view buttons.
import * as THREE from 'three'
import { createStage } from '../scene/stage.js'
import { createUnoBoard } from '../parts/unoBoard.js'
import { createBreadboard } from '../parts/breadboard.js'

const BOARD_GAP = 1

export function createScene(stageEl) {
  const stage = createStage(stageEl)
  const board = createUnoBoard()
  const breadboard = createBreadboard()

  const boardBox = new THREE.Box3().setFromObject(board.group)
  const breadboardBox = new THREE.Box3().setFromObject(breadboard.group)
  const boardWidth = boardBox.max.x - boardBox.min.x
  const totalWidth = boardWidth + BOARD_GAP + breadboardBox.max.x - breadboardBox.min.x
  board.group.position.x = -totalWidth / 2 - boardBox.min.x
  breadboard.group.position.x = -totalWidth / 2 + boardWidth + BOARD_GAP - breadboardBox.min.x
  stage.scene.add(board.group, breadboard.group)
  stage.invalidate()

  function frameBox() {
    const box = new THREE.Box3().setFromObject(board.group).union(new THREE.Box3().setFromObject(breadboard.group))
    return {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z }
    }
  }

  return { stage, board, breadboard, frameBox }
}
