# Lesson steps

The step content for every lesson. Copy each block into the lesson object in
`src/course/lessons.js` (phase 2 adds 1.2, phase 6 adds the rest). The blocks
are written as JavaScript so they can be pasted; keep the code style of
`lessons.js` (two space indent, single quotes, double quotes only around text
with an apostrophe).

Before pasting, check every control label the text names against the lesson's
`sketch.params` and the UI. The labels used below were taken from
`lessons.js` at commit 614bfd4.

## Step fields for build and wire steps

- `parts`: the kit ids this step places. Empty for wire steps (wires come
  from the tray's Jumper wires).
- The step **scope** (used by `diagnose` and level 0 hints) is the union of
  `parts` of this step and every build or wire step before it, **plus the
  lesson's `prebuilt` parts**.
- Rule ids refer to reference ids in `src/circuits/circuits.js`. `align`
  renames the learner's interchangeable parts to match before rules run.

## Reference ids per lesson (from circuits.js after phase 4)

| Lesson | Parts | Wires |
| --- | --- | --- |
| 1.2 | `r1` 220 ohm, `led1` red on D13 | `w1` D13, `w2` GND |
| 1.3 | `r1` 220 ohm with `ohmsParam: 'ohms'`, `led1` red on D9 | `w1` D9, `w2` GND |
| 1.4 | `btn1`, `r1` 220 ohm, `led1` red on D13 | `w3` D2, `w4` GND.2, `w1` D13, `w2` GND |
| 1.5 | `btn1`, `r2` 10 kohm (shown when pull is down), `r1`, `led1` | `w3` D2, `w4` GND.2, `w5` 5V, `w1` D13, `w2` GND |
| 1.6 | `pot1` | `w1` 5V, `w2` A0, `w3` GND.2 |
| 1.7 | `r1` 220 ohm, `led1` red on D9 | `w1` D9, `w2` GND |
| 1.8 | `rgb1`, `r1`, `r2`, `r3` (all 220 ohm) | `w1` D9, `w2` D10, `w3` D11, `w4` GND |
| 1.9 | `ldr1`, `r2` 10 kohm, `r1` 220 ohm, `led1` red on D13 | `w3` 5V, `w4` A0, `w5` GND.2, `w1` D13, `w2` GND |
| 1.10 | `tmp1` | `w1` 5V, `w2` A0, `w3` GND.2 |
| 1.11 | `bz1` on D8 | `w1` D8, `w2` GND |
| 1.12 | `sv1` on D9 | `w1` GND.2, `w2` 5V, `w3` D9 |
| P1 | `ldr1`, `r2` 10 kohm, `tmp1`, `r1` 220 ohm, `led1` yellow on D13, `bz1` on D8 | `w1` to `w10` (w10 is a jumper) |

## 1.1 Meet the Uno and breadboard

New title `Meet the Uno and breadboard`, new summary
`Tour the board, then learn how a breadboard joins holes.` No reference
circuit; the kit is in the lesson.

```js
kit: { parts: [{ id: 'r1', type: 'resistor', ohms: 220 }], wires: 2 },
prebuilt: [],
steps: [
  {
    id: 'tour',
    kind: 'explore',
    title: 'Tour the board',
    body: ['Click each part of the Uno to see what it does. The card on the right lists the six parts to find.'],
    check: { type: 'tour', text: 'Open all six parts of the Uno' },
    hint: 'Move the pointer over the board. Each part lights up blue when you can click it.',
    done: 'You know where the pins, the power and the chip are.'
  },
  {
    id: 'strips',
    kind: 'explore',
    title: 'Find the strips',
    body: [
      'A breadboard hides metal strips under its holes. In each column, holes a to e share one strip, and holes f to j share another.',
      'Point at a few holes and watch which other holes light up with them.'
    ],
    check: { type: 'event', items: [{ text: 'Point at holes in 3 different strips', event: 'strip-hover', count: 3 }] },
    hint: 'Move the pointer slowly across the breadboard. Every hole lights up the whole strip it belongs to.',
    done: 'Holes in the same strip are joined, so parts in them are connected.'
  },
  {
    id: 'gap',
    kind: 'learn',
    title: 'The centre gap',
    body: ['The gap down the middle of the breadboard splits every column in two. Chips and buttons sit across it.'],
    check: {
      type: 'quiz',
      question: 'Are holes 12a and 12f joined?',
      options: ['Yes, they are in the same column', 'No, the centre gap splits the column', 'Only when a wire is in them'],
      answer: 1,
      explain: [
        'Not quite. The column is split by the gap: 12a to 12e is one strip, 12f to 12j is another.',
        'Right. The gap splits each column into two strips, so 12a and 12f are not joined.',
        'Not quite. Holes are joined by the strip under them, and 12a and 12f sit on different strips.'
      ]
    },
    done: 'Each column holds two strips, one on each side of the gap.'
  },
  {
    id: 'place-resistor',
    kind: 'build',
    title: 'Place a resistor',
    parts: ['r1'],
    body: [
      'Pick the resistor from the tray. Click a hole for one end, then a hole a few columns away in the same row for the other end.',
      'Its two legs must sit in two different strips, or the current goes round it.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'Resistor is on the breadboard', rule: { placed: 'r1' } },
        { text: 'Legs in two different strips', rule: { apart: ['r1.a', 'r1.b'] } }
      ]
    },
    hint: 'Keep both legs in the same row, for example row c, three or four columns apart.',
    done: 'Each leg has its own strip, so anything joined to the resistor goes through it.'
  },
  {
    id: 'power-wires',
    kind: 'wire',
    title: 'Wire up power',
    parts: [],
    body: [
      'Pick Jumper wires in the tray. Click the 5V pin on the Uno, then a hole. Do the same for a GND pin.',
      'The long rails along the edges are made for power: the red + rail for 5V and the blue - rail for GND.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'A wire from 5V to the breadboard', rule: { wired: '5V' } },
        { text: 'A wire from GND to the breadboard', rule: { wired: 'GND' } },
        { text: '5V and GND are not joined', rule: { noShorts: true } }
      ]
    },
    hint: 'Put the 5V wire in the top red + rail and the GND wire in the top blue - rail.',
    done: 'Power is on the rails, ready for any part that needs it.'
  },
  {
    id: 'practice',
    kind: 'build',
    title: 'Move things around',
    parts: [],
    body: [
      'Click the resistor to pick it up, then put it somewhere else.',
      'Then click it again and press Delete to put it back in the tray.'
    ],
    check: {
      type: 'event',
      items: [
        { text: 'Move a part', event: 'part-moved', count: 1 },
        { text: 'Put a part back in the tray', event: 'part-returned', count: 1 }
      ]
    },
    hint: 'Click the resistor once to lift it, then click two holes to put it down. To remove it, lift it and press Delete.',
    done: 'You can place, move and remove parts. That is all you need for every lesson.'
  }
]
```

## 1.2 Blink

```js
prebuilt: [],
steps: [
  {
    id: 'led-legs',
    kind: 'learn',
    title: 'What an LED needs',
    body: [
      'An LED only lets current through one way: in at the long leg, the anode, and out at the short leg, the cathode.',
      'It also needs a resistor in line with it. Without one, too much current flows and the LED burns out.'
    ],
    check: {
      type: 'quiz',
      question: 'Which leg of the LED goes towards GND?',
      options: ['The long leg, the anode', 'The short leg, the cathode', 'Either leg works'],
      answer: 1,
      explain: [
        'Not quite. Current goes in at the long leg and out at the short leg, so the short leg goes towards GND.',
        'Right. The short leg, on the side with the flat edge, goes towards GND.',
        'Not quite. An LED only works one way round, so it matters which leg goes where.'
      ]
    },
    hint: 'Current goes in at one leg and out at the other. Which one is the way out?',
    done: 'You know which way round an LED goes.'
  },
  {
    id: 'place-led',
    kind: 'build',
    title: 'Place the LED',
    parts: ['led1'],
    body: [
      'Pick the LED from the tray and put it in the breadboard so its two legs sit in two different strips.',
      'The ghost shows where the long leg goes. R turns it.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'LED is on the breadboard', rule: { placed: 'led1' } },
        { text: 'Legs in two different strips', rule: { apart: ['led1.anode', 'led1.cathode'] } }
      ]
    },
    hint: 'The five holes in one column are joined. Give each leg its own column, side by side in the same row.',
    done: 'The legs sit in two strips, so current has to pass through the LED.'
  },
  {
    id: 'add-resistor',
    kind: 'build',
    title: 'Add the resistor',
    parts: ['r1'],
    body: [
      'The resistor keeps the current safe. One end must share a strip with the long leg of the LED.',
      'Place the 220 ohm resistor from a free strip to the strip that holds the long leg.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'Resistor is on the breadboard', rule: { placed: 'r1' } },
        { text: 'One end shares a strip with the long leg', rule: { joined: ['r1.*', 'led1.anode'] } },
        { text: 'The other end has a strip of its own', rule: { matches: ['led1', 'r1'] } }
      ],
      pass: { matches: ['led1', 'r1'] }
    },
    hint: 'Find the strip with the long leg of the LED. One end of the resistor goes in that strip, the other end in a free one.',
    done: 'The resistor and the long leg share a strip, so whatever feeds the resistor feeds the LED.'
  },
  {
    id: 'wire-up',
    kind: 'wire',
    title: 'Wire D13 and GND',
    parts: [],
    body: [
      'Wires join the Uno to the breadboard. Pick Jumper wires, click a pin on the Uno, then click a hole.',
      'Run one wire from D13 to the free end of the resistor, and one from GND to the short leg of the LED.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'D13 reaches the resistor', rule: { joined: ['D13', 'r1.*'] } },
        { text: 'GND reaches the short leg', rule: { joined: ['GND', 'led1.cathode'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'D13 is on the top header of the Uno, next to a GND pin. Each wire goes into a free hole in the right strip.',
    done: 'The circuit is complete: D13, resistor, LED, GND. Run is unlocked.'
  },
  {
    id: 'guess',
    kind: 'predict',
    title: 'Guess, then run',
    body: [
      'The sketch sets D13 HIGH, waits 500 ms, sets it LOW and waits 500 ms again. Then loop() starts over.',
      'Before you press Run, make a guess.'
    ],
    check: {
      type: 'predict',
      question: 'What will the LED do?',
      options: ['Stay on', 'Blink once a second', 'Blink ten times a second'],
      answer: 1,
      explain: [
        'You guessed it would stay on. It blinks, because loop() runs again and again: on, wait, off, wait.',
        'Right. 500 ms on and 500 ms off makes one blink every second.',
        'You guessed ten times a second. Each delay(500) is half a second, so it blinks once a second.'
      ],
      then: { type: 'sim', progress: 'blinked', text: 'Run the sketch and watch a full blink' }
    },
    done: 'loop() repeats forever, so the LED keeps blinking.'
  },
  {
    id: 'faster',
    kind: 'code',
    title: 'Blink faster',
    body: [
      'Now change the code. Make one full blink, on plus off, take less than 500 ms.',
      'Edit the two delay() values, or use the On time and Off time sliders, then press Run again.'
    ],
    check: {
      type: 'all',
      checks: [
        { type: 'code', rule: 'compiles', text: 'The sketch compiles' },
        { type: 'sim', goal: true, text: 'One blink takes under 500 ms' }
      ]
    },
    hint: 'Each delay() is half of one blink. Two delays of 200 ms make a 400 ms blink.',
    showMe: { lines: [10, 12], note: 'try 200' },
    done: 'Shorter delays make a faster blink.'
  }
]
```

## 1.3 Resistors and Ohm's law

```js
prebuilt: ['r1', 'led1', 'w2'],
steps: [
  {
    id: 'ohms-law',
    kind: 'learn',
    title: "Ohm's law",
    body: [
      'Current equals voltage divided by resistance: I = V / R.',
      'With a 5 V pin and a 2 V LED, the resistor gets the 3 V that is left. A 220 ohm resistor then lets about 14 mA through.'
    ],
    check: {
      type: 'quiz',
      question: 'What does a bigger resistor do to the LED?',
      options: ['Lets more current through, so the LED is brighter', 'Lets less current through, so the LED is dimmer', 'Nothing, it only gets warmer'],
      answer: 1,
      explain: [
        'Not quite. More resistance means less current: I = V / R.',
        'Right. More resistance, less current, so the LED is dimmer.',
        'Not quite. With the same voltage, more resistance means less current, and the LED dims.'
      ]
    },
    done: 'More ohms, less current.'
  },
  {
    id: 'wire-d9',
    kind: 'wire',
    title: 'Move to pin D9',
    parts: [],
    body: [
      'The LED circuit from Blink is already built. This sketch drives pin D9, so the circuit needs a wire from D9.',
      'Run a wire from D9 to the free end of the resistor.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'D9 reaches the resistor', rule: { joined: ['D9', 'r1.*'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'D9 is on the top header of the Uno. The end of the resistor that is not next to the LED needs the wire.',
    done: 'D9 now feeds the LED through the resistor.'
  },
  {
    id: 'measure-220',
    kind: 'run',
    title: 'Measure the current',
    body: [
      'Press Run, then click the LED or the resistor to measure the current. You can also pick one in Meter on.',
      'With 220 ohm it is about 14 mA.'
    ],
    check: { type: 'sim', progress: 'measured220', text: 'Measure with the 220 ohm resistor' },
    done: '14 mA is safe: an LED can take up to about 20 mA.'
  },
  {
    id: 'swap',
    kind: 'run',
    title: 'Try bigger resistors',
    body: ['Pick 1 kohm, then 10 kohm, in the Resistor choice. Measure each time and watch the LED get dimmer.'],
    check: {
      type: 'all',
      checks: [
        { type: 'sim', progress: 'measured1000', text: 'Measure with 1 kohm' },
        { type: 'sim', progress: 'measured10000', text: 'Measure with 10 kohm' }
      ]
    },
    hint: 'Keep the sketch running while you change the Resistor choice, then click the LED again.',
    done: 'About 3 mA with 1 kohm and 0.3 mA with 10 kohm: the bigger the resistor, the dimmer the LED.'
  },
  {
    id: 'which-safe',
    kind: 'learn',
    title: 'Pick a safe resistor',
    body: ['An LED can take about 20 mA at most.'],
    check: {
      type: 'quiz',
      question: 'Which of these keep the LED safe on a 5 V pin?',
      options: ['Only 10 kohm', '220 ohm or bigger', 'Any resistor, or none at all'],
      answer: 1,
      explain: [
        'Not quite. 10 kohm is safe but very dim. 220 ohm gives about 14 mA, which is also safe.',
        'Right. 220 ohm gives about 14 mA, under the 20 mA limit, and bigger ones give less.',
        'Not quite. With no resistor nothing limits the current, and the LED or the pin can burn out.'
      ]
    },
    done: '220 ohm is the usual choice: bright and safe.'
  }
]
```

## 1.4 Button input

```js
prebuilt: ['r1', 'led1', 'w1', 'w2'],
steps: [
  {
    id: 'button-inside',
    kind: 'learn',
    title: 'Inside a button',
    body: ['A push button has four legs. The two legs facing each other across the centre gap are always joined. Pressing the button joins the left pair to the right pair.'],
    check: {
      type: 'quiz',
      question: 'When are the left legs joined to the right legs?',
      options: ['Always', 'Only while the button is pressed', 'Never'],
      answer: 1,
      explain: [
        'Not quite. The left and right pairs are only joined while you press.',
        'Right. Pressing joins the two pairs; letting go splits them again.',
        'Not quite. Pressing the button joins the two pairs.'
      ]
    },
    done: 'A button is a gap you can close with your finger.'
  },
  {
    id: 'place-button',
    kind: 'build',
    title: 'Place the button',
    parts: ['btn1'],
    body: ['The LED circuit from earlier is already built. Put the button across the centre gap, with two legs in row e and two in row f.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Button is on the breadboard', rule: { placed: 'btn1' } },
        { text: 'Across the centre gap', rule: { straddles: 'btn1' } }
      ]
    },
    hint: 'Hover over row e next to the gap. The ghost shows all four legs: two above the gap and two below.',
    done: 'Each side of the button has its own strips.'
  },
  {
    id: 'wire-button',
    kind: 'wire',
    title: 'Wire the button',
    parts: [],
    body: [
      'Wire D2 to one side of the button and GND to the other side. The GND pin next to D13 is in use, so take one from the bottom header.',
      'The sketch turns on a pull up resistor inside the Uno, so D2 reads HIGH until the button joins it to GND.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'D2 reaches one side', rule: { joined: ['D2', 'btn1.*'] } },
        { text: 'GND reaches the other side', rule: { joined: ['GND', 'btn1.*'] } },
        { text: 'D2 and GND are on different sides', rule: { apart: ['D2', 'GND'] } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'Use a strip on the left side of the button for D2 and a strip on the right side for GND.',
    done: 'Pressing the button now joins D2 to GND.'
  },
  {
    id: 'guess',
    kind: 'predict',
    title: 'Guess, then press',
    body: ['The sketch lights the LED while D2 reads LOW.'],
    check: {
      type: 'predict',
      question: 'What does D2 read while you hold the button down?',
      options: ['HIGH', 'LOW', 'It changes at random'],
      answer: 1,
      explain: [
        'You guessed HIGH. Holding the button joins D2 to GND, so it reads LOW and the LED turns on.',
        'Right. The button joins D2 to GND, so it reads LOW and the LED turns on.',
        'You guessed random. The pull up keeps D2 HIGH and the button pulls it LOW, so it never floats.'
      ],
      then: { type: 'sim', progress: 'pressedOnce', text: 'Run it and press the button once' }
    },
    hint: 'Press Run, then hold the button with the mouse or with Hold to press.',
    done: 'Pressed means LOW here, because of the pull up.'
  },
  {
    id: 'three-presses',
    kind: 'run',
    title: 'Three presses',
    body: ['Keep it running and press and release the button three times. The readout shows how fast the LED reacts.'],
    check: { type: 'sim', goal: true, text: 'Press and release 3 times while it runs' },
    done: 'The LED follows the button in well under a millisecond.'
  }
]
```

## 1.5 Pull up vs pull down

The param is labelled `Pull down resistor` with options `Fitted` and
`Removed`.

```js
prebuilt: ['btn1', 'r1', 'led1', 'w1', 'w2', 'w3'],
steps: [
  {
    id: 'floating',
    kind: 'learn',
    title: 'A floating pin',
    body: [
      'An input pin with nothing joined to it floats. It picks up electrical noise and reads HIGH or LOW at random.',
      'A pull down resistor ties the pin gently to GND, so it reads LOW until the button joins it to 5V.'
    ],
    check: {
      type: 'quiz',
      question: 'What does an input pin read when nothing is joined to it?',
      options: ['Always LOW', 'Always HIGH', 'Random values from noise'],
      answer: 2,
      explain: [
        'Not quite. Nothing holds it LOW, so it drifts with noise.',
        'Not quite. Nothing holds it HIGH either; it drifts with noise.',
        'Right. A floating pin reads whatever noise it picks up.'
      ]
    },
    done: 'Inputs need something to hold them at a level.'
  },
  {
    id: 'pull-down',
    kind: 'build',
    title: 'Add the pull down',
    parts: ['r2'],
    body: ['The button from the last lesson is in place, with D2 wired to one side. Place the 10 kohm resistor from the D2 side of the button to a free strip.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Resistor is on the breadboard', rule: { placed: 'r2' } },
        { text: 'One end shares a strip with D2', rule: { joined: ['r2.*', 'D2'] } },
        { text: 'The other end has a strip of its own', rule: { apart: ['r2.a', 'r2.b'] } }
      ],
      pass: { matches: ['btn1', 'r2'] }
    },
    hint: 'One end goes in the strip where the D2 wire is. The other end goes in an empty strip a few columns away.',
    done: 'D2 is joined to the resistor, ready to be pulled down.'
  },
  {
    id: 'wire-pull',
    kind: 'wire',
    title: 'Wire 5V and GND',
    parts: [],
    body: [
      'Run GND to the free end of the 10 kohm resistor. Then run 5V to the other side of the button from D2.',
      'The GND pin next to D13 is in use, so take one from the bottom header.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'GND reaches the resistor', rule: { joined: ['GND', 'r2.*'] } },
        { text: '5V reaches the other side of the button', rule: { joined: ['5V', 'btn1.*'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'GND goes in the strip with the free resistor end. 5V goes in a strip on the side of the button away from D2.',
    done: 'Now D2 reads LOW through the resistor, and HIGH while you press.'
  },
  {
    id: 'see-float',
    kind: 'run',
    title: 'See it float',
    body: ['Pick Removed in the Pull down resistor choice to take it out of the circuit, then press Run. Nothing holds D2 now, so the LED flickers.'],
    check: { type: 'sim', progress: 'floated', text: 'Run with the resistor removed and see D2 float' },
    hint: 'Change the Pull down resistor choice to Removed before you press Run, and leave the button alone.',
    done: 'Without a pull down, the pin floats and the LED flickers.'
  },
  {
    id: 'three-presses',
    kind: 'run',
    title: 'Fit it again',
    body: ['Pick Fitted in the Pull down resistor choice, press Run, and press the button three times.'],
    check: { type: 'sim', goal: true, text: 'Three presses with the resistor fitted' },
    done: 'With the pull down, D2 is LOW until you press, every time.'
  }
]
```

## 1.6 Potentiometer

```js
prebuilt: [],
steps: [
  {
    id: 'wiper',
    kind: 'learn',
    title: 'Inside a potentiometer',
    body: [
      'A potentiometer is a resistor with a contact that slides along it, called the wiper. The two outer legs go to 5V and GND.',
      'Turning the knob moves the wiper, so the middle leg gives any voltage from 0 to 5 V.'
    ],
    check: {
      type: 'quiz',
      question: 'Which leg gives the voltage that changes as you turn the knob?',
      options: ['Either outer leg', 'The middle leg, the wiper', 'All three'],
      answer: 1,
      explain: [
        'Not quite. The outer legs sit at 5V and GND; only the wiper moves.',
        'Right. The wiper slides between the two outer legs.',
        'Not quite. The outer legs stay at 5V and GND; only the middle leg changes.'
      ]
    },
    done: 'The wiper is the leg to read.'
  },
  {
    id: 'place-pot',
    kind: 'build',
    title: 'Place the potentiometer',
    parts: ['pot1'],
    body: ['Put the potentiometer in one row so each of its three legs has its own strip.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Potentiometer is on the breadboard', rule: { placed: 'pot1' } },
        { text: 'Each leg in its own strip', rule: { allApart: 'pot1' } }
      ]
    },
    hint: 'Keep all three legs in the same row, for example row e. They then sit in three side by side strips.',
    done: 'Three legs, three strips.'
  },
  {
    id: 'wire-pot',
    kind: 'wire',
    title: 'Wire it to the Uno',
    parts: [],
    body: ['Wire one outer leg to 5V, the other outer leg to GND, and the middle leg to A0.'],
    check: {
      type: 'circuit',
      items: [
        { text: '5V reaches an outer leg', rule: { joined: ['5V', 'pot1.end'] } },
        { text: 'GND reaches the other outer leg', rule: { joined: ['GND', 'pot1.end'] } },
        { text: 'A0 reaches the middle leg', rule: { joined: ['A0', 'pot1.wiper'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: '5V and A0 are on the bottom header of the Uno, near two GND pins. The middle leg goes to A0.',
    done: 'A0 now reads the wiper.'
  },
  {
    id: 'turn',
    kind: 'run',
    title: 'Turn the knob',
    body: ['Press Run, then drag the knob up or down, or use the Knob slider. Watch the numbers in the Serial Monitor.'],
    check: {
      type: 'all',
      checks: [
        { type: 'sim', progress: 'seenLow', text: 'Turn it all the way one way' },
        { type: 'sim', progress: 'seenHigh', text: 'Turn it all the way the other way' }
      ]
    },
    done: 'The reading runs from 0 to 5 V as you turn.'
  },
  {
    id: 'reading',
    kind: 'learn',
    title: 'Read the number',
    body: ['analogRead turns 0 to 5 V into a number from 0 to 1023.'],
    check: {
      type: 'quiz',
      question: 'The knob is half way. About what does analogRead(A0) give?',
      options: ['About 100', 'About 512', 'About 1023'],
      answer: 1,
      explain: [
        'Not quite. Half way is about 2.5 V, which is about half of 1023.',
        'Right. Half of 5 V is 2.5 V, about 512.',
        'Not quite. 1023 is the full 5 V; half way is about 512.'
      ]
    },
    done: 'Voltage in, number out: 0 to 1023.'
  }
]
```

## 1.7 PWM fade

```js
prebuilt: ['r1', 'led1', 'w2'],
steps: [
  {
    id: 'pwm',
    kind: 'learn',
    title: 'What PWM does',
    body: [
      'PWM switches a pin on and off very fast. The share of the time it is on is the duty cycle, and your eye sees the average.',
      'analogWrite takes 0, always off, up to 255, always on.'
    ],
    check: {
      type: 'quiz',
      question: 'analogWrite(9, 64) keeps pin 9 on for about...',
      options: ['A quarter of the time', 'Half the time', 'All the time'],
      answer: 0,
      explain: [
        'Right. 64 is about a quarter of 255.',
        'Not quite. Half would be about 128.',
        'Not quite. All the time is 255.'
      ]
    },
    done: 'A higher value means a longer on time and a brighter LED.'
  },
  {
    id: 'wire-d9',
    kind: 'wire',
    title: 'Move to pin D9',
    parts: [],
    body: ['The LED circuit is already built. PWM only works on pins marked ~, so this sketch uses D9. Run a wire from D9 to the free end of the resistor.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'D9 reaches the resistor', rule: { joined: ['D9', 'r1.*'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'D9 is on the top header of the Uno, marked ~9.',
    done: 'D9 can fade the LED.'
  },
  {
    id: 'guess',
    kind: 'predict',
    title: 'Guess the fade time',
    body: ['The sketch steps the level from 0 to 255 and back, waiting the step delay at every level.'],
    check: {
      type: 'predict',
      question: 'With a 10 ms step, how long does one fade up take?',
      options: ['About a quarter of a second', 'About 2.5 seconds', 'About 25 seconds'],
      answer: 1,
      explain: [
        'You guessed a quarter of a second. 256 steps of 10 ms is about 2.5 seconds.',
        'Right. 256 steps of 10 ms is about 2.5 seconds.',
        'You guessed 25 seconds. 256 steps of 10 ms is about 2.5 seconds.'
      ],
      then: { type: 'sim', progress: 'rampSeen', text: 'Run it and watch one fade from off to full' }
    },
    done: 'Steps times delay gives the fade time.'
  },
  {
    id: 'speed-up',
    kind: 'code',
    title: 'Fade in 1 to 3 seconds',
    body: ['Make one full fade, up and back down, take between 1 and 3 seconds. Change the step delay in the code or with the Step delay slider, then press Run.'],
    check: {
      type: 'all',
      checks: [
        { type: 'code', rule: 'compiles', text: 'The sketch compiles' },
        { type: 'sim', goal: true, text: 'One fade up and down takes 1 to 3 seconds' }
      ]
    },
    hint: 'Up and down is 512 steps. 512 steps of 4 ms is about 2 seconds.',
    showMe: { lines: [10, 14], note: 'try 4' },
    done: 'A shorter step makes a quicker fade.'
  }
]
```

## 1.8 Colour mixing

```js
prebuilt: [],
steps: [
  {
    id: 'rgb-legs',
    kind: 'learn',
    title: 'Inside an RGB LED',
    body: [
      'An RGB LED holds a red, a green and a blue LED in one case. In a common cathode type they share one GND leg, the longest one.',
      'Each colour needs its own pin and its own resistor.'
    ],
    check: {
      type: 'quiz',
      question: 'Where does the longest leg go?',
      options: ['5V', 'GND', 'Pin D9'],
      answer: 1,
      explain: [
        'Not quite. The longest leg is the shared cathode, so it goes to GND.',
        'Right. The shared cathode goes to GND.',
        'Not quite. D9 drives one colour leg; the longest leg is the shared cathode, for GND.'
      ]
    },
    done: 'One GND leg, three colour legs.'
  },
  {
    id: 'place-rgb',
    kind: 'build',
    title: 'Place the RGB LED',
    parts: ['rgb1'],
    body: ['Put the RGB LED in one row so each of its four legs has its own strip. The legs are red, GND, green and blue, in that order.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'RGB LED is on the breadboard', rule: { placed: 'rgb1' } },
        { text: 'Each leg in its own strip', rule: { allApart: 'rgb1' } }
      ]
    },
    hint: 'Keep all four legs in row e so each sits in its own column.',
    done: 'Four legs, four strips.'
  },
  {
    id: 'resistors',
    kind: 'build',
    title: 'A resistor per colour',
    parts: ['r1', 'r2', 'r3'],
    body: [
      'Each colour leg gets its own 220 ohm resistor. Join one resistor to the red leg, one to the green leg and one to the blue leg. Each other end goes in a free strip.',
      'A resistor can also cross the centre gap, from row d to row g.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: 'A resistor on the red leg', rule: { joined: ['r1.*', 'rgb1.red'] } },
        { text: 'A resistor on the green leg', rule: { joined: ['r2.*', 'rgb1.green'] } },
        { text: 'A resistor on the blue leg', rule: { joined: ['r3.*', 'rgb1.blue'] } }
      ],
      pass: { matches: ['rgb1', 'r1', 'r2', 'r3'] }
    },
    hint: 'The legs are side by side, so the resistors cannot all go the same way. Send one across the centre gap, and the others out to the left and right.',
    done: 'Each colour has its own resistor.'
  },
  {
    id: 'wire-rgb',
    kind: 'wire',
    title: 'Wire the colours',
    parts: [],
    body: ['Wire D9 to the red resistor, D10 to the green one and D11 to the blue one. Then wire GND to the longest leg.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'D9 reaches the red resistor', rule: { joined: ['D9', 'r1.*'] } },
        { text: 'D10 reaches the green resistor', rule: { joined: ['D10', 'r2.*'] } },
        { text: 'D11 reaches the blue resistor', rule: { joined: ['D11', 'r3.*'] } },
        { text: 'GND reaches the longest leg', rule: { joined: ['GND', 'rgb1.cathode'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'Each pin wire goes into the free end of its resistor, not into the LED strip.',
    done: 'Three pins, three colours.'
  },
  {
    id: 'mix',
    kind: 'run',
    title: 'Mix orange',
    body: ['Press Run, then move the Red, Green and Blue sliders until the LED glows orange: about 255 red, 128 green and 0 blue.'],
    check: { type: 'sim', goal: true, text: 'Each channel within 25 of orange' },
    hint: 'Start with Red at 255 and Blue at 0, then bring Green to about the middle.',
    done: 'Full red plus half green makes orange.'
  }
]
```

## 1.9 Light sensor

```js
prebuilt: ['r1', 'led1', 'w1', 'w2'],
steps: [
  {
    id: 'ldr',
    kind: 'learn',
    title: 'A light sensor',
    body: ['A photoresistor changes its resistance with light. Paired with a fixed resistor it makes a voltage divider, and the point between the two goes to an analog pin.'],
    check: {
      type: 'quiz',
      question: 'What happens to the photoresistor in the dark?',
      options: ['Its resistance goes up', 'Its resistance goes down', 'It stays the same'],
      answer: 0,
      explain: [
        'Right. Less light, more resistance.',
        'Not quite. More light lowers it; in the dark it goes up.',
        'Not quite. Changing with light is the whole point of the part.'
      ]
    },
    done: 'Dark means high resistance.'
  },
  {
    id: 'place-ldr',
    kind: 'build',
    title: 'Place the photoresistor',
    parts: ['ldr1'],
    body: ['The night light LED from earlier is already built. Place the photoresistor with its two legs in two different strips.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Photoresistor is on the breadboard', rule: { placed: 'ldr1' } },
        { text: 'Legs in two different strips', rule: { apart: ['ldr1.a', 'ldr1.b'] } }
      ]
    },
    hint: 'Put both legs in one row, two or three columns apart, on the left of the board.',
    done: 'Two legs, two strips.'
  },
  {
    id: 'fixed-resistor',
    kind: 'build',
    title: 'Make the divider',
    parts: ['r2'],
    body: ['Place the 10 kohm resistor so one end shares a strip with one leg of the photoresistor. That shared strip is the middle of the divider.'],
    check: {
      type: 'circuit',
      items: [
        { text: '10 kohm resistor is on the breadboard', rule: { placed: 'r2' } },
        { text: 'It shares a strip with the photoresistor', rule: { joined: ['r2.*', 'ldr1.*'] } }
      ],
      pass: { matches: ['ldr1', 'r2'] }
    },
    hint: 'One end of the resistor goes in the strip of one photoresistor leg, using a different row. The other end goes in a free strip.',
    done: 'The divider is built.'
  },
  {
    id: 'wire-divider',
    kind: 'wire',
    title: 'Wire the divider',
    parts: [],
    body: [
      'Wire 5V to the free leg of the photoresistor, A0 to the middle strip, and GND to the free end of the 10 kohm resistor.',
      'The GND pin next to D13 is in use, so take one from the bottom header.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: '5V reaches the photoresistor', rule: { joined: ['5V', 'ldr1.*'] } },
        { text: 'A0 reaches the middle', rule: { joined: ['A0', 'ldr1.*', 'r2.*'] } },
        { text: 'GND reaches the 10 kohm resistor', rule: { joined: ['GND', 'r2.*'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'The middle is the strip where the photoresistor and the 10 kohm resistor meet.',
    done: 'More light, higher reading on A0.'
  },
  {
    id: 'dark',
    kind: 'run',
    title: 'Night and day',
    body: ['Press Run. Slide Room light down until the night light turns on, then up until it turns off.'],
    check: {
      type: 'all',
      checks: [
        { type: 'sim', progress: 'turnedOn', text: 'Make it dark enough to turn the LED on' },
        { type: 'sim', goal: true, text: 'Make it bright enough to turn it off again' }
      ]
    },
    done: 'The sketch compares the reading with the dark level and switches the LED.'
  }
]
```

## 1.10 Temperature

```js
prebuilt: [],
steps: [
  {
    id: 'tmp-legs',
    kind: 'learn',
    title: 'The TMP36 legs',
    body: [
      'The TMP36 is a temperature sensor with three legs. With its flat face towards you they are +Vs, Vout and GND from left to right.',
      'Vout gives 0.5 V at 0 deg C and 10 mV more for every degree.'
    ],
    check: {
      type: 'quiz',
      question: 'With the flat face towards you, which leg goes to GND?',
      options: ['The left leg', 'The middle leg', 'The right leg'],
      answer: 2,
      explain: [
        'Not quite. The left leg is +Vs, for 5V.',
        'Not quite. The middle leg is Vout, for the analog pin.',
        'Right. The right leg is GND.'
      ]
    },
    done: 'Wired the wrong way round, a TMP36 gets hot, so the order matters.'
  },
  {
    id: 'place-tmp',
    kind: 'build',
    title: 'Place the sensor',
    parts: ['tmp1'],
    body: ['Put the TMP36 in one row so each leg has its own strip. Its flat face points towards you.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'TMP36 is on the breadboard', rule: { placed: 'tmp1' } },
        { text: 'Each leg in its own strip', rule: { allApart: 'tmp1' } }
      ]
    },
    hint: 'Keep all three legs in the same row, for example row e. They then sit in three side by side strips.',
    done: 'Three legs, three strips.'
  },
  {
    id: 'wire-tmp',
    kind: 'wire',
    title: 'Wire the sensor',
    parts: [],
    body: ['Wire 5V to the +Vs leg on the left, A0 to Vout in the middle, and GND to the right leg.'],
    check: {
      type: 'circuit',
      items: [
        { text: '5V reaches +Vs', rule: { joined: ['5V', 'tmp1.vs'] } },
        { text: 'A0 reaches Vout', rule: { joined: ['A0', 'tmp1.vout'] } },
        { text: 'GND reaches the GND leg', rule: { joined: ['GND', 'tmp1.gnd'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'Left to right with the flat face towards you: 5V, A0, GND.',
    done: 'A0 now reads the temperature as a voltage.'
  },
  {
    id: 'guess',
    kind: 'predict',
    title: 'Guess the voltage',
    body: ['The room starts at 22 deg C. The sketch prints the temperature to the Serial Monitor once a second.'],
    check: {
      type: 'predict',
      question: 'At 25 deg C, what voltage does Vout give?',
      options: ['0.25 V', '0.75 V', '2.5 V'],
      answer: 1,
      explain: [
        'You guessed 0.25 V. It is 0.5 V at 0 deg C plus 25 times 10 mV, so 0.75 V.',
        'Right. 0.5 V plus 25 times 10 mV is 0.75 V.',
        'You guessed 2.5 V. It is 0.5 V plus 25 times 10 mV, so 0.75 V.'
      ],
      then: { type: 'sim', progress: 'ran', text: 'Run it and read the Serial Monitor' }
    },
    done: 'Take away 0.5 V and multiply by 100 to get deg C.'
  },
  {
    id: 'hot-cold',
    kind: 'run',
    title: 'Hot and cold',
    body: ['Keep it running. Use the Room temperature slider to cool the room to 15 deg C or less, then warm it to 30 deg C or more.'],
    check: {
      type: 'all',
      checks: [
        { type: 'sim', progress: 'seenCool', text: 'Cool it to 15 deg C or less' },
        { type: 'sim', progress: 'seenWarm', text: 'Warm it to 30 deg C or more' }
      ]
    },
    done: 'The reading follows the room.'
  }
]
```

## 1.11 Sound

The note choices are labelled `Note 1`, `Note 2` and `Note 3`.

```js
prebuilt: [],
steps: [
  {
    id: 'pitch',
    kind: 'learn',
    title: 'Pitch and frequency',
    body: [
      'A passive buzzer clicks every time its voltage changes. The tone function makes a square wave, so it clicks hundreds of times a second and you hear a note.',
      'A higher frequency gives a higher note.'
    ],
    check: {
      type: 'quiz',
      question: 'Which sounds higher?',
      options: ['tone(8, 262)', 'tone(8, 494)', 'They sound the same'],
      answer: 1,
      explain: [
        'Not quite. 262 Hz is a low C; 494 Hz is higher.',
        'Right. 494 Hz is a B, higher than the 262 Hz C.',
        'Not quite. The second number is the frequency, and a bigger one sounds higher.'
      ]
    },
    done: 'Hz means clicks per second.'
  },
  {
    id: 'place-buzzer',
    kind: 'build',
    title: 'Place the buzzer',
    parts: ['bz1'],
    body: ['Put the buzzer so its two legs sit in two different strips. A passive buzzer works either way round, but its + leg usually goes to the pin.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Buzzer is on the breadboard', rule: { placed: 'bz1' } },
        { text: 'Legs in two different strips', rule: { apart: ['bz1.a', 'bz1.b'] } }
      ]
    },
    hint: 'Put both legs in the same row, for example row e. The legs sit three columns apart.',
    done: 'Two legs, two strips.'
  },
  {
    id: 'wire-buzzer',
    kind: 'wire',
    title: 'Wire the buzzer',
    parts: [],
    body: ['Wire D8 to one leg of the buzzer and GND to the other.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'D8 reaches the buzzer', rule: { joined: ['D8', 'bz1.*'] } },
        { text: 'GND reaches the buzzer', rule: { joined: ['GND', 'bz1.*'] } },
        { text: 'D8 and GND on different legs', rule: { apart: ['D8', 'GND'] } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'D8 is on the top header of the Uno, next to a GND pin. Each wire goes into a free hole in the strip of one leg.',
    done: 'D8 can now make sound.'
  },
  {
    id: 'tune',
    kind: 'code',
    title: 'Play E, D, C',
    body: ['Press Run to hear the tune. Then pick Note 1, Note 2 and Note 3 so it plays E, D, C, or change the numbers in the code.'],
    check: {
      type: 'all',
      checks: [
        { type: 'sim', progress: 'played', text: 'Play the tune once' },
        { type: 'sim', goal: true, text: 'The tune plays E, D, C' }
      ]
    },
    hint: 'E is 330 Hz, D is 294 Hz and C is 262 Hz.',
    showMe: { lines: [2], note: 'E D C is 330, 294, 262' },
    done: 'The notes array sets the tune.'
  }
]
```

## 1.12 Servo basics

```js
prebuilt: [],
steps: [
  {
    id: 'servo-wires',
    kind: 'learn',
    title: 'Servo wires',
    body: ['A hobby servo turns its arm to an angle from 0 to 180 deg and holds it there. Its cable has three wires: brown GND, red 5V and orange signal.'],
    check: {
      type: 'quiz',
      question: 'Which wire tells the servo what angle to go to?',
      options: ['Brown', 'Red', 'Orange'],
      answer: 2,
      explain: [
        'Not quite. Brown is GND.',
        'Not quite. Red is the 5V supply.',
        'Right. Orange carries the signal pulses.'
      ]
    },
    done: 'Power on brown and red, the angle on orange.'
  },
  {
    id: 'place-servo',
    kind: 'build',
    title: 'Plug in the servo',
    parts: ['sv1'],
    body: ['Put the three cable ends in one row so each has its own strip. The servo body sits on the board to the right of them.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Servo is on the breadboard', rule: { placed: 'sv1' } },
        { text: 'Each wire in its own strip', rule: { allApart: 'sv1' } }
      ]
    },
    hint: 'Pick a spot with room on the right for the servo body, for example row h near the left of the board.',
    done: 'Three wires, three strips.'
  },
  {
    id: 'wire-servo',
    kind: 'wire',
    title: 'Wire the servo',
    parts: [],
    body: ['Wire GND to the brown wire, 5V to the red wire and D9 to the orange wire.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'GND reaches brown', rule: { joined: ['GND', 'sv1.gnd'] } },
        { text: '5V reaches red', rule: { joined: ['5V', 'sv1.vcc'] } },
        { text: 'D9 reaches orange', rule: { joined: ['D9', 'sv1.signal'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'GND and 5V are on the bottom header of the Uno, and D9 is on the top header. The cable ends are brown, red and orange from left to right.',
    done: 'The Servo library can now drive D9.'
  },
  {
    id: 'angles',
    kind: 'run',
    title: 'Three angles',
    body: ['Press Run, then set the Angle slider to 45, 90 and 135 deg in turn. Let the arm reach each one.'],
    check: {
      type: 'all',
      checks: [
        { type: 'sim', progress: 'reached45', text: 'Reach 45 deg' },
        { type: 'sim', progress: 'reached90', text: 'Reach 90 deg' },
        { type: 'sim', progress: 'reached135', text: 'Reach 135 deg' }
      ]
    },
    hint: 'Wait a moment at each angle: the arm takes time to get there.',
    done: 'write() sets the angle and the servo holds it.'
  }
]
```

## P1 Project: Room monitor

```js
project: true,
prebuilt: [],
steps: [
  {
    id: 'plan',
    kind: 'learn',
    title: 'Plan the monitor',
    body: [
      'This project puts Level 1 together. A photoresistor tells day from night, a TMP36 reads the air, a yellow LED is the night light and a buzzer sounds when it gets too hot.',
      'You build all of it yourself. Hints stay hidden until you ask.'
    ],
    check: {
      type: 'quiz',
      question: 'Which part tells day from night?',
      options: ['The TMP36', 'The photoresistor', 'The buzzer'],
      answer: 1,
      explain: [
        'Not quite. The TMP36 reads temperature.',
        'Right. Its resistance changes with light.',
        'Not quite. The buzzer is an output: it makes the alarm sound.'
      ]
    },
    done: 'Two sensors in, two outputs out.'
  },
  {
    id: 'light-sensor',
    kind: 'build',
    title: 'Light sensor',
    parts: ['ldr1', 'r2'],
    body: ['Build the light divider: the photoresistor and the 10 kohm resistor, sharing one strip in the middle.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'Photoresistor placed', rule: { placed: 'ldr1' } },
        { text: '10 kohm resistor placed', rule: { placed: 'r2' } },
        { text: 'They share a strip', rule: { joined: ['ldr1.*', 'r2.*'] } }
      ],
      pass: { matches: ['ldr1', 'r2'] }
    },
    hint: 'It is the same divider as in lesson 1.9.',
    done: 'The divider is ready.'
  },
  {
    id: 'temp-sensor',
    kind: 'build',
    title: 'Temperature sensor',
    parts: ['tmp1'],
    body: ['Place the TMP36 with each leg in its own strip, flat face towards you.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'TMP36 placed', rule: { placed: 'tmp1' } },
        { text: 'Each leg in its own strip', rule: { allApart: 'tmp1' } }
      ]
    },
    done: 'Sensor two is in.'
  },
  {
    id: 'outputs',
    kind: 'build',
    title: 'Night light and alarm',
    parts: ['r1', 'led1', 'bz1'],
    body: ['Place the yellow LED with the 220 ohm resistor on its long leg, and the buzzer with its legs in two strips.'],
    check: {
      type: 'circuit',
      items: [
        { text: 'LED legs in two strips', rule: { apart: ['led1.anode', 'led1.cathode'] } },
        { text: 'Resistor on the long leg', rule: { joined: ['r1.*', 'led1.anode'] } },
        { text: 'Buzzer legs in two strips', rule: { apart: ['bz1.a', 'bz1.b'] } }
      ],
      pass: { matches: ['ldr1', 'r2', 'tmp1', 'r1', 'led1', 'bz1'] }
    },
    hint: 'The LED and resistor are the same as in Blink. The buzzer can go in the bottom half of the board.',
    done: 'Every part is on the board.'
  },
  {
    id: 'wire-all',
    kind: 'wire',
    title: 'Wire it all',
    parts: [],
    body: [
      'Wire it to the Uno: 5V to the photoresistor, A0 to the middle of the divider, 3.3V to +Vs of the TMP36 and A1 to its Vout, D13 to the LED resistor, D8 to the buzzer, and GND to every part that needs it.',
      'The Uno has only three GND pins, so a GND rail helps.'
    ],
    check: {
      type: 'circuit',
      items: [
        { text: '5V reaches the photoresistor', rule: { joined: ['5V', 'ldr1.*'] } },
        { text: 'A0 reaches the middle of the divider', rule: { joined: ['A0', 'ldr1.*', 'r2.*'] } },
        { text: '3.3V reaches +Vs of the TMP36', rule: { joined: ['3.3V', 'tmp1.vs'] } },
        { text: 'A1 reaches Vout', rule: { joined: ['A1', 'tmp1.vout'] } },
        { text: 'D13 reaches the LED resistor', rule: { joined: ['D13', 'r1.*'] } },
        { text: 'D8 reaches the buzzer', rule: { joined: ['D8', 'bz1.*'] } },
        { text: 'GND reaches the divider, TMP36, LED and buzzer', rule: { joined: ['GND', 'r2.*', 'tmp1.gnd', 'led1.cathode', 'bz1.*'] } },
        { text: 'No short circuits', rule: { noShorts: true } }
      ],
      pass: { matches: 'all' }
    },
    hint: 'Run one wire from a GND pin to the blue - rail, then a wire from the rail to each part that needs GND.',
    done: 'The room monitor is wired.'
  },
  {
    id: 'day',
    kind: 'code',
    title: 'Pass a whole day',
    body: ['Set the Dark level and the Alarm temperature, press Run and pass one whole day. The LED must be on at night and off by day, and the alarm must sound above 32 deg C and stay quiet below 28 deg C.'],
    check: { type: 'sim', goal: true, text: 'Pass one whole day' },
    hint: 'At night the room is dim but not pitch black, so try a Dark level well under 300. Set the Alarm temperature between 28 and 32 deg C.',
    done: 'Your room monitor works all day and all night.'
  }
]
```

Kit wire counts follow `kitFor` (reference wires plus 2), so P1 has 12 wires.
With a GND rail the learner needs 11 (6 signal and power wires, 1 GND pin to
rail, 4 rail to parts).
