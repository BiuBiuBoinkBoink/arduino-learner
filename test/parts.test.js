import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createButton } from '../src/parts/button.js'
import { createLed } from '../src/parts/led.js'
import { createPotentiometer } from '../src/parts/potentiometer.js'
import { createRgbLed } from '../src/parts/rgbLed.js'
import { createLdr } from '../src/parts/ldr.js'
import { createTmp36 } from '../src/parts/tmp36.js'
import { createBuzzer } from '../src/parts/buzzer.js'
import { createResistor, resistorBands } from '../src/parts/resistor.js'
import { WIRE_COLORS, wireCurve, createWire } from '../src/parts/wire.js'

function meshesOf(object) {
  const meshes = []
  object.traverse((child) => {
    if (child.isMesh) meshes.push(child)
  })
  return meshes
}

describe('resistorBands', () => {
  it('reads two digits, a multiplier and gold tolerance', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'brown', 'gold'])
    expect(resistorBands(1000)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(resistorBands(10000)).toEqual(['brown', 'black', 'orange', 'gold'])
    expect(resistorBands(10)).toEqual(['brown', 'black', 'black', 'gold'])
  })

  it('throws for values it cannot write', () => {
    expect(() => resistorBands(5)).toThrow()
    expect(() => resistorBands(225)).toThrow()
    expect(() => resistorBands(1e11)).toThrow()
  })
})

describe('wireCurve', () => {
  const from = new THREE.Vector3(-2, 1.012, -2.5)
  const to = new THREE.Vector3(3, 0.852, -1.4)

  it('starts at from and ends at to', () => {
    const curve = wireCurve(from, to)
    expect(curve.getPoint(0).distanceTo(from)).toBeLessThan(1e-9)
    expect(curve.getPoint(1).distanceTo(to)).toBeLessThan(1e-9)
  })

  it('leaves and enters vertically', () => {
    const curve = wireCurve(from, to)
    expect(curve.v1.x).toBe(from.x)
    expect(curve.v1.z).toBe(from.z)
    expect(curve.v1.y).toBeGreaterThan(from.y)
    expect(curve.v2.x).toBe(to.x)
    expect(curve.v2.z).toBe(to.z)
    expect(curve.v2.y).toBeGreaterThan(to.y)
  })

  it('arches at least 1 cm above the higher end, more for longer wires', () => {
    const peak = (a, b) => Math.max(...wireCurve(a, b).getPoints(100).map((p) => p.y))
    expect(peak(from, to)).toBeGreaterThanOrEqual(Math.max(from.y, to.y) + 1)
    const near = new THREE.Vector3(from.x + 0.3, to.y, from.z)
    expect(peak(from, near)).toBeGreaterThanOrEqual(from.y + 1)
    const far = new THREE.Vector3(from.x + 10, to.y, from.z)
    expect(peak(from, far)).toBeGreaterThan(peak(from, to))
  })
})

describe('createWire', () => {
  it('builds a shadow casting tube along the curve', () => {
    const from = new THREE.Vector3(0, 1, 0)
    const to = new THREE.Vector3(2, 0.85, 1)
    const { group, curve } = createWire({ color: 'red', from, to })
    const meshes = meshesOf(group)
    expect(meshes).toHaveLength(1)
    expect(meshes[0].geometry).toBeInstanceOf(THREE.TubeGeometry)
    expect(meshes[0].castShadow).toBe(true)
    expect(curve.getPoint(1).distanceTo(to)).toBeLessThan(1e-9)
  })

  it('has the named colours and throws for unknown ones', () => {
    for (const name of ['red', 'black', 'yellow', 'green', 'blue']) expect(WIRE_COLORS).toHaveProperty(name)
    const from = new THREE.Vector3()
    const to = new THREE.Vector3(1, 0, 0)
    expect(() => createWire({ color: 'pink', from, to })).toThrow('pink')
    expect(() => createWire({ color: 'toString', from, to })).toThrow('toString')
  })
})

