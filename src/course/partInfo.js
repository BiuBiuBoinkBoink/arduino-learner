// Part cards: what each part type is, its legs and key numbers. Plain data
// for src/ui/partCard.js and the part_card explain tool.
//
// PART_INFO[type] = { name, summary, legs: [{ terminals, label, text }],
//   facts: [{ label, value }] }; legs are in leg order, and one entry may
// cover terminals that are the same (both ends of a resistor).
export const PART_INFO = {
  led: {
    name: 'LED',
    summary: 'A light that lets current through one way only.',
    legs: [
      { terminals: ['anode'], label: 'Long leg (anode)', text: 'Current goes in here. Connect it towards the pin, through a resistor.' },
      { terminals: ['cathode'], label: 'Short leg (cathode)', text: 'Current comes out here, on the side with the flat edge. Connect it towards GND.' }
    ],
    facts: [
      { label: 'Forward voltage', value: 'about 2 V (red)' },
      { label: 'Max current', value: '20 mA' },
      { label: 'Needs', value: 'a series resistor, 220 ohm on 5 V' }
    ]
  },
  resistor: {
    name: 'Resistor',
    summary: 'Limits current. It works either way round.',
    legs: [{ terminals: ['a', 'b'], label: 'Either end', text: 'Both ends are the same.' }],
    facts: [
      { label: '220 ohm', value: 'red red brown' },
      { label: '1 kohm', value: 'brown black red' },
      { label: '10 kohm', value: 'brown black orange' }
    ]
  },
  button: {
    name: 'Push button',
    summary: 'A switch that joins its two sides while you press it.',
    legs: [
      { terminals: ['a'], label: 'Left pair', text: 'These two legs are always joined to each other.' },
      { terminals: ['b'], label: 'Right pair', text: 'These two legs are always joined to each other.' }
    ],
    facts: [
      { label: 'Sits', value: 'across the centre gap' },
      { label: 'Pressed', value: 'left pair joined to right pair' }
    ]
  },
  potentiometer: {
    name: 'Potentiometer',
    summary: 'A resistor with a sliding contact you move with a knob.',
    legs: [
      { terminals: ['end1'], label: 'Outer leg', text: 'To 5V or GND.' },
      { terminals: ['wiper'], label: 'Middle leg (wiper)', text: 'Gives a voltage between the two outer legs.' },
      { terminals: ['end2'], label: 'Outer leg', text: 'To GND or 5V.' }
    ],
    facts: [
      { label: 'Turns', value: '270 deg' },
      { label: 'Reads', value: '0 to 1023 on an analog pin' }
    ]
  },
  ldr: {
    name: 'Photoresistor',
    summary: 'A resistor that changes with light: less light, more resistance.',
    legs: [{ terminals: ['a', 'b'], label: 'Either end', text: 'Both ends are the same.' }],
    facts: [
      { label: 'Bright', value: 'about 1 kohm' },
      { label: 'Dark', value: 'about 1 Mohm' }
    ]
  },
  tmp36: {
    name: 'TMP36',
    summary: 'A temperature sensor whose output rises 10 mV per deg C.',
    legs: [
      { terminals: ['vs'], label: '+Vs (left)', text: 'To 5V or 3.3V.' },
      { terminals: ['vout'], label: 'Vout (middle)', text: 'To an analog pin.' },
      { terminals: ['gnd'], label: 'GND (right)', text: 'To GND.' }
    ],
    facts: [
      { label: 'At 0 deg C', value: '0.5 V' },
      { label: 'Per degree', value: '10 mV' },
      { label: 'Legs', value: 'left to right with the flat face towards you' }
    ]
  },
  buzzer: {
    name: 'Passive buzzer',
    summary: 'Clicks each time its voltage changes, so a fast square wave makes a tone.',
    legs: [{ terminals: ['a', 'b'], label: 'Either leg', text: 'Works both ways round; the + leg usually goes to the pin.' }],
    facts: [
      { label: 'Drive with', value: 'tone(pin, Hz)' },
      { label: 'Range', value: 'about 100 to 5000 Hz' }
    ]
  },
  servo: {
    name: 'Servo',
    summary: 'A motor that turns its arm to an angle from 0 to 180 deg and holds it.',
    legs: [
      { terminals: ['gnd'], label: 'Brown wire', text: 'GND.' },
      { terminals: ['vcc'], label: 'Red wire', text: '5V.' },
      { terminals: ['signal'], label: 'Orange wire', text: 'A pin, for the angle pulses.' }
    ],
    facts: [
      { label: 'Library', value: 'Servo.h' },
      { label: 'Speed', value: 'about 0.1 s per 60 deg' }
    ]
  },
  rgbLed: {
    name: 'RGB LED',
    summary: 'Three LEDs in one case, red, green and blue, sharing one GND leg.',
    legs: [
      { terminals: ['red'], label: 'Red leg', text: 'To a PWM pin through a resistor.' },
      { terminals: ['cathode'], label: 'Longest leg (cathode)', text: 'To GND.' },
      { terminals: ['green'], label: 'Green leg', text: 'To a PWM pin through a resistor.' },
      { terminals: ['blue'], label: 'Blue leg', text: 'To a PWM pin through a resistor.' }
    ],
    facts: [
      { label: 'Type', value: 'common cathode' },
      { label: 'Mix', value: 'set each colour with analogWrite' }
    ]
  }
}
