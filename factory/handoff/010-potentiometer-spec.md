# Potentiometer, drag to turn, lessons 1.6 and 1.7

> Feature: Potentiometer part with drag to turn, and lessons 1.6 Potentiometer and 1.7 PWM fade with LED brightness from analogWrite values

## Context

Job 009 added the first part the learner touches (the push button) and lessons
1.4 and 1.5. This job adds the first part the learner turns, analog pin levels,
and LED brightness.

- Inputs: `src/sim/inputs.js` (`createInputs()`: `isPressed(id)`,
  `setPressed(id, on)`, `subscribe(fn)` firing `(id, on)` only on a real
  change). One shared instance in `src/main.js`, passed to every sim by
  `src/sim/runner.js` (`sims[id]({ pins, inputs, getValues, startedAt })`).
- Press interaction: `src/ui/partPress.js` `createPartPress({ stage, getItems, inputs })`
  raycasts visible items tagged `group.userData.pressable`, listens to
  `pointerdown` in the capture phase so it can set `stage.controls.enabled = false`
  before `OrbitControls` sees the event, captures the pointer, and releases on
  `pointerup`, `pointercancel` or `lostpointercapture`. `createHoldButton` in the
  same file is the keyboard path, appended to the code panel `toolbar` below the
  Run row and shown via `setTarget(id)` from `main.js`. Follow the same pattern;
  do not merge turning into `partPress`.
- Pins: `src/sim/pins.js` stores a level per pin name; levels are `0` and `1`
  today and `set` notifies only on a real change. Stop goes through
  `pins.reset()`.
- LED glow: `src/parts/led.js` `createLed` returns `setLit(on)` (emissive in
  the lens colour at `LIT_INTENSITY`, or none). `src/main.js` calls
  `led.setLit(level === 1)` in its `pins.subscribe` handler and
  `led.setLit(pins.get(pin) === 1)` when a circuit is built.
- Run controls: `src/ui/runControls.js` shows Run, Stop and a status line, and
  drives `runner.tick(now)` from a requestAnimationFrame loop while not idle.
  The runner (`src/sim/runner.js`) keeps the sim private.
- Circuits: `src/circuits/circuits.js` has 1.2, 1.3, 1.4, 1.5 and 1.7. 1.7 is
  `ledCircuit('D9')` (220 ohm resistor `5c` to `9c`, red LED anode `9e`
  cathode `10e`, D9 wire to `5a`, GND wire to `10a`). 1.6 has none.
  `src/circuits/buildCircuit.js` maps part `type` to a factory in
  `PART_FACTORIES` and exports `buttonHoles(at)`, the pattern for expanding a
  multi leg part from one hole.
- Lessons: `src/course/lessons.js` 1.6 and 1.7 have overview (2 paragraphs
  each), pinout, example and specs, but no `sketch`, so the code panel shows
  `example.code` with no controls and no Run row. 1.6 uses A0, 5V and GND with a
  10 kohm linear potentiometer; its example prints volts over Serial. 1.7 fades
  D9 with two `for` loops and `delay(4)`.
- Sketch helpers: `src/ui/sketch.js` (`fillSketch`, `slotValues`,
  `stepDuration`); trace steps take `ms` as a number or a range param name.
- Uno pin names `A0`, `5V`, `GND.2` exist in `UNO_PIN_NAMES`
  (`src/parts/unoBoard.js`). There is no Serial Monitor yet (Phase 3).

## Requirements

1. **Analog pin levels.** A pin level is a number from `0` to `1`: the pin
   voltage as a share of 5 V for analog inputs, and the PWM duty cycle
   (`analogWrite` value / 255) for PWM outputs. Digital levels stay `0` and `1`.
   `createPins` needs no API change; document the meaning in AGENTS.md.
2. **LED brightness.** `createLed` gains `setBrightness(b)` for `b` from 0 to 1:
   emissive in the lens colour at `LIT_INTENSITY * b`, no glow at 0.
   `setLit(on)` stays and equals `setBrightness(on ? 1 : 0)`. `main.js` drives
   LEDs with `setBrightness(level)` in both places it now calls `setLit`, so
   1.2, 1.4 and 1.5 look exactly as before.
3. **Potentiometer part.** New `src/parts/potentiometer.js`:
   `createPotentiometer({ legs })` where `legs` is three hole top positions in
   the parent frame (outer, wiper, outer), returns `{ group, setValue(v) }`.
   A body about 1 cm square (blue, like a common trimmer or panel pot), a round
   knob on top with a visible pointer mark, three legs down to the points. The
   knob turns over 270 degrees, clockwise seen from above as the value rises:
   `setValue(0.5)` points it straight ahead (towards -z), `setValue(0)` 135
   degrees anticlockwise from there, `setValue(1)` 135 degrees clockwise.
   Values are clamped to 0 to 1. Starts at 0.5. Every mesh casts shadows. The group
   carries `userData.turnable = true`.
