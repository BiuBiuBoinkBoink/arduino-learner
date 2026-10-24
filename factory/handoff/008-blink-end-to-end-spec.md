# Lesson 1.2 Blink end to end

> Feature: Lesson 1.2 Blink end to end: LED glow driven by the sim, on and off sliders, goal check passes when the LED blinks with a period under 500 ms

## Context

Most of the pieces exist already. This job connects them and adds the goal.

- Sim framework (job 007): `src/sim/pins.js` (`createPins()`: get, set, reset,
  subscribe; subscribers fire only on a real level change with `(name, level)`),
  `src/sim/runner.js` (`createSimRunner`: calls `onGoal(lessonId)` once per run
  the first time `sim.checkGoal()` returns true), `src/sim/sims.js` (registry,
  `'1.2': createBlinkSim`), `src/ui/runControls.js` (Run / Stop, status line,
  shows "Goal met. Lesson done." when `runner.isGoalMet()`).
- `src/sim/blink.js`: `createBlinkSim({ pins, getValues, startedAt })` drives
  `D13` HIGH for `onMs` then LOW for `offMs`, reading values live. It has no
  `checkGoal` today, and `test/blink.test.js` has a test "has no goal check"
  that asserts this.
- Sliders: lesson 1.2 in `src/course/lessons.js` already has a `sketch` with two
  range params, `onMs` ("On time") and `offMs` ("Off time"), 100 to 1000 ms,
  step 50, default 500 each. `src/ui/codePanel.js` renders them as range sliders
  and `getValues()` returns their live values. Defaults give a 1000 ms period,
  so the goal does not pass until the learner moves a slider.
- LED part: `src/parts/led.js` `createLed({ color, anode, cathode })` returns
  `{ group }` only. All lens meshes (flange, dome, cap) share one
  `MeshStandardMaterial` (`lens`). There is no way to light it. The emissive
  pattern already used in the repo is in `src/ui/boardTour.js` (sets
  `material.emissive` and `emissiveIntensity`).
- Circuit: `src/circuits/circuits.js` `ledCircuit(pin)` builds the 1.2 table
  (D13 -> 220 ohm resistor -> red LED `led1` -> GND); 1.3 and 1.7 reuse it with
  D9. `src/circuits/buildCircuit.js` returns `{ group, items }` with `items[id]`
  being the factory result (so `items.led1` is the `createLed` result).
- `src/main.js` creates one `pins`, one `runner`, and swaps the circuit group
  in `showCircuit` on every lesson change. Nothing listens to `pins` yet, so
  the LED never changes when Run is pressed. The scene renders on demand; any
  visual change needs `stage.invalidate()`.
- AGENTS.md documents the sim framework, `blink.js` ("no goal yet"),
  `led.js` and circuit table format; these lines need updating.

## Requirements

1. `createLed` returns `{ group, setLit(on) }`. `setLit(true)` makes the lens
   glow in its own colour (emissive set to the LED colour at a clearly visible
   intensity on the shared lens material); `setLit(false)` returns it to the
   unlit look (emissive black). A new LED starts unlit. Emissive only: no
   added `THREE.PointLight` or bloom.
2. LED parts in circuit tables carry the Uno pin that drives them, as a field
   `pin` (for example `{ id: 'led1', type: 'led', color: 'red', pin: 'D13', anode: '9e', cathode: '10e' }`).
   `ledCircuit(pin)` sets it, so 1.2 gets `D13`, 1.3 and 1.7 get `D9`.
   `buildCircuit` ignores the field for geometry.
3. `src/main.js` subscribes once to `pins`. On a change it calls `setLit(level === 1)`
   on every LED item in the current circuit whose part `pin` equals the changed
   pin name, then calls `stage.invalidate()`. When a circuit is built, each LED
   is set from `pins.get(part.pin)` so it starts in the right state. Lessons
   without a circuit are unaffected.
4. Stop (and a lesson change, which stops the runner) turns the LED off,
   through the existing `pins.reset()` path; no extra code path is needed.
5. `createBlinkSim` gains `checkGoal()`. It returns true once the sim has seen
   two consecutive rising edges of D13 (LOW to HIGH, as set by `update`) less
   than 500 ms apart AND the current `onMs + offMs` from `getValues()` is under
   500. The first rising edge counts from the first `update` that sets D13 HIGH
   (at `startedAt`). Edge times are the `now` values passed to `update`.
   It stays pure (no DOM, no timers).
6. With the default sliders (500 + 500) the goal never passes. With, for
   example, On 200 and Off 250 (period 450) it passes within about one period
   after the upload, the runner calls `onGoal('1.2')`, `main.js` marks lesson
   1.2 complete, and the status line shows the existing goal text.
