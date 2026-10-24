# Push button, press interaction, lessons 1.4 and 1.5

> Feature: Scene interaction: raycast press and release on parts, and a push button part, with lessons 1.4 Button input and 1.5 Pull up vs pull down including a floating pin effect

## Context

Job 008 finished Lesson 1.2 end to end. This job adds the first part the learner
touches, and two lessons that use it.

- Sim framework: `src/sim/pins.js` (`createPins()`: get, set, reset,
  subscribe; subscribers fire only on a real change), `src/sim/runner.js`
  (`createSimRunner({ sims, pins, onGoal, uploadMs })`; it builds the sim with
  `sims[id]({ pins, getValues, startedAt })` and calls `onGoal(id)` once per run
  the first time `checkGoal()` is true), `src/sim/sims.js` (registry, only
  `'1.2'` now), `src/sim/blink.js` (the pattern to follow for a pure sim with a
  goal), `src/ui/runControls.js` (Run / Stop row, hidden when
  `runner.hasSim(id)` is false).
- LED lighting from pins is already done in `src/main.js`: it subscribes to
  `pins` and calls `setLit(level === 1)` on every circuit LED whose part `pin`
  matches. A new LED on D13 in a 1.4 or 1.5 circuit lights with no new glue.
- Raycasting: `src/ui/boardTour.js` already raycasts the canvas
  (`THREE.Raycaster`, pointer to NDC from `getBoundingClientRect`, walk up
  `parent` to find a tagged object via `userData`, `CLICK_SLOP` to tell a click
  from an orbit drag). It is only active on lessons with a `tour` (1.1). Reuse
  the same approach; do not merge the two modules.
- Orbit: `src/scene/stage.js` returns `controls` (`OrbitControls`). A pointer
  drag on the canvas rotates the camera today.
- Parts: `src/parts/led.js`, `src/parts/resistor.js`, `src/parts/wire.js` are
  procedural, take hole positions in the parent frame and return `{ group }`
  (LED also `setLit`). `src/circuits/buildCircuit.js` maps part `type` to a
  factory in `PART_FACTORIES` and returns `{ group, items }` with
  `items[id]` the factory result and `item.group.name = id`.
- Breadboard: `src/parts/breadboard.js` (`parseHole`, `holePosition`,
  `holeStrip`). Holes `a` to `e` of a column share a strip, `f` to `j` another;
  the centre channel sits between `e` and `f`.
- Circuits: `src/circuits/circuits.js` has 1.2, 1.3, 1.7 (`ledCircuit(pin)`).
  1.4 and 1.5 have none. `test/circuits.test.js` asserts the key list is exactly
  `['1.2', '1.3', '1.7']`, has `partHoles(part)` that only knows LEDs and two
  leg parts, and a `SIGNAL_PINS` map.
- Lessons: `src/course/lessons.js` lessons 1.4 and 1.5 have overview, pinout,
  example and specs but no `sketch`, so the code panel shows `example.code`
  with no controls and no Run row. 1.4 uses the internal pull up on D2 and D13
  for the LED. 1.5 uses a 10 kohm external pull down on D2, the button to 5V,
  and D13 for the LED. Each has 2 overview paragraphs (max 3).
- Code panel: `src/ui/codePanel.js` returns `{ toolbar, getValues }`. Choice
  params already render as radio fieldsets (1.3 uses one). There is no change
  notification; `getValues()` is a copy read on demand.
- Uno pins for wires: `GND`, `GND.2`, `GND.3`, `5V` all exist in
  `UNO_PIN_NAMES`.

## Requirements

1. **Push button part.** New `src/parts/button.js`:
   `createButton({ legs })` where `legs` is four hole top positions in the
   parent frame, returns `{ group, setPressed(on) }`. A square tactile switch
   body (about 0.6 cm square, dark), a round cap on top, four short legs down
   to the given points. `setPressed(true)` moves the cap down visibly (about
   0.05 cm); `setPressed(false)` returns it. Starts released. Every mesh casts
   shadows. The group (or a child the raycast can find) carries
   `userData.pressable = true`.
2. **Circuit table format for a button.** A part
   `{ id: 'btn1', type: 'button', at: '12e' }` places the four legs at columns
   `c` and `c + 2` of `at`, rows `e` and `f`, so it straddles the centre
   channel (`12e`, `14e`, `12f`, `14f`). Legs that face each other across the
   channel are always joined (column 12 top and bottom strips are one node,
   same for 14); pressing joins column 12 to column 14. `buildCircuit` gains a
   `button` entry in `PART_FACTORIES`. `at` must have row `e` and a column of
   at most 28; otherwise building throws naming the item, like other bad holes.
3. **Inputs store.** New pure `src/sim/inputs.js`: `createInputs()` with
   `isPressed(id)` (false by default), `setPressed(id, on)`, `subscribe(fn)`
   (fires `(id, on)` only on a real change). One shared instance in `main.js`.
