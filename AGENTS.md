# Robo Learn

Browser course that teaches Arduino and robotics on an interactive 3D board.
Learners wire parts on a breadboard, run code, and pass each lesson by meeting
a goal the simulator checks. Product owner: Privasi. Curriculum: 43 lessons in
5 levels (see "Curriculum" below).

## Setup

```bash
npm install
```

Node 22. Add packages with `npm install <pkg>@latest`. Never `npm update`.

## Dev server

```bash
npm run dev -- --port <port> --strictPort
```

Serves the app at `http://localhost:<port>/`. Always pass the port you were
given so parallel jobs do not collide.

## Validation

Run all of these before committing. They must pass.

```bash
npm test          # vitest, tests live in test/ as *.test.js
npm run build     # vite production build
```

There is no linter yet. Match the formatting of the file you are editing.

## Git and pull requests

Agents own the whole git workflow. Do every step yourself; do not leave
commits, pushes, pull requests or merges for a human.

1. Branch from an up to date `main`: `git checkout main`, `git pull`, then
   `git checkout -b feature/<short-name>`. Never commit straight to `main`.
2. Commit as you go: short one line messages in the style of `git log --oneline`,
   one commit per distinct piece of work, explicit paths (never `git add -A`).
   Run the validation commands first; they must pass.
3. Push the branch (`git push -u origin <branch>`) and open a pull request into
   `main` with `gh pr create`. The description says what changed, what to check
   and how it was tested, including anything not verified.
4. Merge it yourself once validation passes and the work meets its spec:
   `gh pr merge <number> --merge --delete-branch`. Then `git checkout main`,
   `git pull`, and delete the local branch.
5. Leave the tree clean and `main` in sync with `origin/main` when you finish.

Never force push, rewrite pushed history or skip hooks. If a merge conflicts or
`main` moved, merge `main` into the branch, validate again, then push.

## Stack

- Vite, vanilla JavaScript ES modules. No UI framework.
- three.js for the 3D scene. No other 3D or physics library unless a spec asks for one.
- Vitest for tests. Put pure logic (course state, sims, kinematics, code runner)
  in modules with no DOM or WebGL access, so it can be unit tested.

## Architecture (target layout)

Present now: `src/main.js`, `src/scene/stage.js`, `src/scene/renderLoop.js`,
`src/ui/panels.js`, `src/style.css`, `src/course/lessons.js`, `src/course/state.js`,
`src/course/hash.js`, `src/ui/lessonStrip.js`, `src/ui/infoPanel.js`,
`src/ui/codePanel.js`, `src/ui/tabKeys.js`, `src/ui/highlight.js`, `src/ui/sketch.js`, `src/parts/unoBoard.js`, `src/sim/tour.js`,
`src/ui/boardTour.js`, `src/parts/breadboard.js`, `src/parts/led.js`, `src/parts/resistor.js`,
`src/parts/wire.js`, `src/circuits/circuits.js`, `src/circuits/buildCircuit.js`, `src/sim/pins.js`,
`src/sim/sims.js`, `src/sim/blink.js`, `src/sim/runner.js`, `src/ui/runControls.js`,
`src/parts/button.js`, `src/sim/inputs.js`, `src/sim/button.js`, `src/sim/pullDown.js`,
`src/ui/partPress.js`, `src/parts/potentiometer.js`, `src/ui/partTurn.js`, `src/sim/pot.js`,
`src/sim/fade.js`, `src/sim/ohm.js`, `src/sim/ohms.js`, `src/ui/multimeter.js`, `src/parts/rgbLed.js`, `src/sim/rgb.js`. The other
folders are the target for later jobs.