7. The 1.2 sliders stay as they are (names, labels, range, step, defaults).
8. Lesson 1.2 tells the learner the goal: add one overview paragraph (the third
   and last allowed) in `src/course/lessons.js`, short and plain, saying to set
   the on and off times so one full blink takes less than 500 ms, then press
   Run. ASCII only, no exclamation marks.
9. Tests (vitest, in `test/`):
   - `test/blink.test.js`: replace "has no goal check" with tests that the goal
     is false before two rising edges, false with values 500/500 after many
     cycles, true with 200/250 after the second rising edge, and false when the
     values sum to 500 or more (for example 250/250).
   - `test/parts.test.js`: `createLed` exposes `setLit`; lit sets a non black
     emissive on the lens meshes, unlit sets it back to black.
   - `test/circuits.test.js`: every LED part's `pin` equals the signal pin for
     its lesson (`SIGNAL_PINS`) and is in `UNO_PIN_NAMES`.
10. AGENTS.md updated: `led.js` line mentions `setLit(on)`; `blink.js` line
    describes the goal (two rising edges under 500 ms apart and onMs + offMs
    under 500) instead of "no goal yet"; circuit table example and text mention
    the LED `pin` field; the sims section or main.js line notes that `main.js`
    lights circuit LEDs from pin levels.

## Acceptance criteria

1. `npm test` passes, including the new blink goal, LED `setLit` and circuit
   `pin` tests described in requirement 9. `test/blink.test.js` no longer
   contains a test asserting `checkGoal` is undefined.
2. `npm run build` passes.
3. Dev server (`npm run dev -- --port <port> --strictPort`), open
   `http://localhost:<port>/#1.2`. Before Run, the red LED on the breadboard is
   unlit. The code panel shows On time and Off time sliders at 500 ms.
4. Press Run with defaults. After "Uploading sketch..." (about 1.5 s) the status
   reads "Running." and the LED visibly glows red for about 0.5 s, then goes
   dark for about 0.5 s, repeating. After waiting 5 s the status still reads
   "Running." and lesson 1.2 is not marked done in the lesson strip.
5. While running, move On time to 200 and Off time to 250. The LED blinks
   faster, and within about a second the status reads "Goal met. Lesson done."
   and the lesson strip marks 1.2 as completed (progress bar moves). Reloading
   the page keeps 1.2 completed.
6. Press Stop. The LED goes dark and stays dark.
7. Change the sliders to On 250 and Off 250 (period 500), press Run on a fresh
   profile (clear localStorage key `robo-learn:progress` first). The LED blinks
   but the goal is not met after 5 s.
8. Go to lesson 1.3 (`#1.3`). Its LED is unlit and there are no Run controls.
   Go back to 1.2: the LED is unlit and status reads "Press Run to upload the sketch."
9. `src/course/lessons.js` lesson 1.2 has 3 overview paragraphs, the third
   stating the under 500 ms goal. `src/circuits/circuits.js` LED parts have a
   `pin` field. `src/parts/led.js` returns `setLit`.
10. AGENTS.md contains the updates listed in requirement 10.
11. All changed files are ASCII only (for example `grep -nP '[^\x00-\x7F]'` on
    the changed files prints nothing).

## Out of scope

- Changing slider ranges, steps or defaults, or adding new params.
- A point light, bloom, halo sprite or brightness fade on the LED; PWM
  brightness belongs to lesson 1.7.
- Lighting the on board "L" LED of the Uno model.
- A generic circuit tracer that works out which pin drives an LED from strips.
- Goal checks or sims for 1.3, 1.7 or any other lesson.
- Changes to the runner, run controls status text, upload time or pins module.
- Showing the measured period in the UI.

## Assumptions

- Period means onMs + offMs (one full on and off cycle), and "under 500 ms" is
  strict, so 250 + 250 does not pass. Reason: plain reading of "period under 500 ms".
- The goal requires the LED to actually blink (two rising edges measured under
  500 ms apart), not just slider values, and also checks the current values so
  a slider change mid cycle cannot pass the goal with a spurious short edge
  gap. Reason: the request says "when the LED blinks".
- The driving pin is stored as a `pin` field on LED parts instead of traced
  from the breadboard strips. Reason: smallest data driven change, keeps the
  glue in `main.js` trivial.
- The goal hint goes in the lesson overview because lessons have no separate
  goal field yet. Reason: learners need to know the target to pass.
- "On and off sliders" are satisfied by the existing 1.2 sketch params; no new
  UI is built. Reason: they already exist and drive the sim live.
