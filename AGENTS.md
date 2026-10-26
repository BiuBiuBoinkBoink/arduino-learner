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
`src/app/scene.js`, `src/app/circuitView.js`, `src/app/storage.js`, `src/ui/layout.js`, `src/ui/topBar.js`,
`src/ui/courseMap.js`, `src/ui/guidePanel.js`, `src/ui/viewControls.js`, `src/scene/cameraMath.js`,
`src/style.css`, `src/course/lessons.js`, `src/course/state.js`, `src/course/goalText.js`, `src/course/steps.js`,
`src/course/stepTracker.js`, `src/course/checks.js`, `src/course/flow.js`,
`src/course/progress.js`, `src/course/hash.js`, `src/ui/infoPanel.js`,
`src/ui/codePanel.js`, `src/ui/tabKeys.js`, `src/ui/highlight.js`, `src/ui/sketch.js`, `src/parts/unoBoard.js`, `src/sim/tour.js`,
`src/ui/boardTour.js`, `src/parts/breadboard.js`, `src/parts/led.js`, `src/parts/resistor.js`,
`src/parts/wire.js`, `src/circuits/circuits.js`, `src/circuits/buildCircuit.js`, `src/circuits/holes.js`,
`src/circuits/footprints.js`, `src/circuits/netlist.js`, `src/circuits/rules.js`, `src/sim/pins.js`,
`src/sim/sims.js`, `src/sim/blink.js`, `src/sim/runner.js`, `src/ui/runControls.js`,
`src/parts/button.js`, `src/sim/inputs.js`, `src/sim/button.js`, `src/sim/pullDown.js`,
`src/ui/partPress.js`, `src/parts/potentiometer.js`, `src/ui/partTurn.js`, `src/sim/pot.js`,
`src/sim/fade.js`, `src/sim/ohm.js`, `src/sim/ohms.js`, `src/ui/multimeter.js`, `src/parts/rgbLed.js`, `src/sim/rgb.js`, `src/sim/room.js`, `src/ui/roomControls.js`, `src/parts/ldr.js`,
`src/parts/tmp36.js`, `src/sim/light.js`, `src/sim/temp.js`, `src/parts/buzzer.js`, `src/sim/tune.js`,
`src/ui/sound.js`, `src/parts/servo.js`, `src/sim/sweep.js`, `src/sim/monitor.js`, `src/sim/serial.js`, `src/ui/serialMonitor.js`, `src/runner/lexer.js`, `src/runner/parser.js`, `src/runner/interpreter.js`, `src/runner/session.js`,
`src/runner/worker.js`, `src/runner/codeRunner.js`, `src/runner/codeChecks.js`, `src/sim/responseTimer.js`,
`src/build/kit.js`, `src/build/workbench.js`, `src/build/wireColor.js`, `src/ui/placement.js`, `src/ui/partsTray.js`,
`src/ui/holeTooltip.js`, `src/circuits/suggest.js`, `src/course/nudge.js`, `src/ui/labels.js`,
`src/ui/stepMarks.js`, `src/ui/layoutMode.js`, `src/ui/sheetState.js`, `src/ui/bottomSheet.js`,
`src/ui/sheetPeek.js`, `src/app/explain.js`, `src/explain/tools.js`, `src/explain/currentPath.js`,
`src/explain/scopeBuffer.js`, `src/explain/connections.js`, `src/explain/voltages.js`,
`src/explain/whatIf.js`, `src/sim/headless.js`, `src/course/partInfo.js`, `src/ui/explainMenu.js`,
`src/ui/explainCards.js`, `src/ui/currentTrace.js`, `src/ui/scope.js`, `src/ui/connectionsCard.js`,
`src/ui/partCard.js`, `src/ui/whatIfCard.js`, `src/app/tutor.js`, `src/tutor/toolDefs.js`,
`src/tutor/context.js`, `src/tutor/tools.js`, `src/tutor/chat.js`, `src/ui/askPanel.js`,
`server/tutorCore.mjs`, `server/tutor.mjs`, `server/gemini.mjs`, `vite.config.js`. The other
folders are the target for later jobs.

