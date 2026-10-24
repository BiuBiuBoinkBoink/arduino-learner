# Phase 4: Placement

## Goal

Learners build circuits by hand. The scene draws the learner's own build (held
by a workbench), not the reference table. A parts tray holds the lesson kit;
parts snap to holes with a see-through ghost, strips light up under each leg,
wires are drawn pin to hole, and everything has a keyboard path.

In this phase every lesson still opens with its whole circuit already placed
(all kit items prebuilt), so lessons work as before. An `Edit circuit` button
lets anyone pick parts up and move them. Run locks while the build does not
match the reference. Phase 5 then makes build steps drive this.

## Read first

- Phase 3 modules: `footprints.js`, `netlist.js`, `rules.js`, breadboard rails.
- `src/app/circuitView.js`, `src/circuits/buildCircuit.js`,
  `src/ui/partPress.js`, `src/ui/partTurn.js`, `src/ui/multimeter.js`
  (pointer handling and the 5 px click slop), `src/ui/viewControls.js`.

## 4.1 Kit

New pure module `src/build/kit.js`:

```js
// kitFor(lesson, reference) -> {
//   parts: [{ id, type, meta }],     // meta: every reference field except id, type and positions
//   wires: number,                   // how many wires the tray holds
//   prebuilt: { parts: [ids], wires: [ids] }
// }
```

- Parts: `lesson.kit.parts` when present (each `{ id, type, ...meta }`),
  otherwise every part of the reference, in reference order. Position fields
  (`legs`, `anode`, `cathode`, `from`, `to`, `at`) are not meta; everything else
  is (`color`, `ohms`, `pin`, `pins`, `ohmsParam`, `showWhen`).
- Wires: `lesson.kit.wires` when present, otherwise reference wire count + 2.
- Prebuilt: `lesson.prebuilt` (a list of reference part and wire ids) when
  present, otherwise **every** reference part and wire (the phase 4 default;
  phase 6 sets real lists).

Tests `test/kit.test.js`.

## 4.2 Workbench

New pure module `src/build/workbench.js`:

```js
// createWorkbench({ storage }) -> {
//   load(lessonId, { kit, reference }),
//   getBuild(),          // { parts: [{ id, type, legs, ...meta }], wires: [{ id, from, to, color }] }, a copy
//   tray(),              // { parts: [{ id, type, placed, prebuilt }], wires: { total, used } }
//   occupancy(),         // Map hole -> { kind: 'leg' | 'wire', id }
//   canPlace(id, legs),  // { ok: true } or { ok: false, reason }
//   place(id, legs),     // places or moves a kit part
//   remove(id),          // back to the tray
//   canWire(from, to),
//   addWire(from, to, color),   // returns the new id
//   removeWire(id),
//   undo(),              // returns false when there is nothing to undo
//   reset(),             // back to the prebuilt start
//   placeReference(ids), // places kit parts or wires at their reference position; false if any hole is taken
//   subscribe(fn)        // fn({ type, id }) after every change: load, place, move, remove, wire, unwire, undo, reset
// }
```

Rules:
- Only kit ids can be placed. Legs must be what `footprint` or `bendLegs`
  could produce for that type (check with a helper `legsValid(type, legs)` in
  footprints.js: same shape rules, any orientation).
- A hole takes one leg or one wire end. A pin takes one wire. Moving a part
  ignores its own current holes.
- A wire runs from a pin or hole to a hole, two different ends, and the tray
  must have a wire left.
- Reasons (exact text): `That hole is already used.`, `That part does not fit
  there.`, `Wires go from a pin or a hole to a hole.`, `A wire needs two
  different ends.`, `You have used every wire in the kit.`
- Learner wire ids are `u1`, `u2` ... (first free). Prebuilt reference wires
  keep their ids.
- Undo keeps up to 50 snapshots; load and reset clear it.
- Storage key `robo-learn:build`: `{ [lessonId]: { parts: [{ id, legs }], wires: [{ id, from, to, color }] } }`.
  Save after every change. On load, validate everything (known ids, valid
  legs, free holes, wire count) and drop what fails, keeping the rest. No
  saved record: start with the prebuilt items at their reference positions.

