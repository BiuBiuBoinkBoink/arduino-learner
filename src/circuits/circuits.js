// Per lesson circuit tables, keyed by lesson id. Plain data: parts sit in
// breadboard holes ('12e' is column 12, row e), wires run from an Uno pin name
// to a breadboard hole. buildCircuit turns a table into scene parts.

// Pin -> 220 ohm resistor -> red LED anode, LED cathode -> GND.
// The LED's pin field names the Uno pin that drives it, so the sim can light it.
function ledCircuit(pin) {
  return {
    parts: [
      { id: 'r1', type: 'resistor', ohms: 220, from: '5c', to: '9c' },
      { id: 'led1', type: 'led', color: 'red', pin, anode: '9e', cathode: '10e' }
    ],
    wires: [
      { id: 'w1', color: 'yellow', from: pin, to: '5a' },
      { id: 'w2', color: 'black', from: 'GND', to: '10a' }
    ]
  }
}

// The D13 LED circuit of the button lessons, moved to columns 20 to 25.
const buttonLed = {
  parts: [
    { id: 'r1', type: 'resistor', ohms: 220, from: '20c', to: '24c' },
    { id: 'led1', type: 'led', color: 'red', pin: 'D13', anode: '24e', cathode: '25e' }
  ],
  wires: [
    { id: 'w1', color: 'yellow', from: 'D13', to: '20a' },
    { id: 'w2', color: 'black', from: 'GND', to: '25a' }
  ]
}

export const circuits = {
  '1.2': ledCircuit('D13'),
  // The resistor choice swaps between three resistors in the same holes; the LED
  // dims with the series resistor. The meter can probe the LED or the resistor.
  '1.3': {
    parts: [
      { id: 'r220', type: 'resistor', ohms: 220, from: '5c', to: '9c', showWhen: { param: 'ohms', value: 220 } },
      { id: 'r1k', type: 'resistor', ohms: 1000, from: '5c', to: '9c', showWhen: { param: 'ohms', value: 1000 } },
      { id: 'r10k', type: 'resistor', ohms: 10000, from: '5c', to: '9c', showWhen: { param: 'ohms', value: 10000 } },
      { id: 'led1', type: 'led', color: 'red', pin: 'D9', ohmsParam: 'ohms', anode: '9e', cathode: '10e' }
    ],
    wires: ledCircuit('D9').wires,
    meter: [
      { id: 'led', label: 'LED', parts: ['led1'] },
      { id: 'resistor', label: 'Resistor', parts: ['r220', 'r1k', 'r10k'] }
    ]
  },
  // D2 -> button column 12; pressing joins it to column 14 and GND.
  '1.4': {
    parts: [{ id: 'btn1', type: 'button', at: '12e' }, ...buttonLed.parts],
    wires: [
      { id: 'w3', color: 'blue', from: 'D2', to: '12a' },
      { id: 'w4', color: 'black', from: 'GND.2', to: '14j' },
      ...buttonLed.wires
    ]
  },
  // D2 -> button column 12 with a 10 kohm pull down to GND; pressing joins it to 5V.
  // The pull down is drawn only while the pull param is down.
  '1.5': {
    parts: [
      { id: 'btn1', type: 'button', at: '12e' },
      { id: 'r2', type: 'resistor', ohms: 10000, from: '12c', to: '8c', showWhen: { param: 'pull', value: 'down' } },
      ...buttonLed.parts
    ],
    wires: [
      { id: 'w3', color: 'blue', from: 'D2', to: '12a' },
      { id: 'w4', color: 'black', from: 'GND.2', to: '8a' },
      { id: 'w5', color: 'red', from: '5V', to: '14j' },
      ...buttonLed.wires
    ]
  },
  // Potentiometer outer legs to 5V and GND.2, the wiper (middle leg) to A0.
  '1.6': {
    parts: [{ id: 'pot1', type: 'potentiometer', at: '12e' }],
    wires: [
      { id: 'w1', color: 'red', from: '5V', to: '12a' },
      { id: 'w2', color: 'green', from: 'A0', to: '13a' },
      { id: 'w3', color: 'black', from: 'GND.2', to: '14a' }
    ]
  },
  '1.7': ledCircuit('D9'),
  // 5V -> photoresistor -> A0 node -> 10 kohm -> GND.2; the D13 LED of the button
  // lessons in columns 20 to 25 is the night light.
  '1.9': {
    parts: [
      { id: 'ldr1', type: 'ldr', from: '4c', to: '7c' },
      { id: 'r2', type: 'resistor', ohms: 10000, from: '7d', to: '11d' },
      ...buttonLed.parts
    ],
    wires: [
      { id: 'w3', color: 'red', from: '5V', to: '4a' },
      { id: 'w4', color: 'green', from: 'A0', to: '7a' },
      { id: 'w5', color: 'black', from: 'GND.2', to: '11a' },
      ...buttonLed.wires
    ]
  },
  // TMP36 flat side towards the viewer: +Vs to 5V, Vout to A0, GND to GND.2.
  '1.10': {
    parts: [{ id: 'tmp1', type: 'tmp36', at: '12e' }],
    wires: [
      { id: 'w1', color: 'red', from: '5V', to: '12a' },
      { id: 'w2', color: 'green', from: 'A0', to: '13a' },
      { id: 'w3', color: 'black', from: 'GND.2', to: '14a' }
    ]
  },
  // Common cathode RGB LED: red 14, cathode 15 to GND, green 16, blue 17. Each
  // colour pin reaches its leg through a 220 ohm resistor; green comes up from
  // the bottom half across the channel.
  '1.8': {
    parts: [
      { id: 'rgb1', type: 'rgbLed', at: '14e', pins: { red: 'D9', green: 'D10', blue: 'D11' } },
      { id: 'r1', type: 'resistor', ohms: 220, from: '8c', to: '14c' },
      { id: 'r2', type: 'resistor', ohms: 220, from: '16d', to: '16g' },
      { id: 'r3', type: 'resistor', ohms: 220, from: '23c', to: '17c' }
    ],
    wires: [
      { id: 'w1', color: 'red', from: 'D9', to: '8a' },
      { id: 'w2', color: 'green', from: 'D10', to: '16j' },
      { id: 'w3', color: 'blue', from: 'D11', to: '23a' },
      { id: 'w4', color: 'black', from: 'GND', to: '15a' }
    ]
  }
}