```
src/
  main.js          boot: composes the layout, scene, course engine, step tracker and flow, stores, runner
                   and UI; on every lesson change loads the lesson build into the workbench and draws it
                   through the circuit view (fresh), and redraws it after every workbench change, then
                   points the per lesson controls (hold button, knob, meter, room, sound) at its parts;
                   runs Edit circuit mode and the build run lock (see "Workbench and placement"); builds the step check context (currentContext) and feeds it to the flow each
                   run frame, on Stop, lesson change, tour completion, every workbench change, a busy
                   change and 300 ms after a code edit; opens the code panel on predict, run and code
                   steps and closes it on the others; turns edit mode on for build and wire steps, and
                   draws the step hints and mistakes (see "Build steps and hints"); counts the step events
                   (hovered places, parts moved, parts put back) for event checks, turns hover only placement
                   on for explore steps with an event check, turns the board tour on only on its step, and
                   on Start this lesson again resets the lesson build and its tour; makes the bottom sheet before the scene and moves the guide
                   and code panel into it in the compact layout (see "Layouts and touch"), starts narrower
                   layouts in the framed 3D view and frames the top or 3D view again on a stage resize;
                   makes the explain tools (src/app/explain.js) last and resets them on a lesson change;
                   with VITE_TUTOR=on makes the Ask pane before the sheet (an Ask tab in it) and the
                   help chat (src/app/tutor.js) after the explain tools, reset on a lesson change
  style.css        CSS tokens on :root (--ink, --line, --panel, --accent, --topbar-h, --guide-w, --code-w,
                   --rail-w...); #app is a grid: #top-bar across row 1, then #guide-panel, #workbench
                   and #code-panel; #stage fills the workbench (position absolute) and the workbench
                   overlays (#run-bar, #view-controls, #controls-dock, .tour-card) float over it; a
                   container query stacks the run bar under the view buttons on a workbench under 640 px;
                   #app[data-layout='medium' | 'compact'] rules change the grid and overlays (see "Layouts
                   and touch"), --guide-w-medium (280px) and --peek-h (132px) size them
  app/             composition helpers for main.js
    scene.js       createScene(stageEl) -> { stage, board, breadboard, frameBox() }: the Uno left and the
                   breadboard right, 1 cm apart, centred on x = 0; frameBox() is the box around both as
                   plain { min, max } objects
    circuitView.js createCircuitView({ stage, board, breadboard, pins, servos, tones, getValues }) ->
                   { show(table | null, { fresh }), items(), table(), relight(name?), showParts(values) }: show
                   removes and disposes the old circuit group, builds the table with the code panel values,
                   lights its LEDs and applies showWhen, returning the new items; fresh (a lesson change)
                   centres the servo at 90 deg, a rebuild after an edit keeps its angle and the buzzer ring;
                   LEDs follow pins, the servo horn servos and the buzzer ring tones
    storage.js     getStorage(): localStorage, or an in memory stand in when it is blocked
    explain.js     createExplain({ stage, board, breadboard, viewControls, viewContainer, workbench, placement,
                   getBuild, getReference, getItems, inputs, runner, getKit, hasCircuit, pins, meter, codePanel,
                   getLessonId }) -> { tools, menu, cards, reset(), refresh(), onFrame(), about(id),
                   measureAt(name), setLabels(owner, list), pointOf(name) }: wires the explain tools to the
                   scene, cards and menu (see "Explain tools"); setLabels sets one owner's pinned labels on
                   the explain label layer ('trace', 'meter', 'chat'), pointOf a hole or pin's world point
    tutor.js       createTutor({ askHost, stage, board, breadboard, placement, viewControls, explain, codePanel,
                   layout, sheet, guide, flow, course, lessons, runner, inputs, room, partPress, partTurn,
                   getBuild, getReference, getCodeError, restoreMarks, selectReferenceTab }) -> { reset(),
                   refresh(), chat, tools }: the help chat's tools wired to the scene and panels, the chat
                   and the Ask panel (see "Help chat")
  course/          lessons data, state, goTo(id), progress; 1.1 to 1.12 then the Level 1 project P1
                   createCourse({ lessons, storage }): goTo, next, prev, markComplete, subscribe; hash #<lesson id>; progress key robo-learn:progress
    goalText.js    pure splitGoal(paragraphs) -> { intro, goal }: goal is the text after 'Goal: ' in the first
                   paragraph that has it; every other text stays in intro (goal null when there is none)
    steps.js       pure stepsFor(lesson) -> step[]: lesson.steps when given (without build and wire steps
                   while BUILD_STEPS_ENABLED is false; it is true since phase 5), else one generated step
                   { id: 'goal', kind: 'run', title: 'Goal', body: [goal], check: { type: 'legacy' } }, or for
                   a lesson with a tour kind 'explore', title 'Tour the board'; hasGeneratedSteps(lesson);
                   scopeFor(lesson, stepIndex) (prebuilt ids, then the parts of every build or wire step up
                   to that one, no repeats); CODE_OPEN_KINDS; STEP_KINDS; BUILD_KINDS
    stepTracker.js pure createStepTracker({ storage, lessons, stepsFor }): get(lessonId) -> { current, passed,
                   helped, answers, latched, hintLevels }, has, setCurrent, markPassed, answer, latch,
                   setHintLevel, reset, completeAll, subscribe; key robo-learn:steps
    checks.js      pure evaluate(step, ctx) -> { passed, items, feedback }; CHECK_TYPES (event included);
                   simKey, simKeys(check)
    flow.js        pure createFlow({ course, tracker, stepsFor, evaluate }): getView, update(ctx), answer, next,
                   toggleOpen, raiseHint(level), runLock, subscribe (see "Lesson steps and checks")
    nudge.js       pure createNudge({ flow, delayMs, setTimer, clearTimer }) -> { poke(), stop() }; NUDGE_MS
                   (40000): raises the current step to hint level 1 on a mistake or after the wait
    partInfo.js    PART_INFO[type] = { name, summary, legs: [{ terminals, label, text }], facts: [{ label, value }] }
                   for the part cards, one entry per part type
    progress.js    pure lessonStatus(lessons, completed, id) -> 'done' | 'next' | '' (next is the first lesson in
                   course order that is not done)
    lessons.js     levels ([{ id, title }], 1 Basics to 5 Beyond the Uno); lesson objects: id, level,
                   title, summary, plus info tab content:
                   overview (1 to 3 paragraph strings), pinout ([{ pin, use }]),
                   example ({ code, note }), specs ([{ label, value }]); optional
                   tour ([{ zone, label, text }], one entry per UNO_ZONE_IDS id, lesson 1.1 only);
                   optional sketch ({ code, params, trace }, 1.2 to 1.12 and P1 now): code is a template with
                   {{name}} slots; params are range ({ name, label, min, max, step, value, unit? }) or
                   choice ({ name, label, value, options: [{ value, label, code? }] }, an option code is the
                   text its slot shows instead of the value); a param with circuit: true is a part on the
                   breadboard (1.3 ohms, 1.5 pull), so it stays live after the code is edited; trace is a looping list
                   of { line (1 based), ms (number or a range param name) }; since phase 6 every lesson has
                   steps (see "Lesson steps and checks") and prebuilt (reference part and wire ids placed
                   when the lesson opens, marked Built earlier); kit ({ parts: [{ id, type, ...meta }], wires })
                   for a lesson with no reference circuit (1.1); project: true (P1) hides hints until asked;
                   overview carries no Goal sentence any more (the steps do)
  scene/           renderer, camera, lights, render loop
    stage.js       renderer, camera, orbit controls, lights, ground (no placeholder); returns invalidate(),
                   setDaylight(level), which scales the lights for a room light level (0.8 is the normal look),
                   setView(kind, box, { animate }) -> Promise, which tweens the camera to a 'top' or '3d' view
                   over 450 ms (jumps under reduced motion; a new call cancels a running one), and getView()
                   -> 'top' | '3d' | 'custom' (custom on first load and once the learner orbits by hand)
    cameraMath.js  pure easeInOut(t), lerpVec(a, b, t), viewFor(kind, box, { fov, aspect }) -> { position,
                   target }: top looks straight down, 3d from +z at 45 deg, both fitting the box with 10% margin
    renderLoop.js  pure render on demand loop (dirty flag, one frame per invalidate burst)
  parts/           one module per procedural 3D part (board, led, resistor, wire...)
    unoBoard.js    createUnoBoard() -> { group, zones, highlightPins(names) }, 1 unit = 1 cm; highlightPins
                   draws a thin accent ring just above each named header hole (pool, callers invalidate); UNO_ZONE_IDS for the six clickable zones;
                   PITCH (0.254); UNO_PIN_NAMES and unoPinPosition(name) -> board local Vector3 at the hole top;
                   PIN_TOP_Y and nearestPin(localX, localZ, maxDistance = 0.6 * PITCH) -> pin name or null
    breadboard.js  createBreadboard() -> { group, highlightPlaces(list), clearHighlights(), setXray(on), isXray() }, half size, 30
                   columns, four power rails with red and blue stripes (the 420 hole marks are one
                   InstancedMesh named 'hole', stripes 'stripe'); highlightPlaces([{ place: 'strip:9-top' |
                   'rail:T+', tone: 'hover' | 'info' | 'good' | 'bad' }]) draws flat see-through boxes over
                   those holes from a pool (HIGHLIGHT_TONES), callers invalidate; re-exports the grid from
                   src/circuits/holes.js; holePosition(hole) local Vector3, rails included; HOLE_TOP_Y and
                   nearestHole(localX, localZ, maxDistance = 0.6 * PITCH) -> hole within the distance on both
                   axes, or null; setXray(on) makes the body see-through (XRAY_OPACITY 0.25, no depth writes,
                   no body shadows) and shows the 'xray-bar' instanced mesh, one metal bar (0xb8bec6) under
                   each strip and rail (xrayBars(), 64), built once and hidden while off
    led.js         createLed({ color, anode, cathode }) -> { group, setLit(on), setBrightness(b) }; red, green, yellow,
                   blue; anode leg kinked; setBrightness(b) for b from 0 to 1 glows the lens in its own colour
                   (emissive only) at LIT_INTENSITY * b, none at 0; setLit(on) is setBrightness(on ? 1 : 0);
                   new LEDs start unlit
    rgbLed.js      createRgbLed({ legs }) -> { group, setColor(r, g, b) }; common cathode, four legs in a row
                   (red, cathode, green, blue); channels 0 to 1 mix as sRGB into the lens glow and tint
    ldr.js         createLdr({ from, to }) -> { group }; photoresistor disc with a wavy track on two legs
    tmp36.js       createTmp36({ legs }) -> { group }; black TO-92 half cylinder, flat face to +z, three legs
                   (+Vs, Vout, GND from left to right)
    buzzer.js      createBuzzer({ legs }) -> { group, setPlaying(on) }; passive piezo, two legs (positive,
                   negative); setPlaying shows the sound-ring above the hole
    servo.js       createServo({ legs }) -> { group, setAngle(deg) }; SG90 body on the breadboard right of its
                   three cable ends (GND, 5V, signal); horn on shaft, 90 deg -z, 0 deg +x, 180 deg -x
    resistor.js    resistorBands(ohms) -> 4 colour names; createResistor({ ohms, from, to }) -> { group }
    button.js      createButton({ legs }) -> { group, setPressed(on) }; 4 leg tactile switch, legs are four
                   hole tops; setPressed lowers the cap 0.05 cm; group.userData.pressable = true
    potentiometer.js createPotentiometer({ legs }) -> { group, setValue(v) }; blue 1 cm body on three legs (outer,
                   wiper, outer), knob with a pointer mark; setValue clamps to 0 to 1 and turns the knob over
                   270 degrees, clockwise from above as v rises, 0.5 straight ahead (-z); starts at 0.5;
                   group.userData.turnable = true
    wire.js        WIRE_COLORS, wireCurve(from, to) vertical ended Bezier arch, createWire({ color, from, to }) -> { group, curve }
  circuits/        per lesson circuit tables: which parts sit where on the breadboard
    circuits.js    circuits keyed by lesson id (1.2 to 1.12 and P1 now); plain data, no three.js
    buildCircuit.js buildCircuit(circuit, { board, breadboard, values }) -> { group, items }; parts by
                   legsOf (legs or the reference fields), pins and holes to world positions, one factory
                   result per id, item group name = id with userData.partId or userData.wireId; a resistor
                   with ohmsParam takes its ohms and bands from values[ohmsParam]; an unplaced part throws;
                   a wire end is a hole when isHole(name) (rails included); re-exports buttonHoles,
                   potHoles, rgbHoles and buzzerHoles from footprints.js
    holes.js       pure hole grid: BREADBOARD_COLUMNS, BREADBOARD_ROWS, RAIL_ROWS, ALL_ROWS, ALL_HOLES (420),
                   parseHole, isHole, holeName(column, row), rowPitchZ(row), rowAt(row, pitches), holeStrip
    footprints.js  pure PART_TYPES, TERMINAL_LABELS, legsOf, terminalHoles, footprint, orientationCount,
                   bendLegs, legsValid(type, legs), orientationOf(type, legs) -> { anchor, orientation } | null,
                   buttonHoles, potHoles, rgbHoles, buzzerHoles (see "Netlist and footprints")
    netlist.js     pure buildNetlist, canonical, compare, align, diagnose, normalizePin, placeOf, partLabel,
                   thingLabel, placeLabel, formatOhms (see "Netlist and footprints")
    rules.js       pure createRuleContext(build, reference), evaluateRule(rule, ruleContext); rules listed under
                   "Netlist and footprints"
    suggest.js     pure suggest(build, reference, step, scope) -> [{ kind: 'part', id, legs } | { kind: 'wire',
                   from, to } | { kind: 'unwire', id }]; joinPlaces, pendingPins, suggestionLabels;
                   SEARCH_LIMIT (see "Build steps and hints")
  build/           the learner's build (pure; see "Workbench and placement")
    kit.js         kitFor(lesson, reference, { prebuiltLists }) -> { parts: [{ id, type, meta }], wires, prebuilt }
    workbench.js   createWorkbench({ storage }): load, getBuild, tray, occupancy, canPlace, place, remove, canWire,
                   addWire, removeWire, canUndo, undo, reset, placeReference, kitPart, subscribe; REASONS;
                   key robo-learn:build
    wireColor.js   autoWireColor(from, build), pinColor(pin), WIRE_COLOR_NAMES
  explain/         explain tools (see "Explain tools"); pure except tools.js, which reaches the scene through deps
    tools.js       createExplainTools(deps) -> { xray, trace, scope, connections, part_card, measure, slow_motion,
                   what_if, reasons(), wiredPins(), signalPins(), whatIfChoices() }; wiredPins(build),
                   signalPins(build), whatIfChoices(build), ledSentence(state, label); the tool texts
    currentPath.js pure tracePath(build, { from, pressed }) -> { hops, parts, reachesGround, stop, blocked }; partEdges
    scopeBuffer.js pure createScopeBuffer({ windowMs }), summarize(samples, fromMs, toMs), scopeText, describePin,
                   roundMs, levelOf; SCOPE_WINDOW_MS (10000)
    connections.js pure describeNets(build, reference) -> [{ id, things, places, match }]
    voltages.js    pure netVoltages(build, { pinLevels, inputLevels }) -> Map(netId -> volts | null), pinVoltage,
                   FORWARD_VOLTS, RGB_FORWARD_VOLTS
    whatIf.js      pure whatIfCode({ lessonId, source, values, line, text }), whatIfCircuit(build, change), mainPin,
                   cyclePhrase; WHAT_IF_MS (3000)
  sim/             per lesson simulators, pin levels, goal checks
    tour.js        pure createTour(zoneIds): open, isOpened, openedCount, total, isComplete (lesson 1.1 goal)
    pins.js        pure createPins(): get(name), set(name, level), reset(), subscribe(fn), snapshot() (pins ever set);
                   shared pin levels
    inputs.js      pure createInputs(): isPressed(id), setPressed(id, on), getValue(id), setValue(id, v),
                   getProbe(), setProbe(id), subscribe(fn); held buttons and knob values (0 to 1, 0.5 when
                   never set) by part id, and the meter probe target id (null when unset, never notified)
    sims.js        sims registry: lesson id -> board factory ('1.2' to '1.12' and 'P1' now); a board is the
                   circuit around the sketch plus the goal (see "Sims and goal checks")
    monitor.js     pure createMonitorSim (P1) board: DAY_MS 24 s day sets the room (lightAt, tempAt) and feeds A0
                   (divider) and A1 (TMP36); goal is one whole day with D13 and the D8 tone right in every
                   checked band, a mistake counting once it lasts REACT_MS (300)
    sweep.js       pure createSweepSim (1.12) board: servo events on D9 command the arm, which moves at 0.6 deg
                   per ms in servos; goal is resting at each of TARGETS 45, 90, 135 while commanded
    tune.js        pure createTuneSim (1.11) board: NOTES C to B; goal is three D8 tone starts in a row playing
                   TARGET E D C, each within 600 ms of the last
    room.js        pure createRoom(): getLight (0 to 1, default 0.8), getTempC (0 to 40, default 22), setLight,
                   setTempC, reset, subscribe(fn) with (name, value), name 'light' or 'tempC'
    light.js       pure createLightSim (1.9) board: ldrOhms(light) 1 Mohm dark to 1 kohm bright (log),
                   dividerLevel(light) with 10 kohm to GND on A0; goal is D13 turning on and off again
    temp.js        pure createTempSim (1.10) board: tmp36Level(tempC) = (0.5 + T / 100) / 5 on A0, rawToC(raw);
                   goal is the reading (nearest degree) at or below 15 and at or above 30 deg C since Run
    rgb.js         pure createRgbSim (1.8) board: reads D9, D10, D11 duty as 0 to 255; readout 'Now r, g, b.
                   Target orange 255, 128, 0'; goal is every channel within 25 of TARGET at once
    ohm.js         pure LED_SUPPLY_V (5), LED_FORWARD_V (2), ledCurrentMa(ohms) = 3 / R in mA,
                   ledBrightness(ohms) relative to 220 ohm, clamped to 0 to 1
    ohms.js        pure createOhmsSim (1.3) board: current is D9 level times ledCurrentMa(ohms circuit param);
                   readout 'Meter on <label>: <mA> mA'; goal is a probed current with each of 220, 1000, 10000
    blink.js       pure createBlinkSim (1.2) board: goal is the last two rising edges of D13 under 500 ms apart
                   on the sketch clock; reload forgets the last edge
    button.js      pure createButtonSim (1.4) board: btn1 held drives D2 LOW, released leaves it undriven (the
                   sketch pull up reads HIGH); goal is 3 full presses, each with D13 on while held; the
                   readout shows how fast D13 reacts to D2 (response timer)
    responseTimer.js pure createResponseTimer({ inputPin, outputPin }) -> { output(event), times(), last(),
                   worst(), waiting(at) }: ms from an input event to the next output pin change
    pullDown.js    pure createPullDownSim (1.5) board: held drives D2 HIGH, released LOW with pull 'down', a random
                   level every 40 to 160 ms with 'none'; goal is 3 full presses with D13 on while held, while
                   fitted, removing the pull down resets the count
    pot.js         pure createPotSim (1.6) board: A0 is the pot1 knob; readout 'A0 reads <raw>, <volts> V'; goal is
                   A0 at or below 100 and at or above 920 since Run, any order
    fade.js        pure createFadeSim (1.7) board: reads D9 duty; goal is one full fade (one end, the other end
                   and back) taking 1000 to 3000 ms on the sketch clock; reload starts timing again
    serial.js      pure createSerial({ maxLines }): print, println (floats to 2 decimals), getLines, clear; send(text)
                   queues a line, available, read, readLine, clearInput; subscribe(fn) with 'output' or 'input'
    runner.js      pure createSimRunner({ sims, pins, inputs, room, tones, servos, serial, codeRunner, onGoal,
                   uploadMs }): hasSim, run({ lessonId, getValues, source, now }), reload(source, now), tick(now),
                   receive(batch), fail(error), stop, getPhase (idle, uploading, running, error), getError,
                   isGoalMet, getReadout, getProgress, getClock, getInputLevels, subscribeOutput(fn),
                   subscribeLine(fn), setSlowMotion(on, speed), getSlowMotion, isDemo, beginDemo() (the
                   same demo flag at full speed, for the help chat's demo_input); checkCode(source)
                   compiles without running; UPLOAD_MS (1500); RAN_MS (1000)
    headless.js    pure createHeadless({ lessonId, values, source, edit }) (the lessonGoals drive pattern) and
                   runHeadless({ lessonId, source, values, ms, actions }) -> { events, progress, goalMet, error }
  runner/          code runner for learner code (Level 2 onward)
    lexer.js       pure lex(source) -> tokens { type, value, line, column } (number, string, char, ident, keyword,
                   op, include, eof); CodeError(message, line, column) with message 'Line N: ...'
    parser.js      pure parse(source) -> Program { includes, body } AST; top level VarDecl, Function, Prototype,
                   Enum; statements Block, VarDecl, ExprStmt, If, While, DoWhile, For, Switch, Break, Continue,
                   Return, Empty; expressions Number, String, Char, Bool, Ident, Assign, Conditional, Binary,
                   Unary, Update, Call, Member, Index, Cast, Sequence, InitList; types { name, const } with
                   enum names and LIBRARY_CLASSES (Servo); every node has line; errors throw CodeError
    interpreter.js pure createProgram(source, hw) -> { advance(untilMs), millis(), error }; optional hw.onLine(line)
                   at each statement start; generator based, virtual
                   clock (delay waits, STATEMENT_MS per statement), C int rules (truncating division, wrap on
                   store), Arduino built-ins, Serial, Servo and String methods; runtime CodeErrors stop it;
                   pinName(n) maps 0 to 13 -> D0 to D13 and 14 to 19 -> A0 to A5
    session.js     pure createSession(source, { random, trace, timeScale }) -> { advance(untilMs) -> batch,
                   setInputs(levels), sendSerial(text), setTrace(on), setTimeScale(scale) }; the sketch clock moves
                   at timeScale times real time; with trace, [ms, 'line', null, line] events; batch { pins (0 to 1), tones (Hz), servos (deg), events ([ms, kind, pin,
                   value] for every change in order, kind 'pin', 'tone', 'servo', or 'input' when the
                   circuit changes an input level), serial, millis, error };
                   tone(pin, hz, ms) ends by itself at its own time; null or unset input pins read HIGH with
                   INPUT_PULLUP, else LOW
    worker.js      Web Worker: start, stop, inputs, serial, trace and timeScale messages in (trace and timeScale
                   carry over to the next start); started, batch and error messages out; follows real time
                   every 16 ms
    codeChecks.js  pure analyzeCode(source) -> { error, calls [{ name, line, inFunction }], functions, includes },
                   names as written ('delay', 'Serial.println', 'arm.write'); findCalls, countCalls, callLines
                   (each with { inFunction }), definesFunction; a parse error gives error, not a throw
    codeRunner.js  createCodeRunner({ onBatch, onError, createWorker, startTimeoutMs }) -> { start(source), stop(),
                   setInputs(levels), sendSerial(text), setTrace(on), setTimeScale(scale) }; main thread client for the worker; a worker that
                   cannot load or does not send started within START_TIMEOUT_MS (4 s) reports START_FAILED
                   with line null, so Run never fails silently
  ui/              layout, top bar, course map, guide, info tabs, code panel, params, workbench controls
    layout.js      createLayout(app) -> { topBar, guide, workbench, stageEl, runBar, viewControls, dock, codePanel,
                   setCodeOpen(on), isCodeOpen(), subscribeCode(fn), getMode(), subscribeMode(fn) }: builds
                   header#top-bar, aside#guide-panel, main#workbench (with #stage, #run-bar, #view-controls,
                   #controls-dock and the compact Controls button inside) and aside#code-panel; setCodeOpen
                   toggles is-closed on the code panel; a ResizeObserver on #app sets data-layout from
                   layoutFor(width) and calls subscribeMode listeners on a change; the Controls button
                   (.dock-toggle, aria-expanded) toggles .is-open on the dock and is hidden while the dock has
                   no visible control
    layoutMode.js  pure layoutFor(width) -> 'wide' (>= 1200) | 'medium' (900 to 1199) | 'compact' (< 900); a
                   width that is not a number is wide
    sheetState.js  pure nextSheetState(state, action) with 'expand', 'collapse' or { type: 'drag', dy, height }
                   (snaps to the state whose height is nearest the release) and sheetHeights(height) ->
                   { peek: 132, half: height / 2, full: height - 8 (never under peek) }
    bottomSheet.js createBottomSheet({ container, tabs: [{ id, label, element }] }) -> { setState(state), getState(),
                   selectTab(id), getTab(), subscribe(fn), setActive(on), isActive(), peekSlot }: section
                   #bottom-sheet (see "Layouts and touch")
    sheetPeek.js   createSheetPeek({ container, flow, course }): the peek of the current step (kind and title,
                   'N of M done', and once passed 'Milestone done' with Continue or 'Lesson done' with the
                   next lesson)
    topBar.js      createTopBar(container, course, { levels, onOpenMap, flow }) -> { mapButton }: Robo Learn, the
                   'Level 1 Basics / 1.2 Blink' breadcrumb, step progress from the flow (one 28 x 6 px segment
                   per step, good when passed, accent when current, line when locked, then 'Step 2 of 3' or
                   'Done'; the group's aria-label is 'Step 2 of 3' or 'Lesson done'), Prev and Next, and the
                   Course map button; the level and separator are .top-crumb-level spans and Prev and Next
                   carry a chevron icon beside a .top-button-text span, so the compact CSS can hide them
    courseMap.js   createCourseMap({ container, course, levels, button }) -> { open, close, isOpen }: #course-map
                   dialog popover under the top bar with 'N of 13 lessons done', a progress bar and one button
                   per lesson by level (Done, Up next); opening focuses the current lesson, arrow keys move,
                   Escape closes and refocuses the button, a click outside closes; lessons are never locked
    guidePanel.js  createGuidePanel(container, { course, flow, tracker, onRestart, onHelp, canSuggest, askHost })
                   -> { referenceBody, setShowMe(texts), openReference(), selectTab(id), getTab() }: with
                   askHost (help chat on) WAI-ARIA Steps and Ask tabs (.guide-tabs, nextTabIndex) over a
                   .guide-pane holding everything below and askHost as the Ask pane (left in the sheet
                   while it is there); lesson header, an
                   ol.guide-steps from flow.getView() and a closed details.guide-reference hosting the info
                   tabs. One li per step: a row with an 18 px status icon (done tick, current ring and dot,
                   locked padlock), kind label and title; done rows are buttons (aria-expanded) opening a read
                   only card, locked rows are dimmed with aria-label '<title>, locked'. The current card shows
                   the body (generated steps show the lesson intro and Goal box instead), the question with
                   .guide-option buttons (aria-pressed; right good border, wrong bad border, predict accent),
                   the 'To pass' checklist, feedback, the hint ladder (see "Build steps and hints"), and once
                   passed a success box ('Milestone done' and Continue, or 'Lesson done' and the next lesson,
                   plus a muted 'Helped' line for a helped step). Feedback and success sit in
                   persistent role="status" regions; a re-render keeps focus on the same control. 'Start this
                   lesson again' needs a second click within 3 s ('Click again to start over') and calls
                   tracker.reset, then onRestart (main.js resets the lesson build)
    viewControls.js createViewControls({ container, stage, getFrameBox, getEditBox, onEdit }) -> { setView(kind,
                   opts), setEditing(on), setEditAvailable(on), isEditing(), addGroup(element), closeMenu() }: an Edit circuit toggle
                   (aria-pressed) in its own group, then Top view, 3D view and Reset view buttons; Top and 3D
                   follow stage.getView() with aria-pressed. Both groups sit in .view-menu (display: contents
                   outside compact) after a View button (.view-toggle, aria-expanded, hidden outside
                   compact) that opens them as a popover; a choice, Escape (focus back on View) or a pointer
                   down outside closes it
    infoPanel.js   createInfoPanel(panel, course, { heading = true }) -> { select(key) }: lesson heading (left out with heading
                   false, as in the guide's Reference drawer) plus Overview, Pinout, Example, Specs tabs rendered from lesson data;
                   WAI-ARIA tabs with roving tabindex, arrow, Home and End keys; selected tab kept across lessons
    codePanel.js   createCodePanel(panel, course, { setOpen }): a Code header with a chevron (Hide code) and a
                   vertical Code rail (Show code) shown only while closed, both calling setOpen; while closed
                   everything but the rail is hidden; param controls (range sliders with value text, choice
                   radio fieldsets) and the sketch editor: a transparent textarea (#code-input) over the
                   coloured code, a Reset code button and an error line; controls refill the slots until the
                   learner edits the text, then switch off (except params with circuit: true) until Reset;
                   the trace loops an is-active line highlight while unedited; has-error marks a code error;
                   lessons without a sketch show coloured example.code read only; a Full screen button at
                   the top right of the editor (Escape or the button closes) moves the workspace (editor,
                   error line, serial slot) to the body to fill the window over a backdrop; returns
                   { serialSlot, getValues, subscribe, onInput, getSource, isEdited, setError, markLines,
                   clearMarks, setExecutingLine, offerLine }; offerLine(afterLine, text, why) shows a
                   suggested line in a grey .code-offer row under the editor with Add line, which puts it
                   in after that line with its indent as a learner edit (cleared by Add, a new offer,
                   Reset code or a lesson change); setExecutingLine(n) gives line n the trace's is-active highlight
                   (made stronger by is-executing on the code) and pauses the trace loop, null hands it back; onInput(fn) calls fn(source) on every edit of the sketch text;
                   markLines(lines, note) gives those 1 based lines is-hint (accent soft background) and puts
                   the note after the first one until clearMarks or a lesson change
    runControls.js createRunControls({ container, course, runner, getValues, getSource, onError }) ->
                   { noticeError }: Run sends getSource() and shows a compile or runtime error as
                   'Stopped. Line N: ...' plus onError(error) for the code panel; Stop button and status
                   line; hidden on lessons without a sim; rAF loop calls runner.tick while running; stops
                   the runner on lesson change; .run-readout line shows runner.getReadout(); main.js puts it
                   in #run-bar, a floating bar at the top left of the workbench; options getLock() (a string
                   disables Run and shows as the status; refreshLock() re-checks it) and onFrame() (after
                   every loop frame, on Stop and on an error); returns { noticeError, refreshLock, stop };
                   the status and readout keep their whole text in title (compact cuts them with an ellipsis);
                   getNote() (a line shown as the status while running, the slow motion note)
    partPress.js   createPartPress({ stage, getItems, inputs }) -> { press(id), release(), isPressed(), setEnabled(on) }: raycast
                   press and release on visible pressable circuit items, orbit off while held, pointer cursor
                   on hover; createHoldButton({ container, partPress, inputs }) -> { setTarget(id) }, the
                   "Hold to press" keyboard path in the Controls dock, aria-pressed follows inputs
    partTurn.js    createPartTurn({ stage, getItems, inputs }) -> { setValue(id, v), release(), setEnabled(on) }: vertical drag on
                   visible turnable circuit items (200 px for the full range), orbit off while turning, ns-resize
                   cursor on hover; createKnobSlider({ container, partTurn, inputs }) -> { setTarget(id) }, the
                   "Knob" range input (0 to 1023) in the Controls dock, following the knob both ways
    roomControls.js createRoomControls({ container, room }) -> { setSensors({ light, temp }) }: "Room light"
                   (0 to 100 %) and "Room temperature" (0 to 40 deg C) sliders in the Controls dock, each shown
                   only when the circuit has an ldr or tmp36, following the room both ways
    sound.js       createSound({ container, tones, storage }) -> { setPin(name) }: Web Audio square wave following
                   the tone on the buzzer pin; "Sound on" / "Sound off" toggle in the Controls dock on buzzer
                   lessons, saved under robo-learn:sound (default on)
    serialMonitor.js usesSerial(lesson) (sketch or example contains Serial.begin);
                   createSerialMonitor({ container, serial, onSend }) -> { setVisible(on) }; #serial-panel sits
                   in the code panel serialSlot under the editor; main.js sends lines to the running sketch
                   through the code runner: Clear, a scrolling non live role="log" output and a Send form
    multimeter.js  createMultimeter({ container, stage, board, breadboard, getItems, inputs, onMeasure }) ->
                   { setTargets(targets), setAvailable(on), setEnabled(on), setReading(text), getMode() }: a Mode
                   select (Current only with meter targets, Voltage on every lesson with a circuit); Current is
                   the "Meter on" select and click to probe a visible part of a target (a pointer up within 5 px
                   of its down), both writing inputs.setProbe(id); Voltage measures the hole or pin under a click
                   (8 px for touch taps) or typed in Point with Measure, through onMeasure(name)
    placement.js   createPlacement({ stage, board, breadboard, workbench, getItems, getValues, tooltip, onChange,
                   onHover }): edit mode picking, ghosts, strip highlights, wires and window keys (see
                   "Workbench and placement"); setMarks([{ place, tone }]) adds step highlights under its
                   own, setLocked(ids) stops later parts being picked up, setHoverOnly(on) keeps the hovered
                   strip and the hole tooltip with edit mode off (no picking; the arrows move the hovered hole
                   while the page has focus); touch taps move the target without placing (getState().touch
                   and touchReady; see "Layouts and touch"); exports buildGhost({ table, board,
                   breadboard, values, tint }), disposeGroup(scene, group) and holeOrPinAt({ stage, board,
                   breadboard, clientX, clientY }); setOverlay([{ place, tone }]) shows highlights even with
                   edit mode off (the Connections row being pointed at)
    partsTray.js   createPartsTray({ container, workbench, placement, kitLabels, onAbout }) -> { setVisible(on), render(),
                   setStep({ pulse, later }) }: #parts-tray with the kit, Jumper wires, Undo, Reset circuit,
                   status, colour and the keyboard row; pulse parts get an accent ring animation (a still
                   ring under reduced motion), later parts say Later and are disabled; .tray-touch floats
                   above it with Place, Turn and Cancel while placement's touchReady is true; each kit part has a
                   ? button joined to its right (aria-label 'About the <part>', onAbout(id)); exports
                   partIcon(type, size)
    askPanel.js    createAskPanel({ container, chat, getSuggestionContext }) -> { refresh(), focus() }: the Ask
                   pane (see "Help chat"); suggestionsFor(kind, codeError), EMPTY_TEXT
    explainMenu.js createExplainMenu({ container, addToView, closeView, rows }) -> { open, close, isOpen, refresh,
                   setStatus }: the Explain button and popover (see "Explain tools")
    explainCards.js createExplainCards({ container }) -> { open({ kind, title, onClose }), close(kind), closeAll(),
                   has(kind), get(kind) }; MAX_CARDS (2)
    currentTrace.js createCurrentTrace({ stage, board, breadboard, getItems, setLabels }) -> { show(path), clear() }
    scope.js       openScopeCard({ cards, buffer, getClock, isRunning, pin, seconds }) -> card
    connectionsCard.js openConnectionsCard({ cards, rows, onHover }) -> card with update(rows)
    partCard.js    openPartCard({ cards, type }) -> card
    whatIfCard.js  openWhatIfCard({ cards, title, columns, onClose }) -> card
    labels.js      createLabels({ stage, container }) -> { set(list), clear() }: aria-hidden .pin-label boxes
                   above projected 3D points ([{ id, position, text, tone }]), re-placed on controls change,
                   resize and set; hidden behind the camera or outside the workbench
    stepMarks.js   createStepMarks({ stage, board, breadboard, placement, labels, getValues }) -> { set({ places,
                   pins, ghost, labels }), clear() }: step highlights, pin rings, accent hint ghosts and
                   labels at holes or pins
    holeTooltip.js createHoleTooltip({ container }) -> { show(name, clientX, clientY), hide() }: aria-hidden
                   label with the hole and its place, or a pin name
    tabKeys.js     pure nextTabIndex(key, current, count) for the tab keyboard logic
    highlight.js   pure tokenize(code) -> [{ type, text }] for Arduino C++ colouring (tok-<type> classes)
    sketch.js      pure defaultValues(params), slotValues(params, values), fillSketch(code, values), stepDuration(step, values),
                   traceStepAt(trace, values, elapsedMs)
    boardTour.js   createBoardTour({ stage, board, course, container, onComplete }): board hover labels, zone
                   clicks and tour card checklist for lessons with a tour; the card sits inside the workbench
                   below the view buttons; calls onComplete(lessonId) once every zone is opened (main.js feeds
                   it to the tour step check; the flow marks 1.1 done once every step passed); returns
                   { setEnabled(on), reset(lessonId) }: main.js enables it only while the current step has a
                   tour (or legacy) check, and reset forgets the opened zones; a zone tap counts within 8 px
                   for touch (5 px for the mouse); the compact CSS turns the card into a strip above the peek
  tutor/           help chat (see "Help chat"); pure except chat.js, which does the network
    toolDefs.js    TOOL_DEFINITIONS (20 strict tools), TOOL_NAMES; shared by the server and the client
    context.js     pure buildState({ lesson, step, view, hintLevel, build, connections, code, codeError, run }),
                   formatState(state), numberedCode(source); MAX_CODE_LINES (150)
    tools.js       createTutorTools(deps) -> { run(name, input), has(name) }; checkInput, plainText
    chat.js        createChat({ endpoint, fetchImpl, runTool, getState }) -> { ask, reset, getTranscript, isBusy,
                   getMessages, subscribe }; ERROR_TEXTS, REFUSAL_TEXT, CUT_SHORT, FRESH_TEXT
server/            the tutor server (node, not bundled)
  tutorCore.mjs    pure SYSTEM_PROMPT, validateRequest, buildApiRequest, createRateLimiter, fakeReply, MODEL
  tutor.mjs        node:http server, POST /api/tutor only; TUTOR_PROVIDER picks Claude (default) or Gemini
  gemini.mjs       pure buildGeminiRequest, toGeminiContents, fromGeminiResponse, GEMINI_TOOLS, GEMINI_MODEL
vite.config.js     proxies /api to http://localhost:7300 for dev and preview
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
  `f` to `j` another (`'12-bottom'`).
- Four power rails run along the long edges, a hole in every column, named row
  then column: `'T+12'`, `'T-12'` on the far side (z -9 and -8 pitches) and
  `'B-12'`, `'B+12'` on the near side (8 and 9 pitches). Each rail is one strip
  (`holeStrip('T+12')` is `'rail-T+'`). A red stripe sits half a pitch outside
  each + rail and a blue one half a pitch inside each - rail. Wires may start or
  end on rails; existing reference circuits do not use them. The pure grid lives
  in `src/circuits/holes.js`; `breadboard.js` re-exports it.
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

  Part positions are holes. Wire `from` is an Uno pin name, or a hole for a
  jumper between two strips; `to` is a hole.
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
- A photoresistor is `{ id, type: 'ldr', from, to }`. A TMP36 is
  `{ id, type: 'tmp36', at: '12e' }` with its legs in the same three holes as a
  potentiometer: +Vs, Vout, GND. A circuit with either shows its room slider,
  and `main.js` resets the room to its defaults on every circuit build.
- A buzzer is `{ id, type: 'buzzer', at: '12e', pin: 'D8' }`, with its positive
  leg at `at` and its negative leg three columns on; the column must be at most
  27. `pin` names the Uno pin whose tone it plays.
- A servo is `{ id, type: 'servo', at: '12h', pin: 'D9' }`. Its cable ends use
  the same three holes as a potentiometer (GND, 5V, signal), and its body lies
  on the breadboard to the right. `main.js` centres it at 90 deg on every build.
- A circuit with `roomDriven: true` has its sim set the room (the P1 sim day),
  so `main.js` hides the room sliders for it.
- An LED may carry `ohmsParam`, the code panel param holding its series
  resistor in ohms. `main.js` then lights it at the pin level times
  `ledBrightness(ohms)`, and re-lights LEDs on every param change.
- A circuit may list `meter: [{ id, label, parts }]`, the multimeter targets.
  Clicking any listed part probes its target id; `main.js` passes the list to
  `multimeter.setTargets` on every circuit build.
- Any part may carry `showWhen: { param, value }`. `main.js` draws it only while
  that code panel param has that value (through the code panel `subscribe`).
  Hidden parts are not pressable.
- `src/app/scene.js` places the Uno left and the breadboard right, 1 cm apart, centred on
  x = 0. On every lesson change main.js loads the lesson build (see "Workbench and
  placement"), the circuit view removes and disposes the old circuit group, builds the
  build if the lesson has a reference circuit, and calls `invalidate()`. A held button
  is released first.
- Lesson 1.3 has one resistor `{ id: 'r1', type: 'resistor', ohms: 220, ohmsParam: 'ohms',
  from: '5c', to: '9c' }` whose ohms and bands follow the Resistor choice; its meter target
  `resistor` lists `parts: ['r1']`.

## Netlist and footprints

- Part types (`PART_TYPES` in `footprints.js`), with terminals in leg order:
  led `anode`, `cathode` (polar, shape pair); resistor and ldr `a`, `b` (bend,
  2 to 8 and 2 to 6 pitches); button `a`, `b` (button); potentiometer `end1`,
  `wiper`, `end2` (row of 3, flips); tmp36 `vs`, `vout`, `gnd` and servo `gnd`,
  `vcc`, `signal` (polar rows of 3, no flip); rgbLed `red`, `cathode`, `green`,
  `blue` (polar row of 4, flips); buzzer `a`, `b` (gap of 3, flips, not polar).
  `TERMINAL_LABELS[type][terminal]` gives the words for messages (`long leg`,
  `outer leg`, `orange signal wire` ...).
- A placed part has `legs`, holes in terminal order; a button has four legs
  `[c r1, c+2 r1, c r2, c+2 r2]`, terminal `a` being legs 0 and 2 and `b` legs 1
  and 3. `legsOf(part)` reads `legs` or the reference fields (anode and cathode,
  from and to, at), and gives `[]` for an unplaced part. `footprint(type, anchor,
  orientation)` gives the legs of a fixed shape (null when off the board; an LED
  steps one column, or one row only between rows exactly a pitch apart; a button's
  second pair is 3 pitches towards +z). `bendLegs(type, from, to)` allows one row
  or one column within the part's span, across the channel too.
- `buildNetlist(circuit)` joins keys with union find: `term:<id>.<terminal>`,
  `pin:<pin>` (GND.2 and GND.3 are GND), `strip:<n>-top|bottom`, `rail:<row>`.
  Each leg joins its terminal to its hole's place; each wire joins its from (pin
  or place) to its to. Nets are `{ id, terms, pins, places }`, the id being the
  smallest key; `netOf` takes any key form, a terminal, a pin or a hole.
- Tokens: pins by name; `id.terminal` for polar parts, `id.*` for resistor, ldr,
  button and buzzer, `id.end` and `id.wiper` for a potentiometer. `canonical`
  gives one sorted token string per net; with `only` (part ids) it keeps those
  parts' tokens and drops pins. `compare(build, reference, { only })` ->
  `{ match, missing, extra }` after `align`, which swaps ids between parts with
  the same `interchangeKey` (`resistor:<ohms>`, `led:<color>`, else the type) to
  fit the reference best (ties keep ids); placed parts may take the ids of unplaced parts of
  their group, so the first of three 220 ohm resistors fits whichever leg it went on.
- `diagnose(build, reference, { only })` -> `[{ id, text, targets: { parts,
  holes, pins, places } }]`, most important first:

  | id | Found when |
  | --- | --- |
  | `short` | a net holds two different pins |
  | `button-gap` | a button's sides share a net, or it does not straddle the channel where the reference one does |
  | `same-net` | two terminals of a part share a net they do not share in the reference |
  | `reversed` | turning an LED, RGB LED or TMP36 round fits the reference better |
  | `wrong-pin` | a net with pin P fits a reference net with pin Q, and none with P |
  | `no-resistor` | an LED anode or RGB colour leg meets a pin other than GND that its reference net does not have |
  | `loose-wire` | a pin's net has only places, unless the parts it should meet are unplaced or the reference is empty |
  | `missing` | a reference part is not placed |
  | `not-joined` | a reference net has no equal build net (names its first two tokens in different build nets) |
  | `loose` | a terminal is alone in its net and joined to something in the reference |

  The texts are in `netlist.js` and `03-netlist-footprints.md`. Wording helpers:
  `partLabel` (adds the value, colour or id only when needed), `thingLabel`,
  `placeLabel` (`strip 9 (rows a to e)`, `the top + rail`), `formatOhms`.
- With an empty reference (1.1) only `short` and `same-net` can appear: a part the reference
  does not have must never have two terminals in one net.
- Step rules (`rules.js`): `{ placed: id }`, `{ apart: [x, y] }`, `{ allApart: id }`,
  `{ straddles: id }` (a button with legs in rows e and f),
  `{ joined: [items] }` (`id.*` any terminal, `id.end` either outer leg, pins
  normalized), `{ wired: pin }`, `{ noShorts: true }`, `{ matches: 'all' | [ids] }`.
  `createRuleContext` aligns the build once and caches its netlist and diagnosis.

## Workbench and placement

- The reference circuit in `circuits.js` is the answer key. The scene draws the learner's build,
  held by the workbench (`src/build/workbench.js`), plus the reference `meter` and `roomDriven`.
- Kit (`kitFor`): parts from `lesson.kit.parts`, else every reference part, each `{ id, type, meta }`
  (meta is every field but id, type and the positions `legs`, `anode`, `cathode`, `from`, `to`,
  `at`); wires `lesson.kit.wires`, else the reference wire count plus 2; prebuilt `lesson.prebuilt`
  when given and `prebuiltLists` is true, else every reference item. main.js passes
  `BUILD_STEPS_ENABLED` (true since phase 5), so every lesson opens with exactly its `prebuilt` list
  (1.2, 1.6, 1.8, 1.10 to 1.12 and P1 open empty). 1.1 has no reference circuit: its kit is
  `lesson.kit` (one 220 ohm resistor, 2 wires), it has edit mode and the tray, no run lock, and
  no hint glows, ghosts or Show me (only the mistake glow and label).
- Workbench rules: only kit ids, legs that `legsValid` accepts (any orientation), one leg or wire
  end per hole, one wire per pin; moving ignores the part's own holes; a wire runs from a pin or a
  hole to a hole, two different ends, while the kit has a wire left. Reasons: `That hole is already
  used.`, `That part does not fit there.`, `Wires go from a pin or a hole to a hole.`, `A wire needs
  two different ends.`, `You have used every wire in the kit.` Learner wires are `u1`, `u2` ...
  (first free); prebuilt wires keep their ids. Undo keeps 50 snapshots; load and reset clear it.
  Events `load`, `place`, `move`, `remove`, `wire`, `unwire`, `undo`, `reset`.
- Storage `robo-learn:build`: `{ [lessonId]: { parts: [{ id, legs }], wires: [{ id, from, to,
  color }] } }`, saved after every change. Loading validates each item (known ids, valid legs, free
  holes, wire ids `u<n>` or reference ids, known colours, the wire count) and drops what fails; no
  record (or a broken one) starts from the prebuilt items.
- Wire colours (`autoWireColor`): from 5V, 3.3V or VIN red, any GND black, A0 to A5 green, other
  pins yellow; from a hole the colour of the first pin in its net, else red on a + rail, black on a
  - rail, else blue.
- Edit circuit (view controls, hidden on lessons with neither a reference circuit nor a kit): on
  turns placement and the
  tray on and press, turn and meter clicks off, and moves the camera to the top view of both boards
  unless the learner orbited since the last view change; off reverses it and returns to the 3D view
  if edit mode moved the camera. It follows the step: each new current step turns it on for build
  and wire steps and off for the others; the learner's own toggle sticks until the step changes.
- Placement modes: `idle`, `carry` (fixed shapes, `R` cycles orientations), `bend` (resistor, ldr:
  two clicks) and `wire` (two clicks, repeats). A click is a pointer up within 5 px of its down
  (8 px for touch, which works by taps: see "Layouts and touch"). The
  ray meets the breadboard and Uno header planes, then `nearestHole` / `nearestPin`. In idle,
  clicking a part picks it up, clicking a wire (or the hole or pin it ends in) selects it; Delete
  or Backspace removes the selection, Escape steps back. The ghost is the part or wire at 0.5
  opacity, tinted towards red when it does not fit; strips under the legs light `info` or `bad`,
  the hovered strip `hover`. The hole tooltip shows the hole and `placeLabel` of its place.
- Status copy (in the tray): `Pick a part from the tray, or click a placed part to move it.`,
  `Click a hole for the long leg. R turns it. Escape puts it back.` (LED), `Click to place. R turns
  it. Escape puts it back.`, `Click to place. Escape puts it back.`, `Click a hole for one end.`,
  `Click a hole for the other end.`, `Click a pin on the Uno or a hole.`, `Press Delete to remove
  this wire.`, or the reason a candidate does not fit.
- Tray (`#parts-tray`, bottom centre): `Parts`, one button per kit part (icon, `partLabel` against
  the kit, `In the tray` / `Placed` / `Built earlier`), `Jumper wires` (`3 of 4 left`,
  aria-pressed), `Undo`, `Reset circuit` (second click within 3 s: `Click again to reset`), the
  status line (role="status"), a `Colour` select in wire mode, and the keyboard row: `Hole`
  (`#place-hole`) and `Place` while carrying, `From` (a pin for wires) and `To` while bending or
  wiring; a bad name shows `There is no hole called <text>.`
