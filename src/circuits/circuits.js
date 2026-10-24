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
  '1.3': ledCircuit('D9'),
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
  '1.7': ledCircuit('D9')
}
