// Render on demand: invalidate() marks the view dirty and asks for one frame.
// Pure module so it can be unit tested without a browser.
export function createRenderLoop({ render, requestFrame }) {
  let dirty = false
  let pending = false

  function frame() {
    pending = false
    dirty = false
    render()
  }

  function invalidate() {
    dirty = true
    if (pending) return
    pending = true
    requestFrame(frame)
  }

  return { invalidate }
}