- Window keys while placing: arrows move the target a column or row, `R` turns, `Enter` places,
  `Escape` cancels, `Delete` removes; ignored in inputs, selects and textareas except Escape in
  the tray, and Enter is left to a focused button.
- Run lock: the flow's lock first, then while the lesson has a reference and `compare(build,
  reference).match` is false: `Fix the short circuit to unlock Run.` when the diagnosis has a
  `short`, else `Finish the circuit to unlock Run.`; re-checked after every workbench change, and a
  running sketch stops when the build stops matching.

## Layouts and touch

- Three layouts from the width of `#app` (`layoutFor` in `src/ui/layoutMode.js`): `wide` (>= 1200
  px), `medium` (900 to 1199) and `compact` (< 900). `createLayout` sets `data-layout` on `#app`
  with a ResizeObserver; every mode rule in `style.css` keys off `#app[data-layout=...]`, not media
  queries, so tests and the preview can force a mode by setting the attribute.
- Wide: the phase 1 grid (guide, workbench, code panel columns). Its parts for other modes (View
  button, Controls button, chevron icons) are hidden.
- Medium: columns `var(--guide-w-medium)` (280 px) and the workbench. The code panel is an absolute
  drawer over the right of the workbench (`grid-row: 2; grid-column: 1 / -1; top: 0; bottom: 0;
  right: 0; width: min(420px, 60vw)`, z-index 5, shadow); closed, it is a 36 x 96 px Code tab
  centred on the right edge. The run bar max width is `calc(100% - 420px)` (wide too), clear of the
  view buttons with Explain.