4. **Circuit table format for a potentiometer.**
   `{ id: 'pot1', type: 'potentiometer', at: '12e' }` puts the legs at
   `12e`, `13e`, `14e` (columns `c`, `c + 1`, `c + 2`, the row of `at`; the
   middle leg is the wiper). New exported `potHoles(at)` in `buildCircuit.js`
   next to `buttonHoles`. `at` must have a column of at most 28; otherwise
   building throws naming the item, like other bad holes.
5. **Knob values in inputs.** `createInputs()` gains `getValue(id)` (0.5 when
   never set) and `setValue(id, v)` (clamped to 0 to 1). `subscribe` fires
   `(id, value)` only on a real change, the same listeners as presses (a press
   fires a boolean, a knob a number). `createHoldButton` keeps working.
6. **Turn interaction.** New `src/ui/partTurn.js`:
   `createPartTurn({ stage, getItems, inputs })`, same structure as
   `createPartPress`. Capture phase `pointerdown` with the primary button over a
   visible turnable item: disable orbit, capture the pointer, remember the start
   value and pointer y. On `pointermove` while turning: the value is the start
   value plus `(startY - clientY) / 200` (drag up 200 px for the full range),
   clamped, written with `inputs.setValue(id, v)` and the item's `setValue(v)`,
   then `stage.invalidate()`. Release on `pointerup`, `pointercancel` or lost
   capture (orbit enabled again). `cursor: ns-resize` while hovering a turnable
   item. Returns `{ setValue(id, v), release() }`; `main.js` calls `release()`
   on lesson change. A pointer down that misses every turnable item orbits as
   before.
7. **Keyboard path.** On lessons whose circuit has a potentiometer, the code
   panel toolbar shows a labelled range input "Knob", 0 to 1023 step 1, below
   the Run row (in the same place as "Hold to press"). Its value follows the
   knob both ways (drag in 3D moves the slider; the slider turns the 3D knob
   through `partTurn.setValue`), with `aria-valuetext` like `512 of 1023`.
   Arrow keys, Page Up and Page Down and Home and End work as on any range
   input. Hidden on other lessons. `main.js` sets the knob to 0.5 (inputs, part
   and slider) whenever it builds a circuit with a potentiometer.
8. **Sim readout.** A sim may return `readout()`, a short string. The runner
   gains `getReadout()`: the sim's `readout()` while running, else `''`.
   `runControls` shows it in a new line under the status (`.run-readout`, not
   an aria-live region, hidden when empty) and updates it each frame it
   changes. This stands in for the Serial Monitor until Phase 3.
9. **Lesson 1.6 Potentiometer.**
   - Circuit: potentiometer `pot1` `at: '12e'`; wires `5V` to `12a` (red),
     `A0` to `13a` (green), `GND.2` to `14a` (black).
   - Sketch: the example code, `params: []`, a trace over the four loop lines.
   - Sim `src/sim/pot.js` `createPotSim`: every update sets `A0` to
     `inputs.getValue('pot1')`. Readout: `A0 reads <raw>, <volts> V`, raw is
     `Math.round(level * 1023)`, volts to 2 decimals (`A0 reads 512, 2.50 V`).
   - Goal: since Run, update has seen raw at or below 100 and at or above 920
     (turn it to both ends). Order does not matter.
   - Third overview paragraph: press Run, then turn the knob all the way one
     way and all the way the other. Drag it up or down, or use the Knob slider.
10. **Lesson 1.7 PWM fade.**
    - Circuit: unchanged (`ledCircuit('D9')`).
    - Sketch: the example code with one range param `stepMs`, label
      "Step delay", 1 to 20 step 1, default 10, unit `ms`, in both
      `delay({{stepMs}});` lines; a trace over the two `analogWrite` and two
      `delay` lines using `stepMs` for the delay steps.
    - Sim `src/sim/fade.js` `createFadeSim`: the analogWrite value rises 0 to
      255 then falls 255 to 0, one step every `stepMs` read live from
      `getValues()`, so one full fade takes `512 * stepMs` ms. D9 level is
      value / 255. Readout: `analogWrite(9, <value>), duty <percent>%`.
      `stop()` sets D9 to 0.
    - Goal: the sim has seen one complete fade (a peak at 255 followed by the
      next return to 0, or the reverse) that took between 1000 and 3000 ms,
      with the current `stepMs` also giving a period in that range. Default 10
      (about 5.1 s) does not pass; 2 to 5 do.
    - Third overview paragraph: set the step delay so one fade up and down
      takes between 1 and 3 seconds, then press Run and watch one full fade.
