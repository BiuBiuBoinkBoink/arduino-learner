import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRenderLoop } from './renderLoop.js'

const BACKGROUND = 0xf4f1ea
const GROUND_SIZE = 40

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
  camera.position.set(0, 8, 12)
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = false
  controls.minDistance = 4
  controls.maxDistance = 30
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.update()

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8c2b4, 1.2)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(6, 12, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const half = GROUND_SIZE / 2
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

  return { scene, camera, renderer, controls, invalidate }
}
