# Phase 3: Netlist, footprints and power rails

## Goal

Pure building blocks for hand built circuits, with thorough tests:

1. Power rails on the breadboard (naming, positions, geometry).
2. Footprints: which holes each part's legs use, for every way it can be
   placed.
3. The netlist: what is joined to what, comparing a learner's build with the
   lesson's reference circuit, and naming mistakes in plain words.
4. Step rules for build and wire checks.

No new UI in this phase except the rails drawn on the breadboard. The app
looks and works as after phase 2, with rails visible.

## Read first

- `src/parts/breadboard.js`, `src/parts/unoBoard.js` (pin names),
  `src/circuits/circuits.js`, `src/circuits/buildCircuit.js`,
  `test/circuits.test.js`, `test/breadboard.test.js`.
- AGENTS.md "Breadboard grid and circuit tables".

## 3.1 Power rails

`src/parts/breadboard.js`:

- Hole names: terminal holes stay `'12e'`. Rail holes are
  `'T+12'`, `'T-12'`, `'B-12'`, `'B+12'` for columns 1 to 30 (a hole in every
  column; real boards skip some, we do not).
- `export const RAIL_ROWS = ['T+', 'T-', 'B-', 'B+']`.
- Row positions in pitches along z (keep `a` to `j` exactly as today):

  | Row | z in pitches |
  | --- | --- |
  | `T+` | -9 |
  | `T-` | -8 |
  | `a` to `e` | -5.5 to -1.5 (unchanged) |
  | `f` to `j` | 1.5 to 5.5 (unchanged) |
  | `B-` | 8 |
  | `B+` | 9 |

- `DEPTH` grows to fit: half depth = 9.5 pitches + 0.15 cm margin. Keep the
  centre channel as it is. The two halves of the slab now run from the channel
  out to the new edges.
- Stripes: a thin red box (0.04 cm wide, 0.004 cm high, full length minus
  0.4 cm) half a pitch outside each `+` rail (`T+` at z = -9.5 P, `B+` at
  +9.5 P), and a blue one half a pitch inside each `-` rail (`T-` at -7.5 P,
  `B-` at +7.5 P). Colours `0xd0312d` and `0x2c6fd1`.
- `parseHole(name)` accepts both forms and returns `{ column, row }` with
  `row` one of `a` to `j` or a rail row. Same error messages as today for bad
  terminal holes; for rails `Breadboard hole 'T+31' has a column outside 1 to 30`.
- New: `isHole(name) -> boolean` (never throws), `ALL_HOLES` (420 names, rails
  included, in a stable order: rails `T+`, `T-`, then rows `a` to `j`, then
  `B-`, `B+`, each by column), `rowPitchZ(row) -> number`.
- `holePosition` and `holeStrip` handle rails. `holeStrip('T+12')` is
  `'rail-T+'`.
- `src/circuits/buildCircuit.js`: a wire start is a hole when `isHole(name)`
  (replace the regex), so wires may start or end on rails.

Tests in `test/breadboard.test.js`: parse rails, bad rails, positions (`T+1`
is 9 pitches towards -z from the board centre line, same x as `1a`),
`holeStrip` for rails, `ALL_HOLES.length === 420`, `isHole`.

## 3.2 Footprints

New pure module `src/circuits/footprints.js`.

### Part types

```js
export const PART_TYPES = {
  led:           { label: 'LED', terminals: ['anode', 'cathode'], polar: true, shape: 'pair' },
  resistor:      { label: 'resistor', terminals: ['a', 'b'], polar: false, shape: 'bend', minSpan: 2, maxSpan: 8 },
  ldr:           { label: 'photoresistor', terminals: ['a', 'b'], polar: false, shape: 'bend', minSpan: 2, maxSpan: 6 },
  button:        { label: 'button', terminals: ['a', 'b'], polar: false, shape: 'button' },
  potentiometer: { label: 'potentiometer', terminals: ['end1', 'wiper', 'end2'], polar: false, shape: 'row', count: 3, flip: true },
  tmp36:         { label: 'TMP36', terminals: ['vs', 'vout', 'gnd'], polar: true, shape: 'row', count: 3, flip: false },
  servo:         { label: 'servo', terminals: ['gnd', 'vcc', 'signal'], polar: true, shape: 'row', count: 3, flip: false },
  rgbLed:        { label: 'RGB LED', terminals: ['red', 'cathode', 'green', 'blue'], polar: true, shape: 'row', count: 4, flip: true },
  buzzer:        { label: 'buzzer', terminals: ['a', 'b'], polar: false, shape: 'gap', gap: 3, flip: true }
}
```