describe('createLed', () => {
  const anode = new THREE.Vector3(1, 0.852, 0.3)
  const cathode = new THREE.Vector3(1.254, 0.852, 0.3)

  it('reaches down to the leg points and stands above them', () => {
    const { group } = createLed({ color: 'red', anode, cathode })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - anode.y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(anode.y + 0.8)
    expect(box.min.x).toBeLessThan(anode.x)
    expect(box.max.x).toBeGreaterThan(cathode.x)
  })

  it('casts shadows from every mesh', () => {
    const { group } = createLed({ color: 'blue', anode, cathode })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
  })

  it('starts unlit, setLit(true) glows the lens and setLit(false) turns it off', () => {
    const { group, setLit } = createLed({ color: 'red', anode, cathode })
    expect(typeof setLit).toBe('function')
    const lensMeshes = meshesOf(group).filter((mesh) => mesh.material.transparent)
    expect(lensMeshes).toHaveLength(3)
    const black = new THREE.Color(0x000000)
    for (const mesh of lensMeshes) expect(mesh.material.emissive.equals(black)).toBe(true)
    setLit(true)
    for (const mesh of lensMeshes) {
      expect(mesh.material.emissive.equals(black)).toBe(false)
      expect(mesh.material.emissiveIntensity).toBeGreaterThan(0)
    }
    setLit(false)
    for (const mesh of lensMeshes) expect(mesh.material.emissive.equals(black)).toBe(true)
  })

  it('setBrightness(0.5) gives half the full glow and 0 turns it off', () => {
    const { group, setLit, setBrightness } = createLed({ color: 'green', anode, cathode })
    const lens = meshesOf(group).find((mesh) => mesh.material.transparent).material
    const black = new THREE.Color(0x000000)
    setLit(true)
    const full = lens.emissiveIntensity
    const fullColor = lens.emissive.clone()
    setBrightness(0.5)
    expect(lens.emissiveIntensity).toBeCloseTo(full / 2, 6)
    expect(lens.emissive.equals(fullColor)).toBe(true)
    setBrightness(1)
    expect(lens.emissiveIntensity).toBeCloseTo(full, 6)
    setBrightness(0)
    expect(lens.emissive.equals(black)).toBe(true)
    setLit(true)
    expect(lens.emissiveIntensity).toBeCloseTo(full, 6)
  })

  it('supports four colours and throws for others', () => {
    for (const color of ['red', 'green', 'yellow', 'blue']) {
      expect(() => createLed({ color, anode, cathode })).not.toThrow()
    }
    expect(() => createLed({ color: 'white', anode, cathode })).toThrow('white')
  })
})

describe('createResistor', () => {
  const from = new THREE.Vector3(-0.5, 0.852, 0)
  const to = new THREE.Vector3(0.516, 0.852, 0)

  it('reaches down to the leg points and lies above them', () => {
    const { group } = createResistor({ ohms: 220, from, to })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - from.y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(from.y + 0.2)
    expect(box.min.x).toBeLessThanOrEqual(from.x)
    expect(box.max.x).toBeGreaterThanOrEqual(to.x)
  })

  it('carries the four bands in order from the from end', () => {
    const { group } = createResistor({ ohms: 220, from, to })
    const bands = []
    group.traverse((child) => {
      if (child.name.startsWith('band-')) bands.push(child)
    })
    group.updateMatrixWorld(true)
    const x = (band) => band.getWorldPosition(new THREE.Vector3()).x
    bands.sort((a, b) => x(a) - x(b))
    expect(bands.map((band) => band.name)).toEqual(['band-red', 'band-red', 'band-brown', 'band-gold'])
  })

  it('casts shadows from the body and legs', () => {
    const { group } = createResistor({ ohms: 220, from, to })
    for (const mesh of meshesOf(group)) {
      if (!mesh.name.startsWith('band-')) expect(mesh.castShadow).toBe(true)
    }
  })
})