```
src/
  main.js          boot: builds the scene, adds the Uno board and breadboard to it, UI and course engine;
                   swaps the circuit group on every lesson change; lights circuit LEDs from pin levels
  style.css        full viewport layout: stage behind, panels on the edges
  course/          lessons data, state, goTo(id), progress
                   createCourse({ lessons, storage }): goTo, next, prev, markComplete, subscribe; hash #<lesson id>; progress key robo-learn:progress
    lessons.js     lesson objects: id, level, title, summary, plus info tab content:
                   overview (1 to 3 paragraph strings), pinout ([{ pin, use }]),
                   example ({ code, note }), specs ([{ label, value }]); optional
                   tour ([{ zone, label, text }], one entry per UNO_ZONE_IDS id, lesson 1.1 only);
                   optional sketch ({ code, params, trace }, 1.2 to 1.7 now): code is a template with
                   {{name}} slots; params are range ({ name, label, min, max, step, value, unit? }) or
                   choice ({ name, label, value, options: [{ value, label, code? }] }, an option code is the
                   text its slot shows instead of the value); trace is a looping list
                   of { line (1 based), ms (number or a range param name) }
  scene/           renderer, camera, lights, render loop
    stage.js       renderer, camera, orbit controls, lights, ground (no placeholder); returns invalidate()
    renderLoop.js  pure render on demand loop (dirty flag, one frame per invalidate burst)
  parts/           one module per procedural 3D part (board, led, resistor, wire...)
    unoBoard.js    createUnoBoard() -> { group, zones }, 1 unit = 1 cm; UNO_ZONE_IDS for the six clickable zones;
                   PITCH (0.254); UNO_PIN_NAMES and unoPinPosition(name) -> board local Vector3 at the hole top
    breadboard.js  createBreadboard() -> { group }, half size, 30 columns, no rails; BREADBOARD_COLUMNS,
                   BREADBOARD_ROWS, parseHole('12e'), holePosition(hole) local Vector3, holeStrip(hole)
    led.js         createLed({ color, anode, cathode }) -> { group, setLit(on), setBrightness(b) }; red, green, yellow,
                   blue; anode leg kinked; setBrightness(b) for b from 0 to 1 glows the lens in its own colour
                   (emissive only) at LIT_INTENSITY * b, none at 0; setLit(on) is setBrightness(on ? 1 : 0);
                   new LEDs start unlit
    rgbLed.js      createRgbLed({ legs }) -> { group, setColor(r, g, b) }; common cathode, four legs in a row
                   (red, cathode, green, blue); channels 0 to 1 mix as sRGB into the lens glow and tint
    resistor.js    resistorBands(ohms) -> 4 colour names; createResistor({ ohms, from, to }) -> { group }
    button.js      createButton({ legs }) -> { group, setPressed(on) }; 4 leg tactile switch, legs are four
                   hole tops; setPressed lowers the cap 0.05 cm; group.userData.pressable = true
    potentiometer.js createPotentiometer({ legs }) -> { group, setValue(v) }; blue 1 cm body on three legs (outer,
                   wiper, outer), knob with a pointer mark; setValue clamps to 0 to 1 and turns the knob over
                   270 degrees, clockwise from above as v rises, 0.5 straight ahead (-z); starts at 0.5;
                   group.userData.turnable = true
    wire.js        WIRE_COLORS, wireCurve(from, to) vertical ended Bezier arch, createWire({ color, from, to }) -> { group, curve }
  circuits/        per lesson circuit tables: which parts sit where on the breadboard
    circuits.js    circuits keyed by lesson id (1.2 to 1.8 now); plain data, no three.js
    buildCircuit.js buildCircuit(circuit, { board, breadboard }) -> { group, items }; pins and holes
                   to world positions, one factory result per id, item group name = id;
                   buttonHoles(at) -> the four button leg holes; potHoles(at) -> the three pot leg holes;
                   rgbHoles(at) -> the four RGB LED leg holes
  sim/             per lesson simulators, pin levels, goal checks
    tour.js        pure createTour(zoneIds): open, isOpened, openedCount, total, isComplete (lesson 1.1 goal)
    pins.js        pure createPins(): get(name), set(name, level), reset(), subscribe(fn); shared pin levels
    inputs.js      pure createInputs(): isPressed(id), setPressed(id, on), getValue(id), setValue(id, v),
                   getProbe(), setProbe(id), subscribe(fn); held buttons and knob values (0 to 1, 0.5 when
                   never set) by part id, and the meter probe target id (null when unset, never notified)
    sims.js        sims registry: lesson id -> sim factory ('1.2' to '1.8' now)
    rgb.js         pure createRgbSim (1.8): red, green, blue params (live) on D9, D10, D11 as value / 255; readout
                   'Now r, g, b. Target orange 255, 128, 0'; goal is every channel within 25 of TARGET since Run
    ohm.js         pure LED_SUPPLY_V (5), LED_FORWARD_V (2), ledCurrentMa(ohms) = 3 / R in mA,
                   ledBrightness(ohms) relative to 220 ohm, clamped to 0 to 1
    ohms.js        pure createOhmsSim (1.3): D9 HIGH; readout 'Meter on <label>: <mA> mA' for the probe in
                   METER_LABELS (led, resistor); goal is a probed reading with each of 220, 1000 and 10000 ohm
    blink.js       pure createBlinkSim: D13 HIGH for onMs, LOW for offMs from startedAt; checkGoal passes when
                   the last two rising edges of D13 were under 500 ms apart and onMs + offMs is under 500
    button.js      pure createButtonSim (1.4): internal pull up, D2 reads 0 while btn1 is held, D13 follows the
                   press; goal is 3 full presses seen since Run
    pullDown.js    pure createPullDownSim (1.5): btn1 to 5V, released reads 0 with pull 'down', floats (random
                   level every 40 to 160 ms, injectable random) with 'none'; D13 copies D2; goal is 3 full
                   presses while fitted, removing the pull down resets the count
    pot.js         pure createPotSim (1.6): A0 follows the pot1 knob; readout 'A0 reads <raw>, <volts> V'; goal is
                   A0 read at or below 100 and at or above 920 since Run, any order
    fade.js        pure createFadeSim (1.7): analogWrite value 0 to 255 then 255 to 0, one step every stepMs (live),
                   D9 level value / 255; readout 'analogWrite(9, <value>), duty <percent>%'; goal is one full
                   fade (512 steps) seen taking 1000 to 3000 ms with the current stepMs also in range
    runner.js      pure createSimRunner({ sims, pins, inputs, onGoal, uploadMs }): hasSim, run, tick(now), stop,
                   getPhase (idle, uploading, running), isGoalMet, getReadout (sim readout() while running,
                   else ''); UPLOAD_MS fake upload (1500)
  runner/          code runner for learner code (Level 2 onward)
  ui/              panels: lesson strip, info tabs, code panel, params, serial monitor
    panels.js      panel elements: #info-panel (left), #code-panel (right), #lesson-strip (bottom), filled by infoPanel, codePanel, lessonStrip
    infoPanel.js   lesson heading plus Overview, Pinout, Example, Specs tabs rendered from lesson data;
                   WAI-ARIA tabs with roving tabindex, arrow, Home and End keys; selected tab kept across lessons
    codePanel.js   Code heading, lesson line, param controls (range sliders with value text, choice
                   radio fieldsets) and the sketch coloured per line; controls refill the slots live,
                   values reset on lesson change; the trace loops an is-active line highlight on timers;
                   lessons without a sketch show coloured example.code, no controls, no trace;
                   returns { toolbar, getValues, subscribe }: an empty slot after the lesson line, a copy of
                   the values, and subscribe(fn) calling fn(values) on every control change and lesson change
    runControls.js Run and Stop buttons plus status line in the code panel toolbar; hidden on lessons
                   without a sim; rAF loop calls runner.tick while not idle; stops the runner on lesson change;
                   .run-readout line under the status shows runner.getReadout(), hidden when empty
    partPress.js   createPartPress({ stage, getItems, inputs }) -> { press(id), release(), isPressed() }: raycast
                   press and release on visible pressable circuit items, orbit off while held, pointer cursor
                   on hover; createHoldButton({ container, partPress, inputs }) -> { setTarget(id) }, the
                   "Hold to press" keyboard path below the Run row, aria-pressed follows inputs
    partTurn.js    createPartTurn({ stage, getItems, inputs }) -> { setValue(id, v), release() }: vertical drag on
                   visible turnable circuit items (200 px for the full range), orbit off while turning, ns-resize
                   cursor on hover; createKnobSlider({ container, partTurn, inputs }) -> { setTarget(id) }, the
                   "Knob" range input (0 to 1023) below the Run row, following the knob both ways
    multimeter.js  createMultimeter({ container, stage, getItems, inputs }) -> { setTargets(targets) }: "Meter on"
                   select below the Run row and click to probe a visible part of a target (a pointer up within
                   5 px of its down); both write inputs.setProbe(id); hidden with no targets
    tabKeys.js     pure nextTabIndex(key, current, count) for the tab keyboard logic
    highlight.js   pure tokenize(code) -> [{ type, text }] for Arduino C++ colouring (tok-<type> classes)
    sketch.js      pure defaultValues(params), slotValues(params, values), fillSketch(code, values), stepDuration(step, values),
                   traceStepAt(trace, values, elapsedMs)
    boardTour.js   board hover labels, zone clicks and tour card checklist for lessons with a tour; marks 1.1 done
test/              vitest unit tests
```