- Compact: one column, the top bar shows only `1.2 Blink`, `Step 2 of 6`, 32 px chevron Prev and
  Next and Course map; the course map fills the screen under the top bar; the run bar spans the top
  (8 px margins) with the status and readout on one line each (ellipsis, full text in `title`); the
  view buttons fold into a View popover below it on the right; the controls dock folds behind a
  `Controls` button at the bottom left above the peek (hidden while the dock is empty or the tray
  shows); the tray spans the width just above the peek and its items scroll sideways; the board
  tour card is a strip above the peek with its checklist in one sideways row; pinned labels are
  11 px, at most 160 px wide. Body text stays at least 14 px and labels 12 px.
- Bottom sheet (`createBottomSheet`, compact only): `#bottom-sheet` at the bottom of the workbench,
  full width, 12 px top corners, z-index 6, in `data-state` `peek` (132 px), `half` (50 %) or
  `full` (100 % less 8 px); the height animates 0.2 s except under reduced motion or while
  dragging. Header: a handle button (`Resize the lesson panel`; click or Enter toggles peek and
  half, ArrowUp and ArrowDown expand and collapse one state, a pointer drag moves the sheet and
  snaps with `nextSheetState` on release, and the click after a drag is ignored), the `Steps` and
  `Code` tabs (WAI-ARIA tabs with `nextTabIndex`; a tab clicked while peeking opens the sheet to
  half) and `Expand` / `Collapse` (aria-expanded; Expand opens full, Collapse returns to peek). The
  peek slot (sheetPeek.js) shows only in peek, the tab panels only in half and full.