Tests `test/workbench.test.js`: prebuilt start; place, move, remove; occupancy
conflicts with the exact reasons; wires and the wire limit; undo; reset;
save and restore; corrupt storage; `placeReference` with a taken hole; events.

## 4.3 Wire colours

New pure module `src/build/wireColor.js`:

```js
// autoWireColor(from, build) -> 'red' | 'black' | 'yellow' | 'green' | 'blue'
```

- From a pin: `5V`, `3.3V`, `VIN` red; any GND black; `A0` to `A5` green;
  other pins yellow.
- From a hole: the colour of the first pin in that hole's net (use
  `buildNetlist`), else red for a `+` rail, black for a `-` rail, else blue.

Tests in `test/wireColor.test.js`.

## 4.4 Hole and pin picking math

- `src/parts/breadboard.js`: `nearestHole(localX, localZ, maxDistance = 0.6 * PITCH)`
  returns the nearest hole name within the distance on both axes, or null.
- `src/parts/unoBoard.js`: `nearestPin(localX, localZ, maxDistance = 0.6 * PITCH)`
  over `UNO_PIN_NAMES`, or null.
- Tests: exact hole centres, half way between holes, off the board, rails,
  pins `D13`, `GND`, `A0`.

## 4.5 Breadboard highlights

`createBreadboard()` returns more:

```js
// { group, highlightPlaces(list), clearHighlights() }
// list: [{ place: 'strip:9-top' | 'rail:T+', tone: 'hover' | 'info' | 'good' | 'bad' }]
```

- Draw each highlight as a flat translucent box just above the holes of that
  strip (5 holes) or rail (30 holes): `MeshBasicMaterial`, `transparent`,
  `depthWrite: false`. Colours: info and hover `0x2f6fd6` (opacity 0.25 and
  0.12), good `0x1d7f53` (0.25), bad `0xc0392b` (0.3). Reuse geometry; keep a
  pool so highlights do not allocate on every pointer move.
- Turn the 420 hole meshes into one `InstancedMesh` (same look) to keep the
  draw calls down.
- Callers call `stage.invalidate()` after changing highlights.

## 4.6 Circuit view draws the build

`src/app/circuitView.js` and `src/circuits/buildCircuit.js`:

- `buildCircuit(circuit, { board, breadboard, values })` uses `legsOf(part)` for
  every part, so both the reference format and `legs` work. A resistor with
  `ohmsParam` takes its ohms (and colour bands) from `values[ohmsParam]`.
- Every item group gets `userData.partId` (parts) or `userData.wireId` (wires).
- `circuitView.show(table, { fresh })`: `fresh` is true on a lesson change.
  Only fresh shows centre the knob, centre the servo and reset the room; a
  rebuild after an edit keeps them.
- The view rebuilds when the workbench changes, and when a param used as a
  resistor's `ohmsParam` changes.
- Lesson 1.3: replace the three resistors with one
  `{ id: 'r1', type: 'resistor', ohms: 220, ohmsParam: 'ohms', from: '5c', to: '9c' }`,
  and set the meter target `resistor` to `parts: ['r1']`. Update the 1.3 tests
  in `test/circuits.test.js` to match (one resistor whose bands follow the
  choice; the LED still dims). The 1.3 board does not read parts, so its goal is
  unchanged; `lessonGoals` must still pass.

## 4.7 Placement controller

New module `src/ui/placement.js` (scene and DOM, not pure):

```js
// createPlacement({ stage, board, breadboard, workbench, getValues, onChange, onHover }) -> {
//   setEnabled(on), pick(id), toggleWire(on), setWireColor(color), cancel(), rotate(),
//   moveBy(dColumn, dRow), placeAt(hole), confirm(), deleteSelected(),
//   getState()     // { mode, id, candidate: { legs, ok, reason } | null, step: 1 | 2, selectedWire }
// }
```

Modes: `idle`, `carry` (fixed shapes), `bend` (resistor, ldr: two clicks),
`wire` (two clicks, repeats until turned off).