Data flows one way: lesson data -> circuit table -> scene parts; Run -> sim ->
pin levels -> parts update -> goal check -> progress. Only `goTo(id)` changes
the current lesson, and every panel updates from it.

## Breadboard grid and circuit tables

- Holes are strings of column number plus row letter, like `'12e'`. 30 columns,
  column 1 on the left (-x), column 30 on the right (+x). Row `a` is on the far
  side (-z, towards the Uno digital headers), row `j` on the near side.
- Rows are one pitch (0.254 cm) apart, with a centre channel so `e` to `f` is
  three pitches. Holes `a` to `e` of one column share a strip (`'12-top'`),
  `f` to `j` another (`'12-bottom'`). No power rails.
- Uno pins use `unoPinPosition(name)`. Names follow the R3 header order:
  `SCL`, `SDA`, `AREF`, `GND`, `D13` to `D8`; `D7` to `D0`; `NC`, `IOREF`,
  `RESET`, `3.3V`, `5V`, `GND.2`, `GND.3`, `VIN`; `A0` to `A5`. Plain `GND` is
  the ground next to `AREF` and `D13`.
- A circuit table is plain data:

  ```js
  {
    parts: [
      { id: 'r1', type: 'resistor', ohms: 220, from: '5c', to: '9c' },
      { id: 'led1', type: 'led', color: 'red', pin: 'D13', anode: '9e', cathode: '10e' }
    ],
    wires: [
      { id: 'w1', color: 'yellow', from: 'D13', to: '5a' }
    ]
  }
  ```

  Part positions are holes. Wire `from` is an Uno pin name, `to` a hole.
  LED parts carry `pin`, the Uno pin that drives them; `buildCircuit` ignores it
  for geometry and `main.js` uses it to light the LED.
  Ids are unique within a circuit.