4. **Runner passes inputs.** `createSimRunner({ sims, pins, inputs, onGoal, uploadMs })`
   passes `inputs` into the sim factory: `sims[id]({ pins, inputs, getValues, startedAt })`.
   Existing sims ignore it. Nothing else in the runner changes. Stop does not
   reset inputs (a held button stays held).
5. **Press interaction.** New `src/ui/partPress.js`:
   `createPartPress({ stage, getItems, inputs })`, where `getItems()` returns the
   current circuit `items` (or null). On canvas `pointerdown` with the primary
   button over a pressable item: call `inputs.setPressed(id, true)` and the
   item's `setPressed(true)`, set `stage.controls.enabled = false` so the
   camera does not orbit, capture the pointer, and `stage.invalidate()`. On
   `pointerup`, `pointercancel` or lost capture: release (inputs false, item
   `setPressed(false)`, controls enabled again, invalidate). Hovering a
   pressable item shows `cursor: pointer`. A lesson change while pressed
   releases first. A pointer down that misses every pressable item orbits as
   before. Works on lessons 1.4 and 1.5; no effect where there is no button.
6. **Keyboard path.** On lessons whose circuit has a button, the code panel
   toolbar shows one more DOM button, label "Hold to press", below the Run row.
   It presses the circuit button while the pointer is held on it or while
   Space or Enter is held with it focused, and releases on up, blur or leave.
   It sets `aria-pressed` to match. Hidden on other lessons. It goes through
   the same `inputs` and `setPressed` path as the 3D press.
7. **Lesson 1.4 Button input.**
   - Circuit: D2 wire to `12a`, button `at: '12e'`, `GND.2` wire to `14j`;
     LED part with `pin: 'D13'` and a 220 ohm resistor wired like
     `ledCircuit` but in columns 20 to 25 (for example resistor `20c` to `24c`,
     LED anode `24e`, cathode `25e`, D13 wire to `20a`, GND wire to `25a`).
     No strip may hold connections from two different nets.
   - Sketch: `sketch` with the example code (no params, `params: []`) and a
     trace over the two loop lines.
   - Sim `src/sim/button.js` `createButtonSim`: every update sets D2 to
     `0` when `inputs.isPressed('btn1')`, else `1` (internal pull up), and D13
     to `1` when pressed, else `0`. `stop()` sets D13 to 0.
   - Goal: three full presses (press then release) seen by `update` while
     running. The count starts at Run, so presses before Run do not count.
   - Third overview paragraph: press and release the button three times while
     the sketch runs. Plain words, ASCII, no exclamation marks.
8. **Lesson 1.5 Pull up vs pull down, floating pin.**
   - Circuit: D2 wire to `12a`, 10 kohm resistor `r2` from `12c` to `8c`,
     `GND.2` wire to `8a`, button `at: '12e'`, `5V` wire to `14j`, plus the
     same D13 LED and 220 ohm resistor as 1.4 in columns 20 to 25 with `GND`.
   - Sketch: the example code with one choice param `pull`, label
     "Pull down resistor", options `down` ("Fitted") and `none`
     ("Removed"), default `down`. The `pinMode` comment line uses a slot so the
     code reads `// external 10 kohm pull down` or `// nothing on the pin, it floats`.
   - The `r2` resistor is visible only when `pull` is `down`. Circuit parts
     may carry `showWhen: { param: 'pull', value: 'down' }`; `codePanel` gains a
     `subscribe(fn)` that fires with the values on every control change and on
     lesson change; `main.js` sets `items[id].group.visible` from it and calls
     `stage.invalidate()`. Hidden parts are not pressable.
   - Sim `src/sim/pullDown.js` `createPullDownSim({ pins, inputs, getValues, startedAt, random = Math.random })`:
     pressed reads `1` (button to 5V). Released with `pull: 'down'` reads `0`.
     Released with `pull: 'none'` floats: D2 changes to a random level at
     random intervals between 40 and 160 ms (drawn from `random`), so the LED
     flickers. D13 copies D2. `stop()` sets D13 to 0.
   - Goal: three full presses counted only while `pull` is `down`, with D2
     never floating during them. Switching to `none` resets the count to 0.
   - Third overview paragraph: remove the resistor to see the pin float, then
     fit it again and press the button three times while running.
