// Pure camera math for the view buttons: easing, plain vector lerp and the
// camera position that frames a box from above or at 45 deg. No three.js.
const MARGIN = 1.1
const ELEVATION = Math.PI / 4

export function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

export function lerpVec(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

// Distance at which half sizes fit the horizontal and vertical field of view.
function fitDistance(halfWidth, halfHeight, { fov, aspect }) {
  const vfov = (fov * Math.PI) / 180
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
  return Math.max(halfWidth / Math.tan(hfov / 2), halfHeight / Math.tan(vfov / 2)) * MARGIN
}

// kind 'top' looks straight down at the box centre; '3d' looks from the +z
// side at 45 deg elevation. fov is the vertical field of view in degrees.
export function viewFor(kind, box, camera) {
  const target = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2
  }
  const halfWidth = (box.max.x - box.min.x) / 2
  const halfDepth = (box.max.z - box.min.z) / 2
  const d = fitDistance(halfWidth, halfDepth, camera)
  if (kind === 'top') {
    return { position: { x: target.x, y: target.y + d, z: target.z + 0.001 }, target }
  }
  return {
    position: {
      x: target.x,
      y: target.y + d * Math.sin(ELEVATION),
      z: target.z + d * Math.cos(ELEVATION)
    },
    target
  }
}
