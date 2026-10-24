// Room controls: "Room light" and "Room temperature" sliders below the Run row,
// for lessons whose circuit has a sensor that reads the room. Each slider is
// shown only while setSensors names it, and follows the room both ways.
import { MIN_TEMP_C, MAX_TEMP_C } from '../sim/room.js'

function buildSlider({ id, label, min, max, unit }) {
  const row = document.createElement('div')
  row.className = 'code-param room-slider'
  const labelEl = document.createElement('label')
  labelEl.htmlFor = id
  labelEl.textContent = label
  const output = document.createElement('output')
  output.className = 'code-param-value'
  output.htmlFor = id
  const input = document.createElement('input')
  input.type = 'range'
  input.id = id
  input.min = String(min)
  input.max = String(max)
  input.step = '1'
  const top = document.createElement('div')
  top.className = 'code-param-top'
  top.append(labelEl, output)
  row.append(top, input)
  row.hidden = true

  function show(value) {
    input.value = String(value)
    const text = value + ' ' + unit
    output.textContent = text
    input.setAttribute('aria-valuetext', text)
  }

  return { row, input, show }
}

export function createRoomControls({ container, room }) {
  const light = buildSlider({ id: 'room-light', label: 'Room light', min: 0, max: 100, unit: '%' })
  const temp = buildSlider({ id: 'room-temp', label: 'Room temperature', min: MIN_TEMP_C, max: MAX_TEMP_C, unit: 'deg C' })
  container.append(light.row, temp.row)

  light.input.addEventListener('input', () => room.setLight(Number(light.input.value) / 100))
  temp.input.addEventListener('input', () => room.setTempC(Number(temp.input.value)))

  const showLight = () => light.show(Math.round(room.getLight() * 100))
  const showTemp = () => temp.show(Math.round(room.getTempC()))
  room.subscribe((name) => (name === 'light' ? showLight() : showTemp()))

  // sensors: { light, temp } booleans for the current circuit.
  function setSensors({ light: hasLight = false, temp: hasTemp = false } = {}) {
    light.row.hidden = !hasLight
    temp.row.hidden = !hasTemp
    showLight()
    showTemp()
  }

  return { setSensors }
}
