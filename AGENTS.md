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
`src/sim/sims.js`, `src/sim/blink.js`, `src/sim/runner.js`, `src/ui/runControls.js`. The other
folders are the target for later jobs.

```
src/
  main.js          boot: builds the scene, adds the Uno board and breadboard to it, UI and course engine;
                   swaps the circuit group on every lesson change
  style.css        full viewport layout: stage behind, panels on the edges
  course/          lessons data, state, goTo(id), progress
                   createCourse({ lessons, storage }): goTo, next, prev, markComplete, subscribe; hash #<lesson id>; progress key robo-learn:progress
    lessons.js     lesson objects: id, level, title, summary, plus info tab content:
                   overview (1 to 3 paragraph strings), pinout ([{ pin, use }]),
                   example ({ code, note }), specs ([{ label, value }]); optional
                   tour ([{ zone, label, text }], one entry per UNO_ZONE_IDS id, lesson 1.1 only);
                   optional sketch ({ code, params, trace }, 1.2 and 1.3 now): code is a template with
                   {{name}} slots; params are range ({ name, label, min, max, step, value, unit? }) or
                   choice ({ name, label, value, options: [{ value, label }] }); trace is a looping list
                   of { line (1 based), ms (number or a range param name) }
  scene/           renderer, camera, lights, render loop
    stage.js       renderer, camera, orbit controls, lights, ground (no placeholder); returns invalidate()
    renderLoop.js  pure render on demand loop (dirty flag, one frame per invalidate burst)
  parts/           one module per procedural 3D part (board, led, resistor, wire...)
    unoBoard.js    createUnoBoard() -> { group, zones }, 1 unit = 1 cm; UNO_ZONE_IDS for the six clickable zones;
                   PITCH (0.254); UNO_PIN_NAMES and unoPinPosition(name) -> board local Vector3 at the hole top
    breadboard.js  createBreadboard() -> { group }, half size, 30 columns, no rails; BREADBOARD_COLUMNS,
                   BREADBOARD_ROWS, parseHole('12e'), holePosition(hole) local Vector3, holeStrip(hole)
    led.js         createLed({ color, anode, cathode }) -> { group }; red, green, yellow, blue; anode leg kinked
    resistor.js    resistorBands(ohms) -> 4 colour names; createResistor({ ohms, from, to }) -> { group }
    wire.js        WIRE_COLORS, wireCurve(from, to) vertical ended Bezier arch, createWire({ color, from, to }) -> { group, curve }
  circuits/        per lesson circuit tables: which parts sit where on the breadboard
    circuits.js    circuits keyed by lesson id (1.2, 1.3, 1.7 now); plain data, no three.js
    buildCircuit.js buildCircuit(circuit, { board, breadboard }) -> { group, items }; pins and holes
                   to world positions, one factory result per id, item group name = id
  sim/             per lesson simulators, pin levels, goal checks
    tour.js        pure createTour(zoneIds): open, isOpened, openedCount, total, isComplete (lesson 1.1 goal)
    pins.js        pure createPins(): get(name), set(name, level), reset(), subscribe(fn); shared pin levels
    sims.js        sims registry: lesson id -> sim factory ('1.2' now)
    blink.js       pure createBlinkSim: D13 HIGH for onMs, LOW for offMs from startedAt; no goal yet
    runner.js      pure createSimRunner({ sims, pins, onGoal, uploadMs }): hasSim, run, tick(now), stop,
                   getPhase (idle, uploading, running), isGoalMet; UPLOAD_MS fake upload (1500)
  runner/          code runner for learner code (Level 2 onward)
  ui/              panels: lesson strip, info tabs, code panel, params, serial monitor
    panels.js      panel elements: #info-panel (left), #code-panel (right), #lesson-strip (bottom), filled by infoPanel, codePanel, lessonStrip
    infoPanel.js   lesson heading plus Overview, Pinout, Example, Specs tabs rendered from lesson data;
                   WAI-ARIA tabs with roving tabindex, arrow, Home and End keys; selected tab kept across lessons
    codePanel.js   Code heading, lesson line, param controls (range sliders with value text, choice
                   radio fieldsets) and the sketch coloured per line; controls refill the slots live,
                   values reset on lesson change; the trace loops an is-active line highlight on timers;
                   lessons without a sketch show coloured example.code, no controls, no trace;
                   returns { toolbar, getValues }: an empty slot after the lesson line, and a copy of the values
    runControls.js Run and Stop buttons plus status line in the code panel toolbar; hidden on lessons
                   without a sim; rAF loop calls runner.tick while not idle; stops the runner on lesson change
    tabKeys.js     pure nextTabIndex(key, current, count) for the tab keyboard logic
    highlight.js   pure tokenize(code) -> [{ type, text }] for Arduino C++ colouring (tok-<type> classes)
    sketch.js      pure defaultValues(params), fillSketch(code, values), stepDuration(step, values),
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
      { id: 'led1', type: 'led', color: 'red', anode: '9e', cathode: '10e' }
    ],
    wires: [
      { id: 'w1', color: 'yellow', from: 'D13', to: '5a' }
    ]
  }
  ```

  Part positions are holes. Wire `from` is an Uno pin name, `to` a hole.
  Ids are unique within a circuit.
- `main.js` places the Uno left and the breadboard right, 1 cm apart, centred on
  x = 0. On every lesson change it removes and disposes the old circuit group,
  builds `circuits[lesson.id]` if there is one, and calls `invalidate()`.

## Sims and goal checks

- A lesson sim is made by a factory `create({ pins, getValues, startedAt })` and
  returns `{ update(now), stop(), checkGoal? }`. `now` and `startedAt` are ms on
  the same clock. `getValues()` gives the live code panel param values.
- `src/sim/sims.js` exports `sims`, keyed by lesson id. Lessons without an entry
  have no Run controls.
- Pin levels live in one shared `createPins()`: `0` is LOW, `1` is HIGH, unset
  pins read `0`. Stop resets every pin to `0`.
- Run starts a fake upload of `UPLOAD_MS` (1500 ms), then the runner creates the
  sim and calls `update(now)` every tick.
- A lesson is marked done only by `onGoal(lessonId)`, which the runner calls once
  per run when `checkGoal()` first returns true. A sim without `checkGoal` never
  completes its lesson. The runner never calls `markComplete` itself; `main.js`
  passes `onGoal: (id) => course.markComplete(id)`.

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