11. **Registry.** `sims` gains `'1.6'` and `'1.7'`.
12. **Tests** (vitest, `test/`):
    - `inputs.test.js`: `getValue` default 0.5, set and clamp, subscribe fires
      `(id, value)` only on change.
    - `parts.test.js`: `createPotentiometer` reaches its three leg points,
      `setValue(0)`, `(0.5)` and `(1)` point the knob 135 degrees
      anticlockwise, straight ahead and 135 degrees clockwise (seen from above), values clamp, meshes cast shadows, group is turnable;
      `createLed` `setBrightness(0.5)` gives half the full emissive intensity
      and `setLit` still works.
    - `runner.test.js`: `getReadout()` is the sim readout while running and
      `''` when idle or for a sim without `readout`.
    - `pot.test.js`: A0 follows the knob; readout text; goal false after only
      one end, true after both, ends reached before Run do not count.
    - `fade.test.js`: D9 levels rise then fall with the step delay; a live
      `stepMs` change takes effect; goal false at the default 10, true at 3
      after one full fade; readout text.
    - `circuits.test.js`: keys are `1.2`, `1.3`, `1.4`, `1.5`, `1.6`, `1.7`;
      `potHoles('12e')` is `['12e', '13e', '14e']`; 1.6 wires 5V, A0 and GND.2
      to the three leg strips, one net per strip; `buildCircuit` throws naming
      the item for a pot `at` past column 28. Update `partHoles` for the new part.
    - `lessons.test.js` passes for the new sketches; 1.6 and 1.7 have three
      ASCII overview paragraphs with no exclamation marks.
13. **AGENTS.md**: add `potentiometer.js`, `partTurn.js`, `pot.js` and
    `fade.js` sims to the layout and "Present now"; document the pot part (`at`,
    three legs, middle is the wiper), analog levels from 0 to 1, LED
    `setBrightness`, inputs `getValue`/`setValue`, sim `readout()` and runner
    `getReadout()`. Keep it ASCII.
14. **README.md**: update "Where we stopped" and the job table for 010.
15. **Git**: follow "Git and pull requests" in AGENTS.md (branch from `main`,
    commit, push, pull request, merge).

## Acceptance criteria

1. `npm test` passes, including every test listed in requirement 12.
2. `npm run build` passes.
3. Dev server (`npm run dev -- --port <port> --strictPort`), `#1.6`: the
   breadboard shows a potentiometer with wires from 5V, A0 and GND.2 to its
   three columns. Run controls and a "Knob" slider are visible; the knob points
   straight ahead.
4. Dragging up on the 3D knob turns it clockwise (seen from above) and the
   slider value rises; dragging down turns it back; the camera does not rotate
   during the drag. Dragging on empty canvas still orbits.
5. Press Run. After "Running." the readout shows `A0 reads 512, 2.50 V` and
   changes as the knob turns. Turning to both ends gives "Goal met. Lesson
   done." and 1.6 is marked done in the lesson strip.
6. On a fresh profile (clear `robo-learn:progress`), 1.6 can be completed with
   the keyboard only: Tab to Run and press it, Tab to the Knob slider, press
   Home then End. The 3D knob turns with the slider.
7. `#1.7`: a "Step delay" slider reads 10 ms. Press Run: the LED fades up and
   down smoothly (visible partial brightness, not only on and off) and the
   readout shows the analogWrite value and duty. The goal does not pass at
   10 ms. Set 3 ms: after one full fade the status reads "Goal met. Lesson done."
8. `#1.2`, `#1.4`, `#1.5`: LEDs light at full brightness exactly as before;
   Blink, button and pull down goals still pass. No Knob slider on these
   lessons, and no "Hold to press" on 1.6 or 1.7.
9. Changing lesson while dragging the knob leaves the camera orbiting again.
10. AGENTS.md and README.md contain the updates in requirements 13 and 14.
11. All changed files are ASCII only (`LC_ALL=C grep -n '[^[:print:][:space:]]'`
    on them prints nothing).
12. The work is merged into `main` through a pull request, and local `main`
    matches `origin/main`.

## Out of scope

- A Serial Monitor panel or parsing `Serial.println` (Phase 3). The readout
  line is the stand in.
- Rewiring 1.7 to read the potentiometer (knob controlled brightness).
- Turning by circular drag around the knob; vertical drag only.
- Real PWM flicker, PWM frequency, or per pin PWM capability checks.
- Any change to the button, 1.4 or 1.5 beyond the `setBrightness` glue.
- Multimeter, RGB LED and later Phase 2 parts.
- Fixing the known phone width panel overlap.

## Assumptions

- Goals: 1.6 passes when A0 has read near both ends since Run; 1.7 passes on
  one full fade taking 1 to 3 s. Reason: each needs a learner action, and
  clicking Run alone must not pass. A human should confirm against the
  curriculum doc.
- Pin levels from 0 to 1 cover both analog inputs and PWM duty. Reason: one
  shared store, no new API, and LED brightness reads straight from it.
- The knob starts at the middle (0.5) on every circuit build. Reason: the
  readout shows a mid value first, and both ends need a turn.
- Vertical drag, 200 px for the full range. Reason: easy to aim with a mouse
  or a finger, and it does not depend on the camera angle.
- 1.7 default step delay 10 ms instead of the example's 4 ms. Reason: 4 ms
  would pass the goal with no change, so Run alone would complete the lesson.
- A readout line instead of a Serial Monitor. Reason: 1.6 needs to show the
  reading, and the Serial Monitor is a Phase 3 backlog item.
