import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRenderLoop } from './renderLoop.js'
import { easeInOut, lerpVec, viewFor } from './cameraMath.js'

const BACKGROUND = 0xf4f1ea
const VIEW_MS = 450
const GROUND_SIZE = 120
const SHADOW_SIZE = 40

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  // The soft shadow map type is removed in three 0.186; soften with shadow.radius.
  renderer.shadowMap.type = THREE.PCFShadowMap
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BACKGROUND)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  camera.position.set(0, 20, 19)
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = false
  controls.minDistance = 4
  controls.maxDistance = 40
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.update()

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8c2b4, 1.2)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(6, 12, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const half = SHADOW_SIZE / 2
  sun.shadow.camera.left = -half
  sun.shadow.camera.right = half
  sun.shadow.camera.top = half
  sun.shadow.camera.bottom = -half
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 50
  sun.shadow.radius = 6
  sun.shadow.bias = -0.0005
  scene.add(sun)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xe6e1d6 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const loop = createRenderLoop({
    render: () => renderer.render(scene, camera),
    requestFrame: (cb) => requestAnimationFrame(cb)
  })
  const invalidate = loop.invalidate

  function resize() {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    invalidate()
  }

  new ResizeObserver(resize).observe(container)
  controls.addEventListener('change', invalidate)

  resize()
  invalidate()

  // Room light from 0 (dark) to 1 (bright) dims the scene lights; 0.8 is the
  // normal look, so lights are scaled relative to that.
  const HEMI = hemi.intensity
  const SUN = sun.intensity
  function setDaylight(level) {
    const scale = (0.3 + 0.7 * Math.min(1, Math.max(0, level))) / (0.3 + 0.7 * 0.8)
    hemi.intensity = HEMI * scale
    sun.intensity = SUN * scale
    invalidate()
  }

  // Camera views: tween position and target to a framed view. A new call
  // cancels a running one; reduced motion or animate false jumps. Orbiting by
  // hand after a view makes it 'custom'.
  // The first load camera is not a framed view, so it starts as custom.
  let view = 'custom'
  let tween = null
  controls.addEventListener('start', () => {
    if (!tween) view = 'custom'
  })

  function placeCamera(position, target) {
    camera.position.set(position.x, position.y, position.z)
    controls.target.set(target.x, target.y, target.z)
    controls.update()
    invalidate()
  }

  function setView(kind, box, { animate = true } = {}) {
    if (tween) {
      cancelAnimationFrame(tween.frame)
      tween.resolve()
      tween = null
    }
    view = kind
    const end = viewFor(kind, box, { fov: camera.fov, aspect: camera.aspect })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate || reduced) {
      placeCamera(end.position, end.target)
      return Promise.resolve()
    }
    const from = { position: camera.position.clone(), target: controls.target.clone() }
    const startAt = performance.now()
    return new Promise((resolve) => {
      const current = { resolve, frame: 0 }
      tween = current
      function step(now) {
        const t = Math.min(1, (now - startAt) / VIEW_MS)
        const k = easeInOut(t)
        placeCamera(lerpVec(from.position, end.position, k), lerpVec(from.target, end.target, k))
        if (t < 1) {
          current.frame = requestAnimationFrame(step)
          return
        }
        tween = null
        resolve()
      }
      current.frame = requestAnimationFrame(step)
    })
  }

  const getView = () => view

  return { scene, camera, renderer, controls, invalidate, setDaylight, setView, getView }
}
