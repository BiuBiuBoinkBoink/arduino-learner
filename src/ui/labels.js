// Labels pinned to 3D points: small boxes in the workbench placed just above
// where a world position shows on screen, with a pointer at the bottom
// centre. Re-placed when the camera moves, on resize and after set; a label
// whose point is behind the camera or outside the workbench is hidden. The
// labels are aria-hidden, because the guide always carries the same text.
//
// createLabels({ stage, container }) -> { set(list), clear() }
// list: [{ id, position: THREE.Vector3, text, tone: 'info' | 'bad' | 'good' }]
const TONES = ['info', 'bad', 'good']

export function createLabels({ stage, container }) {
  const layer = document.createElement('div')
  layer.className = 'pin-labels'
  layer.setAttribute('aria-hidden', 'true')
  container.append(layer)

  let entries = []

  function place() {
    if (entries.length === 0) return
    const canvas = stage.renderer.domElement
    const canvasRect = canvas.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    stage.camera.updateMatrixWorld()
    for (const entry of entries) {
      const point = entry.position.clone().project(stage.camera)
      const x = canvasRect.left - box.left + ((point.x + 1) / 2) * canvasRect.width
      const y = canvasRect.top - box.top + ((1 - point.y) / 2) * canvasRect.height
      const visible = point.z > -1 && point.z < 1 && x >= 0 && x <= box.width && y >= 0 && y <= box.height
      entry.el.hidden = !visible
      if (visible) entry.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, calc(-100% - 8px))`
    }
  }

  function set(list) {
    const items = Array.isArray(list) ? list : []
    entries = items.map((item) => {
      const el = document.createElement('div')
      el.className = 'pin-label is-' + (TONES.includes(item.tone) ? item.tone : 'info')
      el.dataset.labelId = String(item.id)
      el.textContent = item.text
      return { el, position: item.position.clone() }
    })
    layer.replaceChildren(...entries.map((entry) => entry.el))
    place()
  }

  function clear() {
    set([])
  }

  stage.controls.addEventListener('change', place)
  new ResizeObserver(place).observe(container)
  return { set, clear }
}