Pointer handling on the canvas, only while enabled:
- Ray to two horizontal planes: the breadboard top and the Uno header top,
  converted to each board's local frame, then `nearestHole` / `nearestPin`.
- A click is a pointer up within 5 px of its pointer down; anything longer is
  an orbit drag and does nothing.
- `idle`: hovering a hole highlights its strip (`hover`) and shows the
  tooltip (4.9); `onHover(hole)` is called when the hovered hole changes
  (phase 6 counts strips with it). Clicking a placed part picks it up
  (`carry` or `bend` with that part, remembering its old legs). Clicking a
  wire selects it (its ends highlighted); `Delete` or `Backspace` removes it,
  `Escape` deselects.
- `carry`: the anchor is the hovered hole; legs = `footprint(type, anchor,
  orientation)`; the candidate is ok when legs exist and `canPlace` is ok. Draw
  the ghost; highlight the strips under the legs (`info`, or `bad` when not
  ok). Click places when ok, otherwise shows the reason. `R` cycles
  orientations. `Escape` puts a moved part back where it was, or a tray part
  back in the tray. `Delete` sends a carried placed part to the tray.
- `bend`: first click picks a free hole for one end; then the ghost runs from
  that end to the hovered hole (`bendLegs`); second click places. `Escape`
  first clears the first end, then cancels.
- `wire`: first click on a pin or free hole, then the ghost wire follows to
  the hovered hole; second click adds the wire (`autoWireColor`, unless a
  colour was picked). Stays in wire mode for the next wire.
- Ghosts: build the single part or wire with `buildCircuit` into a group,
  clone every material, set `transparent: true`, `opacity: 0.5`,
  `depthWrite: false`; when the candidate is not ok, lerp the colour 60%
  towards `0xc0392b`. Rebuild only when the candidate legs change. Dispose old
  ghosts.
- While enabled, the press, turn and meter clicks are off: add
  `setEnabled(on)` to `createPartPress`, `createPartTurn` and
  `createMultimeter` and switch them the other way.
- After every successful change, call `onChange()`.
- Status text, shown in the tray (exact copy):
  - idle: `Pick a part from the tray, or click a placed part to move it.`
  - carry LED: `Click a hole for the long leg. R turns it. Escape puts it back.`
  - carry other parts with more than one orientation: `Click to place. R turns it. Escape puts it back.`
  - carry with one orientation: `Click to place. Escape puts it back.`
  - bend, first end: `Click a hole for one end.`
  - bend, second end: `Click a hole for the other end.`
  - wire, first end: `Click a pin on the Uno or a hole.`
  - wire, second end: `Click a hole for the other end.`
  - selected wire: `Press Delete to remove this wire.`
  - a candidate that is not ok: its reason.

## 4.8 Parts tray

New module `src/ui/partsTray.js`:

```js
// createPartsTray({ container, workbench, placement, kitLabels }) -> { setVisible(on) }
```

- `#parts-tray`: bottom centre of the workbench (`left: 50%;
  transform: translateX(-50%); bottom: 12px`), white, 1px border, radius 12px,
  `var(--overlay-shadow)`, padding 8px, max width `calc(100% - 340px)` with a
  horizontal scroll for the items. Above the controls dock in z order.
- Row 1: a small vertical label `Parts`, then one button per kit part: a 28px
  SVG icon (simple flat drawing per type: LED dome on two legs, resistor body
  with bands, square button, round pot with a pointer, TMP36 half circle,
  servo box with an arm, RGB dome with four legs, round buzzer, LDR disc), the
  part label (`partLabel` against the whole kit, so `220 ohm resistor` only when
  needed), and a sub line `In the tray`, `Placed` or `Built earlier`
  (prebuilt and not moved). A part being carried gets the accent border.
  Clicking a tray part picks it up (placed ones too).
- Then a `Jumper wires` button with sub `3 of 4 left`; it toggles the wire
  tool (`aria-pressed`). Then `Undo` and `Reset circuit`. Reset asks in the
  page: the first click changes its text to `Click again to reset` for 3
  seconds.
- Row 2: the status line (`role="status"`), and in wire mode a select
  `Colour` with `Auto`, `Red`, `Black`, `Yellow`, `Green`, `Blue`, `Orange`,
  `White`.
