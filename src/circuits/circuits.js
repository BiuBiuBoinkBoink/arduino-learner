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

export const circuits = {
  '1.2': ledCircuit('D13'),
  '1.3': ledCircuit('D9'),
  '1.7': ledCircuit('D9')
}