describe('createButton', () => {
  const legs = [
    new THREE.Vector3(1, 0.852, -0.381),
    new THREE.Vector3(1.508, 0.852, -0.381),
    new THREE.Vector3(1, 0.852, 0.381),
    new THREE.Vector3(1.508, 0.852, 0.381)
  ]

  // Highest point of the cap, the top of the whole part.
  function topY(group) {
    group.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(group).max.y
  }

  it('reaches down to its four leg points and stands above them', () => {
    const { group } = createButton({ legs })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - legs[0].y)).toBeLessThan(0.03)
    expect(box.max.y).toBeGreaterThan(legs[0].y + 0.4)
    expect(box.min.x).toBeLessThan(legs[0].x + 0.03)
    expect(box.max.x).toBeGreaterThan(legs[1].x - 0.03)
    expect(box.min.z).toBeLessThan(legs[0].z + 0.03)
    expect(box.max.z).toBeGreaterThan(legs[2].z - 0.03)
  })

  it('setPressed(true) lowers the cap and setPressed(false) restores it', () => {
    const { group, setPressed } = createButton({ legs })
    const released = topY(group)
    setPressed(true)
    const pressed = topY(group)
    expect(released - pressed).toBeGreaterThan(0.03)
    expect(released - pressed).toBeLessThan(0.08)
    setPressed(false)
    expect(topY(group)).toBeCloseTo(released, 6)
  })

  it('casts shadows from every mesh and is tagged pressable', () => {
    const { group } = createButton({ legs })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
    expect(group.userData.pressable).toBe(true)
  })
})

describe('createPotentiometer', () => {
  const legs = [
    new THREE.Vector3(1, 0.852, 0.3),
    new THREE.Vector3(1.254, 0.852, 0.3),
    new THREE.Vector3(1.508, 0.852, 0.3)
  ]

  // Direction the knob pointer faces seen from above, in degrees clockwise
  // from straight ahead (-z); clockwise from above takes -z towards +x.
  function pointerAngle(group) {
    group.updateMatrixWorld(true)
    const centre = group.getObjectByName('knob').getWorldPosition(new THREE.Vector3())
    const tip = group.getObjectByName('pointer').getWorldPosition(new THREE.Vector3()).sub(centre)
    return THREE.MathUtils.radToDeg(Math.atan2(tip.x, -tip.z))
  }

  it('reaches down to its three leg points and stands above them', () => {
    const { group } = createPotentiometer({ legs })
    group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - legs[0].y)).toBeLessThan(0.03)
    expect(box.max.y).toBeGreaterThan(legs[0].y + 0.6)
    const size = box.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(0.8)
    expect(size.x).toBeLessThan(1.3)
    // Every leg point lies on the bottom face of some mesh.
    const boxes = meshesOf(group).map((mesh) => new THREE.Box3().setFromObject(mesh))
    for (const leg of legs) {
      const reached = boxes.some((b) => Math.abs(b.min.y - leg.y) < 0.03 &&
        Math.abs((b.min.x + b.max.x) / 2 - leg.x) < 0.03 &&
        Math.abs((b.min.z + b.max.z) / 2 - leg.z) < 0.03)
      expect(reached).toBe(true)
    }
  })

  it('starts straight ahead and turns 135 degrees each way, clockwise as the value rises', () => {
    const { group, setValue } = createPotentiometer({ legs })
    expect(pointerAngle(group)).toBeCloseTo(0, 4)
    setValue(0)
    expect(pointerAngle(group)).toBeCloseTo(-135, 4)
    setValue(0.5)
    expect(pointerAngle(group)).toBeCloseTo(0, 4)
    setValue(1)
    expect(pointerAngle(group)).toBeCloseTo(135, 4)
  })

  it('clamps values to 0 to 1', () => {
    const { group, setValue } = createPotentiometer({ legs })
    setValue(5)
    expect(pointerAngle(group)).toBeCloseTo(135, 4)
    setValue(-2)
    expect(pointerAngle(group)).toBeCloseTo(-135, 4)
  })

  it('casts shadows from every mesh and is tagged turnable', () => {
    const { group } = createPotentiometer({ legs })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
    expect(group.userData.turnable).toBe(true)
  })
})