- A push button is `{ id: 'btn1', type: 'button', at: '12e' }`. Its four legs go
  in columns `c` and `c + 2` of `at`, rows `e` and `f` (`12e`, `14e`, `12f`,
  `14f`), straddling the centre channel. `at` must be in row `e` with a column of
  at most 28. Facing legs are always joined, so column 12 top and bottom are one
  node, same for 14; pressing joins column 12 to column 14.
- A potentiometer is `{ id: 'pot1', type: 'potentiometer', at: '12e' }`. Its three
  legs go in columns `c`, `c + 1` and `c + 2` of the row of `at` (`12e`, `13e`,
  `14e`); the middle leg is the wiper. `at` must have a column of at most 28.
  `main.js` sets its knob to 0.5 whenever it builds a circuit with one, and shows
  the Knob slider only on those lessons.
- An RGB LED is `{ id: 'rgb1', type: 'rgbLed', at: '14e', pins: { red, green, blue } }`.
  Its legs go in columns `c` to `c + 3` of the row of `at`: red, cathode, green,
  blue. `at` must have a column of at most 27. `main.js` sets its colour from the
  three pin levels.
- An LED may carry `ohmsParam`, the code panel param holding its series
  resistor in ohms. `main.js` then lights it at the pin level times
  `ledBrightness(ohms)`, and re-lights LEDs on every param change.