- Moving the panels: main.js makes the sheet right after the layout, before the scene, so the stage
  starts at its real size. `setActive(true)` (compact) leaves a comment placeholder where
  `#guide-panel` and `#code-panel` were and appends those same elements to the Steps and Code
  panels; `setActive(false)` puts them back. Nothing is rebuilt: the editor keeps its text, caret,
  listeners and full screen. In the sheet the code panel always shows its body (no rail, no Hide
  code chevron). Leaving compact resets the sheet to peek. A step that opens the code panel
  selects the Code tab, and one that closes it the Steps tab, only when the sheet is not peeking.
- Touch placement (`placement.js`): pointers with `pointerType === 'touch'` have no hover (touch
  moves and leaves are ignored). A tap (pointer up within 8 px of its down, one finger; a second
  finger leaves the gesture to the camera) moves the target to the hole or pin under it and shows
  the ghost and the hole tooltip for 2 s, but does not place; in idle it picks up a placed part or
  selects a wire as a click does. `getState().touchReady` is true while a tapped target waits
  (touch, edit mode, not idle, a target that is not the first end); the tray then shows `Place`
  (confirm), `Turn` (rotate; only while carrying a part with more than one orientation) and
  `Cancel` (Escape). After a first end or a wire is placed by touch the target clears, so Place
  waits for the next tap. A mouse pointer down turns touch off again.