describe('createRgbLed', () => {
  const legs = [0, 1, 2, 3].map((i) => new THREE.Vector3(1 + i * 0.254, 0.852, 0.3))

  function lens(group) {
    return meshesOf(group).find((mesh) => mesh.material.transparent).material
  }

  it('reaches down to its four leg points and stands above them', () => {
    const { group } = createRgbLed({ legs })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - legs[0].y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(legs[0].y + 0.8)
    expect(box.min.x).toBeLessThan(legs[0].x)
    expect(box.max.x).toBeGreaterThan(legs[3].x)
  })

  it('starts dark and glows in the mix of its channels', () => {
    const { group, setColor } = createRgbLed({ legs })
    const material = lens(group)
    expect(material.emissive.getHex()).toBe(0x000000)
    // Channel levels read as sRGB, so 255, 128, 0 is orange.
    setColor(1, 128 / 255, 0)
    expect(material.emissive.getHexString()).toBe('ff8000')
    expect(material.color.getHexString()).toBe('ff8000')
    const full = material.emissiveIntensity
    setColor(0.5, 64 / 255, 0)
    expect(material.emissive.getHexString()).toBe('ff8000')
    expect(material.emissiveIntensity).toBeCloseTo(full / 2, 6)
    setColor(0, 0, 0)
    expect(material.emissive.getHex()).toBe(0x000000)
  })

  it('casts shadows from every mesh and needs four legs', () => {
    const { group } = createRgbLed({ legs })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
    expect(() => createRgbLed({ legs: legs.slice(0, 3) })).toThrow()
  })
})

describe('createLdr', () => {
  const from = new THREE.Vector3(1, 0.852, 0.3)
  const to = new THREE.Vector3(1.762, 0.852, 0.3)

  it('reaches down to its two leg points and stands above them', () => {
    const { group } = createLdr({ from, to })
    group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - from.y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(from.y + 0.8)
    expect(box.min.x).toBeLessThan(from.x + 0.03)
    expect(box.max.x).toBeGreaterThan(to.x - 0.03)
  })

  it('casts shadows from every mesh', () => {
    const { group } = createLdr({ from, to })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
  })
})

describe('createTmp36', () => {
  const legs = [0, 1, 2].map((i) => new THREE.Vector3(1 + i * 0.254, 0.852, 0.3))

  it('reaches down to its three leg points and stands above them', () => {
    const { group } = createTmp36({ legs })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - legs[0].y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(legs[0].y + 0.8)
    expect(box.min.x).toBeLessThan(legs[0].x + 0.03)
    expect(box.max.x).toBeGreaterThan(legs[2].x - 0.03)
    // Flat face towards the viewer: the body bulges to -z only.
    expect(box.max.z).toBeLessThan(legs[1].z + 0.05)
  })

  it('casts shadows from every mesh and needs three legs', () => {
    const { group } = createTmp36({ legs })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
    expect(() => createTmp36({ legs: legs.slice(0, 2) })).toThrow()
  })
})

describe('createBuzzer', () => {
  const legs = [new THREE.Vector3(1, 0.852, 0.3), new THREE.Vector3(1.762, 0.852, 0.3)]

  it('reaches down to its two leg points and stands above them', () => {
    const { group } = createBuzzer({ legs })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - legs[0].y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(legs[0].y + 0.4)
    expect(box.min.x).toBeLessThan(legs[0].x)
    expect(box.max.x).toBeGreaterThan(legs[1].x)
  })

  it('shows the sound ring only while playing', () => {
    const { group, setPlaying } = createBuzzer({ legs })
    const ring = group.getObjectByName('sound-ring')
    expect(ring.visible).toBe(false)
    setPlaying(true)
    expect(ring.visible).toBe(true)
    setPlaying(false)
    expect(ring.visible).toBe(false)
  })

  it('casts shadows from every mesh and needs two legs', () => {
    const { group } = createBuzzer({ legs })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
    expect(() => createBuzzer({ legs: legs.slice(0, 1) })).toThrow()
  })
})