9. **Registry.** `sims` gains `'1.4'` and `'1.5'`.
10. **Tests** (vitest, `test/`):
    - `inputs.test.js`: default false, set and get, subscribe fires only on change.
    - `runner.test.js`: the sim factory receives `inputs`.
    - `button.test.js` (sim): D2 and D13 levels pressed and released; goal false
      after 2 presses, true after 3; presses before the first `update` do not
      count; a press held without release does not count.
    - `pullDown.test.js`: pressed reads 1, released with `down` reads 0;
      with `none` and a seeded `random` D2 changes over time; goal true after
      3 presses with `down`; switching to `none` mid way resets the count.
    - `parts.test.js`: `createButton` reaches down to its leg points,
      `setPressed(true)` lowers the cap and `false` restores it, meshes cast
      shadows, group is pressable.
    - `circuits.test.js`: keys are `1.2`, `1.3`, `1.4`, `1.5`, `1.7`; button
      legs expand to the right four holes; no strip in 1.4 or 1.5 holds two
      nets (treat the button's facing legs as one node); every LED has a
      valid `pin`; `buildCircuit` throws naming the item for a button `at` not
      in row `e` or past column 28. Update `partHoles` and `SIGNAL_PINS` for the
      new part and lessons.
    - `lessons.test.js` passes for the new sketches (slots match params).
11. **AGENTS.md**: add `button.js`, `inputs.js`, `button.js` sim, `pullDown.js`
    sim and `partPress.js` to the layout and "Present now" list; document the
    `button` part (`at`, four legs, facing legs joined) and `showWhen` in the
    circuit table section; note that sims receive `inputs`; note the
    `codePanel` `subscribe`. Keep it ASCII.
12. **README.md**: update "Where we stopped" and the job table for 009.

## Acceptance criteria

1. `npm test` passes, including every test listed in requirement 10.
2. `npm run build` passes.
3. Dev server (`npm run dev -- --port <port> --strictPort`), `#1.4`: the
   breadboard shows a push button straddling the centre channel, wires from D2
   and GND.2 to its columns, and the LED circuit on D13. Run controls and a
   "Hold to press" button are visible.
4. Before Run, pressing the 3D button moves its cap down while held and back up
   on release; the camera does not rotate during the press. The LED stays dark
   (no sketch running).
5. Press Run. After "Running." the LED lights while the 3D button is held and
   goes dark on release. After three press and release cycles the status reads
   "Goal met. Lesson done." and 1.4 is marked done in the lesson strip.
6. On a fresh profile (clear `robo-learn:progress`), 1.4 can also be completed
   with the keyboard only: Tab to "Hold to press", hold Space three times. The
   3D cap moves with it and `aria-pressed` toggles.
7. Dragging on empty canvas still orbits the camera on 1.4 and 1.5.
8. `#1.5`: the 10 kohm resistor is drawn by default and the "Pull down
   resistor" choice reads Fitted. Choose Removed: the resistor disappears and
   the code comment changes. Press Run: with the button released the LED
   flickers irregularly. Hold the button: the LED stays on.
9. Still on 1.5, choose Fitted while running: the LED stays dark until pressed.
   Three presses give "Goal met. Lesson done." Presses made while Removed did
   not count.
10. Pressing and holding, then pressing Stop, then releasing leaves no part
    stuck pressed and the camera orbits again. Changing lesson while holding
    the button does the same.
11. `#1.2`, `#1.3`, `#1.7`: no "Hold to press" button, and Blink still works as
    in job 008.
12. AGENTS.md and README.md contain the updates in requirements 11 and 12.
13. All changed files are ASCII only (`LC_ALL=C grep -n '[^[:print:][:space:]]'`
    on them prints nothing).

## Out of scope

- Bouncy button behaviour (backlog Phase 3, lesson 2.6).
- Any change to the 1.2, 1.3 or 1.7 circuits or sims beyond what the runner
  `inputs` argument needs.
- A generic electrical net solver. The sims read `inputs` directly; the
  circuit tables only need to be drawn correctly.
- Clicking or dragging any part other than the button (potentiometer is the
  next job).
- A switch between internal pull up and external pull down in 1.5 (only
  fitted or removed).
- Lighting the on board "L" LED.
- Fixing the known phone width panel overlap.

## Assumptions

- Goals for 1.4 and 1.5 are "three clean presses while running" (and for 1.5,
  with the pull down fitted). Reason: the curriculum doc is not in the repo;
  this is the simplest check that proves the button was read. A human should
  confirm against the curriculum doc.
- Pressing works before Run, but only the sim reads it, so the LED reacts only
  while running. Reason: matches a real board, where nothing happens with no
  sketch uploaded.
- The floating effect is random levels at 40 to 160 ms. Reason: visibly
  irregular flicker that is clearly not a steady blink.
- The 1.5 resistor is hidden rather than the circuit rebuilt. Reason: smallest
  change that keeps the scene consistent with the choice.
- The button sits at columns 12 and 14 and the LED circuit at columns 20 to
  25. Reason: leaves room on the half size breadboard and keeps the nets apart.
- A separate `inputs` store instead of reusing `pins`. Reason: a pressed button
  is not a pin level; the pin level depends on the pull resistor, which is the
  point of lesson 1.5.