- Hover only steps on touch (1.1 Find the strips): a tap on a hole calls `onHover` for that hole,
  so it counts as a strip hover, and shows the tooltip for 2 s.

## Sims and goal checks

- Run sends the learner's sketch (the code panel text) through the code runner
  in `src/runner/`. The lesson sim is a board: the circuit around the sketch and
  the goal. It is made by `create({ pins, inputs, room, tones, servos, serial,
  getValues, startedAt, getCode })` and returns:
  - `levels(now)`: the input levels the circuit puts on the sketch's pins
    (0 to 1, or null when it does not drive the pin), sent to the code runner
    when they change;
  - `output({ kind, pin, value, at })` (optional): each sketch output event,
    after the runner applied it, with `at` on the same clock as `now`;
  - `update(now)`, `reload(now)`, `stop()`, `checkGoal()`, `readout()`, all
    optional.
- `getCode()` gives `analyzeCode` of the code now running, for goals that
  inspect the code (like `countCalls(getCode(), 'delay')`). Input events
  (`kind: 'input'`) reach `output(event)` too, so `createResponseTimer` can time
  how fast the sketch reacts, on the sketch clock.
- `getValues()` gives the live code panel param values. Only circuit params
  (`circuit: true`) change the board; the others are numbers in the code.
- `src/sim/sims.js` exports `sims`, keyed by lesson id. Lessons without an entry
  have no Run controls.
- Pin levels live in one shared `createPins()`: a number from `0` to `1`, unset
  pins read `0`. Digital pins use `0` (LOW) and `1` (HIGH). An analog input is its
  voltage as a share of 5 V; a PWM output is its duty cycle, the `analogWrite`
  value / 255. The runner writes sketch outputs into it; Stop resets it to `0`.
- `tones` is a second `createPins()` holding a tone frequency in Hz per pin, 0
  for silent, written from tone events; Stop resets it like the pins.
- `servos` is a third `createPins()` holding a servo arm angle in deg per pin.
  The 1.12 board moves it towards the commanded angle. Stop leaves it as it is,
  because a real servo holds its angle.
- `serial` is the port shared with the Serial Monitor. The runner prints the
  sketch's serial text into it; the monitor's Send goes to the running sketch.
  A lesson change clears the output.
- A board may return `readout()`, a short string. The runner `getReadout()` gives
  it while running, else `''`, and `runControls` shows it under the status.
- The run bar says `Goal met.` once the sim goal is met (the lesson is done only when every step
  passed).
- Run first compiles the code (`checkCode`); an error stops there with its line.
  Then a fake upload of `UPLOAD_MS` (1500 ms), then the runner creates the board
  and starts the code runner. A runtime error stops the run in the `error` phase.
- Moving a slider while running reloads the refilled sketch at once
  (`runner.reload`), keeping the board and its goal progress. Edited code waits
  for the next Run, like a real upload.
- The runner calls `onGoal(lessonId)` once per run when `checkGoal()` first
  returns true. It never calls `markComplete` itself. `main.js` marks the lesson
  done in `onGoal` only when its steps are the generated one (`legacy`); a lesson
  with its own steps is marked done by the flow once every step passed.
- A board may return `progress()`, an object of named booleans that lesson steps
  check (`{ type: 'sim', progress: 'name' }`). The names are fixed: blink (1.2)
  `blinked`, `fast`; ohms (1.3) `measured220`, `measured1000`, `measured10000`;
  button (1.4) `pressedOnce`; pullDown (1.5) `floated`, `pressedOnce`; pot (1.6)
  `seenLow`, `seenHigh`; fade (1.7) `rampSeen`; rgb (1.8) none; light (1.9)
  `turnedOn`; temp (1.10) `seenCool`, `seenWarm`; tune (1.11) `played`; sweep
  (1.12) `reached45`, `reached90`, `reached135`; monitor (P1) none.
- `runner.getProgress()` is `{}` unless the phase is `running`; then it is
  `{ ran, goal, ...board.progress() }`, where `ran` is true once the board has run
  for `RAN_MS` (1000 ms, by the last `tick(now)`) and `goal` is `isGoalMet()`.
- `test/lessonGoals.test.js` runs every lesson sketch through the runtime, its
  board and the runner (the `createHeadless` drive pattern in `src/sim/headless.js`), and checks that each goal fails at the defaults and passes
  after the learner's action. Keep it passing when a lesson changes.
- The circuit view (`src/app/circuitView.js`) subscribes once to `pins`. On a change it calls `setBrightness(level)`
  on every LED in the current circuit whose `pin` matches, then `invalidate()`.
  A newly built circuit sets each LED from `pins.get(part.pin)`. Stop goes
  through `pins.reset()`, so it turns the LEDs off.
- `inputs` is one shared `createInputs()` of held buttons, set by `partPress`,
  and knob values from 0 to 1, set by `partTurn` and the Knob slider. Boards read
  it with `inputs.isPressed(id)` and `inputs.getValue(id)`. `subscribe` fires
  `(id, on)` for a press and `(id, value)` for a knob, only on a real change.
  Stop does not reset it, so a held button stays held until released.

## Lesson steps and checks

- A lesson may have `steps: [step, ...]` (every lesson since phase 6) and `prebuilt: [ids]`. A step
  is `{ id, kind, title, body: [1 to 3 paragraphs], check, hint?, done?, showMe?, parts? }`.
  Ids are kebab case and unique in the lesson. Kinds: `learn`, `explore`, `build`,
  `wire`, `predict`, `run`, `code`. Build and wire steps have `parts` (the kit ids the
  step places, empty for wire steps) and a `circuit` check; they would stay hidden if
  `BUILD_STEPS_ENABLED` in `steps.js` were false. Lessons without steps get one
  generated step whose check is `legacy`.