- A circuit may list `meter: [{ id, label, parts }]`, the multimeter targets.
  Clicking any listed part probes its target id; `main.js` passes the list to
  `multimeter.setTargets` on every circuit build.
- Any part may carry `showWhen: { param, value }`. `main.js` draws it only while
  that code panel param has that value (through the code panel `subscribe`).
  Hidden parts are not pressable.
- `main.js` places the Uno left and the breadboard right, 1 cm apart, centred on
  x = 0. On every lesson change it removes and disposes the old circuit group,
  builds `circuits[lesson.id]` if there is one, and calls `invalidate()`. A held
  button is released first.

## Sims and goal checks

- A lesson sim is made by a factory `create({ pins, inputs, getValues, startedAt })` and
  returns `{ update(now), stop(), checkGoal? }`. `now` and `startedAt` are ms on
  the same clock. `getValues()` gives the live code panel param values.
- `src/sim/sims.js` exports `sims`, keyed by lesson id. Lessons without an entry
  have no Run controls.
- Pin levels live in one shared `createPins()`: a number from `0` to `1`, unset
  pins read `0`. Digital pins use `0` (LOW) and `1` (HIGH). An analog input is its
  voltage as a share of 5 V; a PWM output is its duty cycle, the `analogWrite`
  value / 255. Stop resets every pin to `0`.
- A sim may return `readout()`, a short string. The runner `getReadout()` gives it
  while running, else `''`, and `runControls` shows it under the status. It stands
  in for the Serial Monitor until Phase 3.
- Run starts a fake upload of `UPLOAD_MS` (1500 ms), then the runner creates the
  sim and calls `update(now)` every tick.
- A lesson is marked done only by `onGoal(lessonId)`, which the runner calls once
  per run when `checkGoal()` first returns true. A sim without `checkGoal` never
  completes its lesson. The runner never calls `markComplete` itself; `main.js`
  passes `onGoal: (id) => course.markComplete(id)`.
- `main.js` subscribes once to `pins`. On a change it calls `setBrightness(level)`
  on every LED in the current circuit whose `pin` matches, then `invalidate()`.
  A newly built circuit sets each LED from `pins.get(part.pin)`. Stop goes
  through `pins.reset()`, so it turns the LEDs off.
- `inputs` is one shared `createInputs()` of held buttons, set by `partPress`,
  and knob values from 0 to 1, set by `partTurn` and the Knob slider. Sims read it
  with `inputs.isPressed(id)` and `inputs.getValue(id)`. `subscribe` fires
  `(id, on)` for a press and `(id, value)` for a knob, only on a real change.
  Stop does not reset it, so a held button stays held until released.

## Conventions

- All 3D parts are built procedurally from three.js geometry. No model files.
- Render on demand: redraw only when something changed (a dirty flag), not every frame.
- Any scene change (add, move or remove a part) must call the stage `invalidate()` to redraw.
  Soft shadows use `PCFShadowMap` plus `shadow.radius`, because `PCFSoftShadowMap` is removed in three 0.186.
- Lesson content (text, code, circuits) is data in `src/course/` and `src/circuits/`,
  never hard coded in UI modules.
- Breadboard positions use a grid helper, column number plus row letter (`a` to `j`).
- Progress and settings persist in localStorage under keys prefixed `robo-learn:`.
  Wrap every localStorage access in try/catch.
- All files ASCII only: no curly quotes, arrows or special symbols. Write ohm, deg C.
- UI copy: short sentences, plain words, no emoji, no exclamation marks.
- All content and code must be original. The project took inspiration from
  learn-arduino-red.vercel.app; never copy its code, text, layout or visuals.

## Curriculum

Levels: 1 Basics (12 lessons), 2 Programming properly (8), 3 Communication (8),
4 Robot hardware (8), 5 Beyond the Uno (7). Each level ends in a project. Every
lesson has a goal check, so finishing means meeting the goal, not clicking Run.
The full list with parts and goal checks lives in the Privasi curriculum doc.