The buzzer is a passive piezo, which works either way round, so it is not
polar. Spans are in pitches.

### Terminal labels (used in messages)

| Type | Labels |
| --- | --- |
| led | anode `long leg`, cathode `short leg` |
| resistor, ldr, buzzer | a and b both `end` |
| button | a `left side`, b `right side` |
| potentiometer | end1 and end2 `outer leg`, wiper `middle leg` |
| tmp36 | vs `+Vs leg`, vout `Vout leg`, gnd `GND leg` |
| servo | gnd `brown GND wire`, vcc `red 5V wire`, signal `orange signal wire` |
| rgbLed | red `red leg`, cathode `long leg`, green `green leg`, blue `blue leg` |

Export them as `TERMINAL_LABELS[type][terminal]`.

### Legs

A placed part is described by `legs`, an array of hole names in terminal
order, except the button, which has four legs:
`[c r1, c+2 r1, c r2, c+2 r2]`. Terminal `a` of a button is legs 0 and 2
(always joined inside the button), terminal `b` is legs 1 and 3.

```js
// legsOf(part) -> string[]
//   part.legs when present; otherwise from the reference formats:
//   led [anode, cathode]; resistor and ldr [from, to]; button buttonHoles(at);
//   potentiometer, tmp36 and servo potHoles(at); rgbLed rgbHoles(at);
//   buzzer buzzerHoles(at).
// terminalHoles(part) -> { [terminal]: string[] }
// footprint(type, anchor, orientation) -> string[] | null   (fixed shapes)
// orientationCount(type) -> number
// bendLegs(type, from, to) -> string[] | null               (bend shapes)
```

Move `buttonHoles`, `potHoles`, `rgbHoles` and `buzzerHoles` here and re-export
them from `buildCircuit.js` so existing imports keep working.

`footprint` rules (return null when any leg is off the board):

- `pair` (LED), 4 orientations, anchor is the anode: 0 cathode one column
  right, 1 one row towards +z, 2 one column left, 3 one row towards -z. A row
  step is only allowed when the two rows are exactly 1 pitch apart (`a`-`b` ...
  `d`-`e`, `f`-`g` ... `i`-`j`, `T+`-`T-`, `B-`-`B+`), never across the channel
  or from `a` to `T-`.
- `button`, 1 orientation, anchor is leg 0 (`c r1`). `r2` is the row exactly 3
  pitches towards +z: pairs `a`-`d`, `b`-`e`, `e`-`f`, `f`-`i`, `g`-`j`. Other
  anchor rows return null. Column at most 28.
- `row` (potentiometer, tmp36, servo: 3 legs; rgbLed: 4 legs): same row,
  columns `c` to `c + count - 1`. Orientation 1 (only where `flip` is true)
  reverses the leg order.
- `gap` (buzzer): legs `c` and `c + 3`, same row; orientation 1 reverses them.

`bendLegs(type, from, to)`: both valid holes, different, and either the same
row with a column distance from `minSpan` to `maxSpan`, or the same column with
a z distance (in pitches, using `rowPitchZ`) from `minSpan` to `maxSpan`. So
`16d` to `16g` (5 pitches across the channel) is fine for a resistor. Returns
`[from, to]` or null.

Tests `test/footprints.test.js`: `legsOf` for every reference part in every
circuit equals what `buildCircuit` used before; every footprint shape and
orientation; null cases (column 29 for a button, `e` down for an LED, `T-` up
from `a`); `bendLegs` spans in rows, in columns, across the channel; button
terminal holes.

## 3.3 Netlist

New pure module `src/circuits/netlist.js`.

### Building nets

```js
// normalizePin(name) -> 'GND' for 'GND', 'GND.2', 'GND.3'; otherwise name
// placeOf(hole) -> 'strip:12-top' | 'strip:12-bottom' | 'rail:T+'
// buildNetlist(circuit) -> { nets, netOf(key) }
```

- Input: `{ parts: [part], wires: [{ id, from, to }] }`. Parts may use
  reference format or `legs`. Parts with no legs (unplaced) are skipped.
- Union find over keys: `term:<id>.<terminal>`, `pin:<normalized>`,
  `strip:<n>-top|bottom`, `rail:<row>`.
- Each leg joins its terminal key to the place of its hole. A button joins
  terminal `a` to the places of legs 0 and 2, `b` to legs 1 and 3.