- `evaluate(step, ctx)` in `src/course/checks.js` returns `{ passed, items: [{ text,
  ok }], feedback: null | { tone: 'good' | 'bad' | 'info', text } }`. Check types:
  - `legacy`: passes when `ctx.lessonCompleted`; item `Meet the goal`.
  - `quiz` `{ question, options, answer, explain }`: passes when the stored answer
    is `answer`; item `Answer the question`; feedback after an answer, `bad` with
    the picked option's explain or `good` with the right one's.
  - `predict` `{ question, options, answer, explain, then }`: a guess is stored and
    the `then` sim check passes; items `Make a guess` plus those of `then`;
    feedback `info` `Now press Run and watch.` after a guess, then `good` with the
    right explain when the guess was right, else `info` with the picked one's.
  - `sim` `{ progress: 'name', text }` or `{ goal: true, text }`: the key is ok in
    `ctx.sim.progress` now or is latched for this step.
  - `code` `{ rule: 'compiles', text }`: `ctx.code.error` is null; else feedback
    `bad` `The sketch does not compile. <message>`.
  - `tour` `{ text }`: `ctx.tour.complete`, or `ctx.stepPassed`.
  - `event` `{ items: [{ text, event, count }] }`: `ctx.events` holds what the learner did while the
    step was current (memory only, reset on a step change): `strip-hover` a Set of places hovered,
    `part-moved` and `part-returned` counts of workbench `move` and `remove` events. An item is ok
    when its count (the Set size) is at least `count`, or the step is stored as passed
    (`ctx.stepPassed`). Hovering works on explore steps with an event check through hover only
    placement.
  - `circuit` `{ items: [{ text, rule }], pass? }` (a null reference counts as an empty one, so
    1.1's item rules work and its mistakes come from `diagnose` with an empty reference): one `createRuleContext(build,
    reference)` per evaluation; items are `{ text, ok: evaluateRule(rule) }`; passes when
    every item and `pass` (when given) are true. When not passed, `attempts > 0` and not
    `busy`, feedback is `{ tone: 'bad', text, targets }` from the first mistake of
    `diagnose(build, reference, { only: scope })` on build steps or `diagnose(build,
    reference)` on wire steps (none when there is no mistake). Results are cached per build
    object and step.
  - `all` `{ checks }`: every inner check passes; items in order, the first non
    null feedback.
- The context: `{ lessonId, lessonCompleted, answers, latched, stepPassed, events, sim: { phase,
  progress }, code: { error }, tour: { complete }, build, reference, scope, attempts,
  busy }`. `main.js` builds `sim`, `code` (checkCode of the code panel source, cached
  by source), `tour`, `build` (one object per workbench state), `reference`, `scope`
  (`scopeFor` of the current step), `attempts` (workbench changes since the step became
  current) and `busy` (a part carried or bent, or a wire half drawn); the flow adds
  `lessonId`, `lessonCompleted`, `answers` and `latched` from the course and the
  tracker, and starts every new current step with `attempts: 0`.
- Latching: on every update the flow latches each sim key of the current step that
  is ok now (`tracker.latch`), so progress made in one run survives Stop. A step
  stored as passed counts its sim keys as latched and its answer as given, so its
  items stay ticked after a reload; code items stay live.
- Flow rules (`src/course/flow.js`): `update(ctx)` evaluates the current step,
  latches, stores a pass once (`markPassed`) and, when every step passed and the
  course does not list the lesson, calls `course.markComplete` once. A pass is stored as
  helped when the step's hint level is 3 (Do it for me). `raiseHint(level)` raises the
  current step's hint level (never lowers it, nothing once passed). `next()` moves
  on only from a passed step and does nothing on the last. `answer(stepId,
  option)` works on the current step until it passes. `toggleOpen(index)` opens
  or closes done cards. `runLock()` is `Make a guess first.` on a predict step
  with no guess, else null. A lesson the course lists as done with no tracker
  record gets `completeAll` on first view. A lesson change resets the flow's
  context to idle, so an old run never counts. Subscribers hear only real view
  changes. The view: `{ lesson, steps: [{ step, status: 'done' | 'current' |
  'locked', passed, helped, open, result, answer, hintLevel }], index, result,
  targets, passedNow, lessonDone }`; `targets` are those of the current feedback, or null.
- Step progress is saved under `robo-learn:steps`: a JSON object keyed by lesson id
  of `{ current, passed, helped, answers, latched, hintLevels }`. Loading drops
  unknown lesson and step ids, wrong types and non integer indexes, and clamps
  `current`. `reset` keeps an empty record, so a reset lesson is not migrated
  again.

## Build steps and hints

- Scope: `scopeFor(lesson, index)`, the lesson's prebuilt ids plus the `parts` of this and
  every earlier build or wire step. Build step mistakes look at the scope only, so a part a
  later step adds is never named.
- Suggestions (`src/circuits/suggest.js`, pure). Build steps: for each part of `step.parts`
  not placed or not right, try its reference legs (its own holes count as free), then the
  reference legs shifted like the nearest related placed part (same column offset, rows
  within their half), then a search (fixed shapes: every anchor and orientation; bend
  shapes: pairs starting in a place the part must join), nearest to the reference legs
  first, at most `SEARCH_LIMIT` (3000) tries. The last part must make the step pass; earlier
  ones must `compare` right with the parts so far. Wire steps, per pin (GND pins are one):
  each reference wire whose parts the pin does not reach gets a wire from that pin to the
  free hole nearest the reference end in the build net holding those parts; wrong learner
  wires from that pin, and any from pins the reference does not use, come first as
  `unwire`. When no one build net holds every part a reference wire reaches (P1: the LED and the
  buzzer share GND through a reference jumper), the pin goes to the net holding most of them and
  hole to hole jumpers join the others. Earlier parts of a build step are compared without wires
  from pins. `joinPlaces` gives the places a build step's parts must join, `pendingPins` the
  pins still to wire, `suggestionLabels` the label text: `long leg: 9e`, `short leg: 10e`,
  `ends: 5c and 9c`, `<terminal label>: <holes>`, `D13 to 5a`.
- Hint ladder, levels per step in the tracker (`hintLevels`, 0 to 3), shown in the current
  card until the step passes: a `Stuck?` row with `Hint` (`Need a hint?` on lessons with
  `project: true`), then `Show me` from level 1 (build and wire steps where `canSuggest`: a reference
  circuit and a circuit check; code steps with `showMe`),
  then `Do it for me` from level 2 (build and wire). Buttons are `aria-pressed` once their
  level was used. Level 1 shows `Hint: <step.hint>`, or the current mistake, or
  `Look at the checklist: the first item without a tick is the next thing to do.` Level 2
  adds `Show me: <label texts>.` (or `Show me: Lines 10 and 12: try 200.` on code steps,
  whose lines get `markLines`). Level 3 applies `suggest` through the workbench (unwire,
  place, add wire); the step is stored as helped when it passes and the success box says
  `Helped`. When the pass removes the focused rung, focus moves to Continue.
- Level 0, on build and wire steps that have not passed: the tray pulses the step's parts,
  the places from `joinPlaces` glow `info`, and on wire steps the `pendingPins` get rings
  (`board.highlightPins`). Level 2 adds the suggestion as accent ghosts and `info` labels,
  recomputed after every change.
- Auto nudge (`createNudge`, non project lessons): a `bad` feedback on the current step, or
  `NUDGE_MS` (40 s) with no checklist change and no workbench change, raises it to level 1.
- Mistakes: the current feedback's `targets` places (and the places of its holes) glow
  `bad`, and one `bad` label with the mistake text sits at its first hole, else its first
  pin. Labels (`src/ui/labels.js`) are aria-hidden; the guide carries the same text.
- Step marks show only while edit mode is on; `src/ui/stepMarks.js` draws them. Kit parts
  of later build or wire steps show `Later` in the tray and cannot be picked up.

## Explain tools

- An `Explain` button sits with the view buttons (`viewControls.addGroup`; in compact inside the View
  popover, which hands over to the Explain popover). The popover (`#explain-menu`, `explainMenu.js`) has
  one row per tool: toggles (`X-ray`, `Connections`, `Slow motion`, aria-pressed), choices with a select
  and `Show` (`Trace the current from`, `Part card for`, `What if`, `Scope on`) and an input with `Show`
  (`Measure voltage at`, Enter runs it). A row that cannot work is disabled with its reason in muted text
  under it; the status line (role="status") shows the last tool text. Escape closes it and returns focus
  to Explain (View in compact); a pointer down outside closes it. It stays open after a tool runs.
- `src/explain/tools.js` `createExplainTools(deps)`: one async function per tool returning `{ ok, text }`;
  arguments are checked and a tool that cannot work returns `{ ok: false, text }`, never throws. Reasons:
  `This lesson has no circuit to explain.` (trace, connections and what if on a lesson with no reference
  circuit, 1.1), `Wire a pin first.`, `Run the sketch first.`, `This lesson has no parts.`, `Place an LED
  first.` Phase 9's chat calls the same functions.
- Cards (`explainCards.js`): one stack (`#explain-cards`) at the top right of the workbench under the view
  buttons, 340 px wide (full width less 16 px in compact, top 110 px; under the moved run bar when the
  workbench is under 640 px; above the open code drawer in medium), each with a title and `Close`
  (aria-label `Close <title>`). At most two: a third closes the oldest; the same kind replaces itself.
- A lesson change closes every card, clears the trace and the meter label and turns X-ray off; the run
  stops, which ends slow motion.
- No tool changes the learner's build, steps or progress. Slow motion never completes a goal.

| Tool | Module | Text |
| --- | --- | --- |
| `xray(on)` | `breadboard.setXray` | `The breadboard is see-through. Each metal bar joins the holes above it.` / `X-ray is off.` |
| `trace(pin)` | `currentPath.js`, `currentTrace.js` | `Current flows from <pin> through the <part>, then the <part>, to GND.`, `Current reaches the LED but cannot get through: the LED is in backwards.`, `The current stops at <place>. Nothing there leads on to GND.`, `Nothing is wired to <pin> yet.` |
| `scope(pin, seconds)` | `scopeBuffer.js`, `scope.js` | `<pin> is HIGH for about <n> ms, then LOW for about <n> ms: one cycle every <n> ms.`, `<pin> stays HIGH.`, `<pin> averages <n>% on (analogWrite about <v>).`, `<pin> has not changed since Run.` |
| `connections(compare)` | `connections.js`, `connectionsCard.js` | `<n> connections. <m> match the lesson circuit.` or `<n> connections.` |
| `part_card(part)` | `partInfo.js`, `partCard.js` | the part's summary |
| `measure(target)` | `voltages.js`, multimeter Voltage mode | `<place> reads <v> V.` or `<place> has no fixed voltage right now.` |
| `slow_motion(speed)` | runner `setSlowMotion` | `The sketch now runs at a tenth of its speed, with the running line lit up. Goals are paused.` (0.25: a quarter); 1 turns it off |
| `what_if(kind, target, value)` | `whatIf.js`, `whatIfCard.js` | `Now: one cycle every 1000 ms. With line 10 changed: one cycle every 600 ms.`, `Now: the LED lights. With the change: the LED stays dark, because the current cannot get through it backwards.` |

- X-ray: see breadboard.js. Trace: eight 0.035 cm accent spheres move along the hops at 2 cm per second
  for 6 s (wire hops follow the wire curve, strip hops 0.05 cm and part hops 0.3 cm above the board); a
  red ring and the label `The path stops here` mark a stop; reduced motion draws a still tube for 6 s. A
  held button counts as pressed. The pin list is the wired pins without GND.
