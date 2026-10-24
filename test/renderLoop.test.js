import { describe, it, expect } from 'vitest'
import { createRenderLoop } from '../src/scene/renderLoop.js'

function setup() {
  const frames = []
  let renders = 0
  const loop = createRenderLoop({
    render: () => { renders++ },
    requestFrame: (cb) => { frames.push(cb) }
  })
  const runFrames = () => frames.splice(0).forEach((cb) => cb())
  return { loop, frames, runFrames, renders: () => renders }
}

describe('createRenderLoop', () => {
  it('does not render or request a frame without invalidate', () => {
    const t = setup()
    t.runFrames()
    expect(t.frames.length).toBe(0)
    expect(t.renders()).toBe(0)
  })

  it('renders once after one invalidate when the frame runs', () => {
    const t = setup()
    t.loop.invalidate()
    expect(t.renders()).toBe(0)
    expect(t.frames.length).toBe(1)
    t.runFrames()
    expect(t.renders()).toBe(1)
  })

  it('coalesces several invalidates into one frame and one render', () => {
    const t = setup()
    t.loop.invalidate()
    t.loop.invalidate()
    t.loop.invalidate()
    expect(t.frames.length).toBe(1)
    t.runFrames()
    expect(t.renders()).toBe(1)
  })

  it('requests a new frame when invalidated after a frame has run', () => {
    const t = setup()
    t.loop.invalidate()
    t.runFrames()
    t.loop.invalidate()
    expect(t.frames.length).toBe(1)
    t.runFrames()
    expect(t.renders()).toBe(2)
    t.runFrames()
    expect(t.renders()).toBe(2)
  })
})
