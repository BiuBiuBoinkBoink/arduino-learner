// Circuit view: owns the circuit group in the scene. show(table, { fresh })
// removes and disposes the old group, builds the new one, lights its LEDs and
// applies showWhen; it returns the new items. fresh is true on a lesson change:
// only then is the servo centred at 90 deg; a rebuild after an edit keeps the
// servo angle and the buzzer ring. LEDs follow the pin levels, the servo horn
// its angle and the buzzer ring its tone, through store subscriptions.
import { buildCircuit } from '../circuits/buildCircuit.js'
import { ledBrightness } from '../sim/ohm.js'

export function createCircuitView({ stage, board, breadboard, pins, servos, tones, getValues }) {
  let circuit = null
  let current = null
  let leds = []
  let rgbLeds = []
  let buzzer = null
  let servo = null

  function dispose() {
    if (!circuit) return
    stage.scene.remove(circuit.group)
    circuit.group.traverse((object) => {
      if (!object.isMesh) return
      object.geometry.dispose()
      object.material.dispose()
    })
    circuit = null
    current = null
    leds = []
    rgbLeds = []
    buzzer = null
    servo = null
  }

  // Parts with showWhen are drawn only while that code panel param has that value.
  function showParts(values) {
    if (!circuit) return
    for (const part of current.parts) {
      if (!part.showWhen) continue
      circuit.items[part.id].group.visible = values[part.showWhen.param] === part.showWhen.value
    }
    stage.invalidate()
  }

  // Light circuit LEDs from the level of the Uno pin that drives each (0 to 1, PWM
  // duty), scaled by the series resistor when the part names an ohmsParam.
  // With a pin name, only the LEDs on that pin.
  function relight(name) {
    const values = getValues()
    let changed = false
    for (const { part, led } of leds) {
      if (name !== undefined && part.pin !== name) continue
      const scale = part.ohmsParam ? ledBrightness(values[part.ohmsParam]) : 1
      led.setBrightness(pins.get(part.pin) * scale)
      changed = true
    }
    // RGB LEDs mix their three channel pins.
    for (const { part, led } of rgbLeds) {
      const { red, green, blue } = part.pins
      if (name !== undefined && ![red, green, blue].includes(name)) continue
      led.setColor(pins.get(red), pins.get(green), pins.get(blue))
      changed = true
    }
    if (changed) stage.invalidate()
  }

  function show(table, { fresh = true } = {}) {
    dispose()
    if (table) {
      circuit = buildCircuit(table, { board, breadboard, values: getValues() })
      current = table
      const withItem = (type) => table.parts
        .filter((part) => part.type === type)
        .map((part) => ({ part, led: circuit.items[part.id] }))
      leds = withItem('led')
      rgbLeds = withItem('rgbLed')
      const buzzerPart = table.parts.find((part) => part.type === 'buzzer')
      buzzer = buzzerPart ? { pin: buzzerPart.pin, item: circuit.items[buzzerPart.id] } : null
      const servoPart = table.parts.find((part) => part.type === 'servo')
      servo = servoPart ? { pin: servoPart.pin, item: circuit.items[servoPart.id] } : null
      if (servo) {
        if (fresh) servos.set(servo.pin, 90)
        servo.item.setAngle(fresh ? 90 : servos.get(servo.pin))
      }
      if (buzzer) buzzer.item.setPlaying(tones.get(buzzer.pin) > 0)
      relight()
      stage.scene.add(circuit.group)
      showParts(getValues())
    }
    stage.invalidate()
    return circuit ? circuit.items : null
  }

  pins.subscribe((name) => relight(name))

  // Turn the servo horn to the arm angle on its pin.
  servos.subscribe((name, degrees) => {
    if (!servo || servo.pin !== name) return
    servo.item.setAngle(degrees)
    stage.invalidate()
  })

  // Show the buzzer sound ring while its pin has a tone.
  tones.subscribe((name, hz) => {
    if (!buzzer || buzzer.pin !== name) return
    buzzer.item.setPlaying(hz > 0)
    stage.invalidate()
  })

  return {
    show,
    items: () => (circuit ? circuit.items : null),
    table: () => current,
    relight,
    showParts
  }
}