- Scope: the runner's `subscribeOutput` feeds one scope buffer (10 s window), cleared on each Run. The
  card plots the last 5 s from the menu (1 to 5 s from the tool) on `runner.getClock()`, redrawing at most
  30 times a second while running and freezing when stopped; the summary (aria-live polite) changes at
  most once a second and uses the whole window when the last seconds hold no full cycle.
- Connections: hovering or focusing a row lights its places (`placement.setOverlay`, `info`); the card
  follows every workbench change.
- Part cards: the menu choice or the tray ? opens the card for a kit id or a type.
- Measure voltage: the meter's Voltage mode (click or tap a hole, leg or wire end, or type in Point) or
  the menu row pins one label `<place>: <v> V` (`not set` for null) and shows it in the dock; it follows
  the pins as they change. While stopped every signal pin reads 0 V.
- Slow motion: `runner.setSlowMotion(true, speed)` sends `setTimeScale` and `setTrace(true)` to the code
  runner and makes the run a demo (no `onGoal`, `getProgress()` is `{}`) until the next Run; the run
  status shows `Slow motion. Goals are paused until you press Run again.`; line events light the editor
  line through `codePanel.setExecutingLine`, at most once a frame. Stop, an error or Run end it.
- What if: menu choices `Flip the <LED>`, `Use 1 kohm` / `Use 10 kohm` (`for the <resistor>` with more than
  one), `Take out the <part>`; code changes are for the chat (`what_if('code', line, text)`, two 3000 ms
  `runHeadless` runs). While the card is open the changed part shows as an accent ghost (the turned LED,
  the new bands, or the part at 20% with the real one hidden); any workbench change closes the card.

## Help chat

- Off unless the build sets `VITE_TUTOR=on` (Vite reads it from `.env.local`, copied from the
  committed `.env.example`). Off, nothing of it exists: no tabs, no Ask pane, no requests. On, the
  guide has `Steps` and `Ask` tabs and the compact sheet `Steps`, `Code` and `Ask`; the Ask pane
  is one element that moves between them (main.js `applyLayout` hands the selected tab over).
- Server: `npm run tutor` (`server/tutor.mjs`), port `TUTOR_PORT` (7300); `vite.config.js` proxies
  `/api` to it for `dev` and `preview`. Only `POST /api/tutor`, anything else 404. The body is
  `{ messages }` (at most 200 KB, else 413), checked by `validateRequest`: 1 to 80 messages, roles
  alternate from the learner and end on the learner (or on a paused assistant turn); learner
  blocks only `text` (8000 characters) and `tool_result` (`tool_use_id`, `content` of 4000
  characters at most, optional `is_error`); assistant blocks passed through unchanged (`text`,
  `tool_use` of a known tool, `thinking`, `redacted_thinking`, `fallback`; 40000 characters as
  JSON); every tool use answered in the next learner message. Then a rate limit by remote address
  (20 in ten minutes, 300 a day; 429 `rate_limited`), then
  `client.beta.messages.create(buildApiRequest(messages))`, non streaming. Reply
  `{ content, stop_reason }`. Errors, most specific first: authentication, permission or missing
  credentials 500 `not_configured`; rate limit or overload 503 `busy`; any other 502 `failed`; a bad
  body 400 `bad_request`. At start a model lookup (no tokens) finds missing credentials; then
  every request answers `not_configured`. Credentials: `ANTHROPIC_API_KEY` (from `.env.local`,
  loaded with `process.loadEnvFile`) or an `ant auth login` profile. One log line per request
  (time, status, stop reason, token usage), never message text.
- Request (`buildApiRequest`): model `claude-opus-5-5`, `max_tokens` 16000, `output_config.effort`
  `low`, server side fallbacks on (`betas: ['server-side-fallback-2026-07-01']`, `fallbacks:
  'default'`), top level `cache_control`, the fixed `SYSTEM_PROMPT` (09-help-chat.md 9.5) and
  `TOOL_DEFINITIONS`. No `thinking` (Opus 5.5 always thinks adaptively), no sampling settings, no
  forced `tool_choice`. Tools and system never change, so the prompt cache hits.
- Gemini (`TUTOR_PROVIDER=gemini`, owner's choice): the same server, checks, prompt, tools and
  browser side; `server/gemini.mjs` translates. `GEMINI_API_KEY` (from `.env.local`) and
  `GEMINI_MODEL` (default `gemini-flash-latest`); `@google/genai`
  `models.generateContent({ model, contents, config: { systemInstruction: SYSTEM_PROMPT, tools:
  [{ functionDeclarations }], maxOutputTokens: 16000 } })`, the tool schemas as
  `parametersJsonSchema`. A model turn comes back to the browser as `[{ type: 'gemini_parts',
  parts }, ...text, ...tool_use]`; the raw parts (with their thought signatures) go back to Gemini
  unchanged, and `validateRequest(body, { provider: 'gemini' })` is the only one that accepts
  `gemini_parts`. Calls without an id get `gemini_call_N`, answered without an id; results go back
  as `functionResponse` `{ name, response: { result } | { error } }`. Thought parts are never
  shown. Stops: tool calls `tool_use`, `STOP` `end_turn`, `MAX_TOKENS` `max_tokens`, a blocked
  prompt or a safety, recitation, blocklist, prohibited or SPII stop `refusal`, any other stop
  502 `failed`. Errors: no key, or a key `models.get` rejects at start (400, 401, 403),
  `not_configured`; `ApiError` 401 or 403 `not_configured`, 429 or 503 `busy` (a 503, Gemini's
  "high demand", is first tried twice more, 1 s and 2 s later), else `failed`.
  There are no server side fallbacks on Gemini.
- `TUTOR_FAKE=1`: no API calls; a learner question gets `Let me show you the strips.` with `xray`
  on and `highlight` `9-top`, tool results get `Each metal bar joins five holes. Which strip holds
  the long leg of your LED?` (`fakeReply`).
- State block (`src/tutor/context.js`): the first text block of every learner turn,
  `<workbench_state>` JSON `</workbench_state>` with `lesson`, `step` (id, kind, title, text,
  checklist, passed), `hints` (`level`, `exact_positions_allowed` from Show me on), `mistake`,
  `circuit` (parts with labels and legs, wires, connections as labels; null without a circuit),
  `code` (`N: ` numbered, 150 lines at most; null without a sketch), `code_error` and `run`
  (phase, readout, progress). The question is the second block. Tool result turns carry none.
- Chat loop (`src/tutor/chat.js`): memory only, one conversation per lesson (reset on a lesson
  change and by `New chat`). The history is append only. Each question loops at most 6 requests:
  the assistant content is appended as returned; `tool_use` runs the first 4 tool uses in order
  (more get `is_error` `Too many tools in one reply.`) and appends one learner message with a
  result for every id; `end_turn` and `stop_sequence` end; `max_tokens` ends with `(This answer
  was cut short.)`; `refusal` shows `I cannot help with that. Ask me about your circuit, your code
  or this step.`; `pause_turn` asks again. A failed request or a refusal takes the question back
  out of the history. Results left unsent at the request limit go out with the next question.
  Past 60 messages the next question starts a new conversation (`This chat got long, so it
  started fresh.`). Errors show as muted helper turns: `not_configured` and no server (a network
  error, or a 5xx without our JSON from the dev proxy) `The help chat is not available right
  now.`, `rate_limited` `You have asked a lot of questions. Try again in a few minutes.`, `busy`
  `The helper is busy. Try again in a moment.`, anything else `Something went wrong. Try asking
  again.`
- Tools (`src/tutor/toolDefs.js`, run by `src/tutor/tools.js`): every input is checked against its
  schema and the limits strict schemas cannot carry; a bad call returns `is_error` with one
  sentence. `highlight` (a hole as its strip, a strip, a rail, a pin or a placed part:
  `placement.setOverlay` info, `board.highlightPins` or an accent ghost of the part, 4 s),
  `pin_label` (ASCII, 40 characters, 6 s, on the explain label layer as `chat`), `move_camera`
  (`viewControls.setView` around the target or a board), `point_to_code` (opens the code,
  `markLines` for 8 s, then the step marks again), `show_placement` (build and wire steps, a part
  of the step's scope, after a hint, else `Show me is not available yet. Give a hint in words
  first.`; raises the hint to 2, which draws the phase 5 Show me ghosts and labels),
  `trace_current`, `xray`, `connections`, `part_card`, `scope`, `measure`, `what_if`,
  `slow_motion` (the phase 8 functions from `explain.tools`; their text is the result, and a
  "cannot work now" text such as `This lesson has no circuit to explain.` is a normal result, not
  an error), `demo_input` (a running sketch; `runner.beginDemo()`, then a placed button through
  `partPress`, a knob through `partTurn`, or the room light or temperature when the circuit shows
  that slider; the old value comes back after 1 to 5 s; the run bar says `Demo run. Goals are
  paused until you press Run again.`), `suggest_code` (one `Serial.print` or `Serial.println`
  statement after a line that exists: `codePanel.offerLine`), `quick_check` and `predict` (2 to 4
  options; cards in the log whose option buttons send `My answer: ...` or `My guess: ...`),
  `open_reference` (the Reference drawer on that tab), `recall` (a quote card of any lesson step),
  `next_hint` (one level up, never past Show me). A tool's chip (`X-ray`, `Lit up 9-top`, `Traced
  the current`, `Scope on D13` ...) shows under the reply that called it.
- Privacy and safety: the key stays on the server; the server accepts only the checked message
  format and uses its own prompt and tools; no chat text in localStorage, the server log or
  anywhere else; no chat tool changes the build, the code (Add line is the learner's own edit) or
  progress, and none passes a step (demo runs pause goals until the next Run, as slow motion does).
- Ask pane (`src/ui/askPanel.js`): `New chat`, the log (`role="log"`, `aria-live="polite"`;
  learner turns right on ink, helper turns left on soft, muted errors, chips and cards under the
  reply, `Thinking...` while busy, scrolled to the newest), the empty state `Ask about your
  circuit, your code or this step. The helper can point at things and run small experiments.
  Chats are not saved.` with up to three suggestions by step kind, and the form: `Your question`
  (`#ask-input`, 500 characters, Enter sends, Shift Enter adds a line) and `Send`, both disabled
  while busy; the question box gets focus back after each answer.

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

Level 1 now: 1.1 Meet the Uno and breadboard (board tour, then breadboard basics), 1.2 Blink to
1.12 Servo basics, and the project P1 Room monitor.

Levels: 1 Basics (12 lessons), 2 Programming properly (8), 3 Communication (8),
4 Robot hardware (8), 5 Beyond the Uno (7). Each level ends in a project. Every
lesson has a goal check, so finishing means meeting the goal, not clicking Run.
The full list with parts and goal checks lives in the Privasi curriculum doc.