- Each wire joins the key of its `from` (a pin or a hole's place) with the
  place of its `to`. A pin key only exists if a wire uses it.
- A net: `{ id, terms: ['led1.anode', ...], pins: ['D13'], places: ['strip:9-top'] }`,
  each list sorted. Net ids are stable: the smallest key in the net.
- `netOf(key)` takes any of the four key forms, or a plain terminal
  (`'led1.anode'`), a plain pin (`'GND.2'`) or a hole (`'9e'`), and returns
  the net or null.

### Canonical form and comparing

- Tokens for a net: pins as their normalized name; terminals as
  `id.terminal` for polar parts, `id.*` for non polar two terminal parts
  (resistor, ldr, button, buzzer), `id.end` for potentiometer ends and
  `id.wiper` for its wiper.
- `canonical(netlist, parts, { only } = {})`: one string per net (its tokens
  sorted and joined with `,`), dropping nets with no tokens, then the list
  sorted. With `only` (an array of part ids): keep only tokens of those parts
  and drop pins.
- `compare(build, reference, { only } = {})` -> `{ match, missing, extra }`:
  multiset difference of the two canonical lists after `align`. `missing` is
  in the reference but not the build, `extra` the other way.
- `align(build, reference)` -> a copy of the build with part ids swapped
  between interchangeable parts so it matches the reference best. Parts are
  interchangeable when they have the same `interchangeKey`: resistors
  `resistor:<ohms>`, LEDs `led:<color>`, everything else `<type>`. For each
  group with 2 to 4 members in the reference, try every permutation of the
  build's ids in that group; score = how many canonical strings of the build
  also occur in the reference (multiset intersection). Keep the best score;
  ties keep the original ids. This matters for lesson 1.8 (three 220 ohm
  resistors) and P1.

### Diagnosing mistakes

```js
// diagnose(build, reference, { only } = {}) -> [{ id, text, targets }]
// targets: { parts: [ids], holes: [names], pins: [names], places: [keys] }
```

Run on the aligned build. Return every mistake found, in this priority
order; callers show the first.

| id | Found when | Text |
| --- | --- | --- |
| `short` | a net holds two different pins (after normalizing GND) | `This joins <A> straight to <B>. On a real board that is a short circuit.` List 5V, 3.3V and VIN before GND, otherwise the pin order in the net. |
| `button-gap` | a button's `a` and `b` are in one net | `Put the button across the centre gap so each side gets its own strips.` |
| `same-net` | two terminals of one part share a net and do not in the reference | two terminal parts: `Both legs of the <part> are in <place>, so the current goes round it.` More legs: `Two legs of the <part> share <place>. Give each leg its own strip.` |
| `reversed` | swapping a polar part's terminals (LED: anode and cathode; RGB LED and TMP36: reverse the leg order) makes the restricted compare match, or match more nets, and the original does not match | LED: `The LED is in backwards. Pick it up and press R to turn it round.` RGB LED: `The RGB LED is the wrong way round. Pick it up and press R to flip it.` TMP36: `5V and GND go to the wrong TMP36 legs. With its flat face towards you, the legs are +Vs, Vout and GND from left to right.` |
| `wrong-pin` | a build net with one pin P has the same other tokens as a reference net whose one pin is Q, and P is not Q | `This wire goes to <P>. The sketch uses <Q>.` |
| `no-resistor` | an LED anode or RGB colour leg shares a net with a pin other than GND, and in the reference that terminal's net has no pin | `Nothing limits the current. Put the resistor between <pin> and the <part>.` |
| `loose-wire` | a net holds a pin and nothing but places | `The wire from <P> ends in <place>, which has nothing else in it.` |
| `missing` | a reference part (within `only`, if given) is not placed | `Place the <part> from the tray.` |
| `not-joined` | any reference net has no equal build net: pick its first two tokens that sit in different build nets | `The <thing A> and the <thing B> are not joined yet.` |
| `loose` | a terminal is alone in its net (no other terminal, no pin) and is joined to something in the reference | `The <terminal label> of the <part> is not joined to anything yet.` |

`not-joined` comes before `loose` on purpose: "the resistor and the long leg of
the LED are not joined yet" helps more than "an end of the resistor is not
joined to anything".

Wording helpers (export them, the UI uses them too):

- `partLabel(part, parts)`: the type label (`LED`, `resistor` ...). When
  another part of the same type is in `parts`: resistors become
  `<formatOhms> resistor` (`220 ohm resistor`, `10 kohm resistor`), LEDs
  `<color> LED`; if still not unique, add the id (`resistor r2`).
- `thingLabel(token, parts)`: a pin stays as it is (`D13`, `GND`); a terminal
  becomes `<terminal label> of the <part>` (`long leg of the LED`); `x.*`
  becomes `<part>` (`resistor`).
- `placeLabel(key)`: `strip:9-top` -> `strip 9 (rows a to e)`,
  `strip:9-bottom` -> `strip 9 (rows f to j)`, `rail:T+` -> `the top + rail`,
  `rail:T-` -> `the top - rail`, `rail:B-` -> `the bottom - rail`,
  `rail:B+` -> `the bottom + rail`.
- `formatOhms(ohms)`: `220 ohm`, `1 kohm`, `10 kohm`.

`<part>` in the texts is `partLabel`, always after `the` where the sentence
has it. Targets: the holes of the parts and terminals involved, the pins, the
places.

## 3.4 Step rules

New pure module `src/circuits/rules.js`:

```js
// evaluateRule(rule, { build, reference }) -> boolean
```

Build the netlist from the aligned build once per call site (export a
`createRuleContext(build, reference)` that caches the aligned build, netlist
and diagnosis, and `evaluateRule(rule, ruleContext)`).

| Rule | True when |
| --- | --- |
| `{ placed: id }` | the build has part `id` with legs |
| `{ apart: [x, y] }` | both are present (part placed, or pin used by a wire) and in different nets |
| `{ allApart: id }` | part placed and each terminal in a different net |
| `{ joined: [x, y, ...] }` | one net holds every item. `id.*` means any terminal of `id`, `id.end` means `end1` or `end2`, pins are normalized |
| `{ wired: pin }` | a wire starts or ends at the pin (normalized) and its other end is a hole |
| `{ noShorts: true }` | the diagnosis has no `short` |
| `{ matches: 'all' }` | `compare(build, reference).match` |
| `{ matches: [ids] }` | `compare(build, reference, { only: ids }).match` |

Tests `test/rules.test.js`: each rule true and false on 1.2 and 1.4 builds.

## 3.5 Tests for the netlist

`test/netlist.test.js`, using every reference circuit in `circuits.js`:

- Each reference: no `short` in its own diagnosis, every terminal shares a net
  with something, `compare(ref, ref).match`.
- Shifting: for each reference, a copy with every hole moved `k` columns
  (pick a `k` per circuit that keeps all holes on the board, also try a
  negative one) still matches.
- Non polar legs swapped (resistor `from` and `to`) still match.
- `GND.2` in place of `GND` still matches.
- Through a rail: replace the 1.2 GND wire with `GND -> T-3` plus a jumper
  `T-10 -> 10a`: matches.
- 1.8 with r1 and r2 swapped (positions exchanged): matches thanks to `align`.
- Mistakes on the 1.2 reference, one test each: LED reversed -> `reversed`;
  resistor with `legs: ['9a', '9d']` (both in strip 9, rows a to e) ->
  `same-net`; wire to D12 -> `wrong-pin`; wire from
  D13 straight to `9a` with the resistor removed -> `no-resistor`; GND wire
  moved to an empty strip -> `loose-wire`; 5V wire into the GND strip ->
  `short`; LED removed -> `missing`.
- 1.4 button in rows `a`-`d` -> `button-gap`.
- 1.10 with the 5V and GND wires swapped -> `reversed` with the TMP36 text.
- `placeLabel`, `partLabel` (two resistors of different values, two of the
  same), `thingLabel`, `formatOhms`.

## Browser checks

1. Every lesson still draws its circuit and passes as before (spot check
   1.2, 1.4, 1.8, P1).
2. The breadboard shows the four rails with red and blue stripes, and holes
   along them. Nothing overlaps the Uno.
3. Top view (view buttons) shows the rails clearly.

## Acceptance criteria

- [ ] All four modules exist, are pure and fully tested.
- [ ] Every reference circuit passes its own checks.
- [ ] Every mistake type has a test and the exact text above.
- [ ] Existing tests pass; `buildCircuit` still builds every circuit.

## AGENTS.md updates

Extend "Breadboard grid and circuit tables" with rails and their names. Add a
section "Netlist and footprints" describing part types, terminals, legs,
tokens, compare, align, diagnose (with the mistake table) and rules. Add the
modules to the architecture tree.

## Decisions made while building

(Write any choice you had to make here.)