- Row 3 (keyboard path, 4.10).

## 4.9 Hole tooltip

New module `src/ui/holeTooltip.js`: a small dark label (white text, 12px)
following the pointer 14px right and below, inside the workbench, showing the
hole name on the first line and `placeLabel` of its place on the second
(`9e` / `strip 9 (rows a to e)`), or the pin name for a pin. `aria-hidden`; the
keyboard path gives the same information.

## 4.10 Keyboard path

In the tray, while carrying or wiring:
- Carry: a text input `Hole` (`id="place-hole"`) and a `Place` button. Enter
  or Place moves the anchor there and confirms. A bad name shows
  `There is no hole called <text>.`
- Bend and wire: inputs `From` and `To` (`From` takes a pin name for wires).
- When focus is not in a text field and a placement is active: arrow keys move
  the anchor one column or one row, `R` turns, `Enter` places, `Escape`
  cancels. Listen on `window` but ignore events from inputs, selects and
  textareas (except Enter and Escape inside the tray inputs).
- Tray buttons are reachable with Tab in a sensible order.

## 4.11 Edit circuit mode

- Add an `Edit circuit` toggle (`aria-pressed`) to the view controls.
- On: placement enabled, tray visible, press, turn and meter off, the camera
  goes to the top view framed on the breadboard (unless the learner has
  orbited since the last view change). Off: the reverse, and the camera goes
  back to the 3D view if edit mode moved it.
- Run lock: `createRunControls` already takes `getLock`. Combine it in main.js:
  the flow's lock first, then, when the lesson has a reference circuit and
  `compare(build, reference).match` is false, `Finish the circuit to unlock Run.`
  Re-check after every workbench change. If the build stops matching while a
  sketch runs, stop the runner.

## Tests

`test/kit.test.js`, `test/workbench.test.js`, `test/wireColor.test.js`,
picking math tests, `test/circuits.test.js` updated for 1.3, a
`buildCircuit` test for `legs` and `ohmsParam`.

## Browser checks

1. Open 1.2: the circuit looks as before. Click `Edit circuit`: the camera
   moves to the top view, the tray shows `LED` (Built earlier), `resistor`
   (Built earlier) and `Jumper wires` with `2 of 4 left` (the kit has the 2
   reference wires plus 2 spare, and both reference wires are placed).
2. Hover holes: the strip under the pointer lights up and the tooltip shows
   `9e` and `strip 9 (rows a to e)`.
3. Click the LED: it lifts into a ghost. Move it over 20e: strips 20 and 21
   light up. Press R: it turns. Escape: it is back in 9e and 10e.
4. Pick the LED up and place it at 20e: Run is locked with
   `Finish the circuit to unlock Run.` Undo: it is back and Run unlocks.
5. Click the GND wire, press Delete: tray shows one more wire left. Wire tool:
   click the GND pin, then hole 10b: a black wire appears. Run: the LED blinks.
6. Keyboard: Tab to the resistor in the tray, Enter, type `5b` in From and
   `9b` in To, Enter: it moves to row b and the circuit still matches.
7. Reset circuit (two clicks): back to the start.
8. Reload: the build you left is restored.
9. 1.3: the Resistor choice changes the bands of the single resistor; the LED
   dims; measuring still works when not in edit mode.
10. Leave edit mode: the press on 1.4 and the knob on 1.6 work again.

## Acceptance criteria

- [ ] The scene always draws the workbench build.
- [ ] Placing, moving, removing parts and wires work with mouse and keyboard.
- [ ] Ghosts and strip highlights show what each leg will join.
- [ ] Run is locked while the build does not match.
- [ ] Builds survive reload; bad storage is cleaned up.
- [ ] All lessons still pass with the prebuilt circuits.

## AGENTS.md updates

New section "Workbench and placement": kit, workbench API and storage key
`robo-learn:build`, wire colours, placement modes and copy, the tray, the
keyboard path, edit mode and the run lock. Update the architecture tree and the
1.3 circuit description.

## Decisions made while building

(Write any choice you had to make here.)
