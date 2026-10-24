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
`src/runner/worker.js`, `src/runner/codeRunner.js`, `src/runner/codeChecks.js`, `src/sim/responseTimer.js`. The other
folders are the target for later jobs.

```
src/
  main.js          boot: composes the layout, scene, course engine, step tracker and flow, stores, runner
                   and UI; on every lesson change shows the lesson circuit through the circuit view, then
                   points the per lesson controls (hold button, knob, meter, room, sound, servo centring) at
                   its parts; builds the step check context (currentContext) and feeds it to the flow each
                   run frame, on Stop, lesson change, tour completion and 300 ms after a code edit; opens
                   the code panel on predict, run and code steps and closes it on the others
  style.css        CSS tokens on :root (--ink, --line, --panel, --accent, --topbar-h, --guide-w, --code-w,
                   --rail-w...); #app is a grid: #top-bar across row 1, then #guide-panel, #workbench
                   and #code-panel; #stage fills the workbench (position absolute) and the workbench
                   overlays (#run-bar, #view-controls, #controls-dock, .tour-card) float over it; a
                   container query stacks the run bar under the view buttons on a workbench under 640 px
  app/             composition helpers for main.js
    scene.js       createScene(stageEl) -> { stage, board, breadboard, frameBox() }: the Uno left and the
                   breadboard right, 1 cm apart, centred on x = 0; frameBox() is the box around both as
                   plain { min, max } objects
    circuitView.js createCircuitView({ stage, board, breadboard, pins, servos, tones, getValues }) ->
                   { show(table | null), items(), table(), relight(name?), showParts(values) }: show removes
                   and disposes the old circuit group, builds the table, lights its LEDs and applies
                   showWhen, returning the new items; LEDs follow pins, the servo horn servos and the
                   buzzer ring tones
    storage.js     getStorage(): localStorage, or an in memory stand in when it is blocked
  course/          lessons data, state, goTo(id), progress; 1.1 to 1.12 then the Level 1 project P1
                   createCourse({ lessons, storage }): goTo, next, prev, markComplete, subscribe; hash #<lesson id>; progress key robo-learn:progress
    goalText.js    pure splitGoal(paragraphs) -> { intro, goal }: goal is the text after 'Goal: ' in the first
                   paragraph that has it; every other text stays in intro (goal null when there is none)
    steps.js       pure stepsFor(lesson) -> step[]: lesson.steps when given (without build and wire steps
                   while BUILD_STEPS_ENABLED is false), else one generated step { id: 'goal', kind: 'run',
                   title: 'Goal', body: [goal], check: { type: 'legacy' } }, or for a lesson with a tour kind
                   'explore', title 'Tour the board'; hasGeneratedSteps(lesson); CODE_OPEN_KINDS; STEP_KINDS
    stepTracker.js pure createStepTracker({ storage, lessons, stepsFor }): get(lessonId) -> { current, passed,
                   helped, answers, latched, hintLevels }, has, setCurrent, markPassed, answer, latch,
                   setHintLevel, reset, completeAll, subscribe; key robo-learn:steps
    checks.js      pure evaluate(step, ctx) -> { passed, items, feedback }; CHECK_TYPES; simKey, simKeys(check)
    flow.js        pure createFlow({ course, tracker, stepsFor, evaluate }): getView, update(ctx), answer, next,
                   toggleOpen, runLock, subscribe (see "Lesson steps and checks")
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
                   of { line (1 based), ms (number or a range param name) }
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
    unoBoard.js    createUnoBoard() -> { group, zones }, 1 unit = 1 cm; UNO_ZONE_IDS for the six clickable zones;
                   PITCH (0.254); UNO_PIN_NAMES and unoPinPosition(name) -> board local Vector3 at the hole top
    breadboard.js  createBreadboard() -> { group }, half size, 30 columns, four power rails with red and blue
                   stripes (hole marks named 'hole', stripes 'stripe'); re-exports the grid from
                   src/circuits/holes.js; holePosition(hole) local Vector3, rails included
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
    buildCircuit.js buildCircuit(circuit, { board, breadboard }) -> { group, items }; pins and holes
                   to world positions, one factory result per id, item group name = id; a wire end is a
                   hole when isHole(name) (rails included); re-exports buttonHoles, potHoles, rgbHoles and
                   buzzerHoles from footprints.js
    holes.js       pure hole grid: BREADBOARD_COLUMNS, BREADBOARD_ROWS, RAIL_ROWS, ALL_ROWS, ALL_HOLES (420),
                   parseHole, isHole, holeName(column, row), rowPitchZ(row), rowAt(row, pitches), holeStrip
    footprints.js  pure PART_TYPES, TERMINAL_LABELS, legsOf, terminalHoles, footprint, orientationCount,
                   bendLegs, buttonHoles, potHoles, rgbHoles, buzzerHoles (see "Netlist and footprints")
    netlist.js     pure buildNetlist, canonical, compare, align, diagnose, normalizePin, placeOf, partLabel,
                   thingLabel, placeLabel, formatOhms (see "Netlist and footprints")
    rules.js       pure createRuleContext(build, reference), evaluateRule(rule, ruleContext)
  sim/             per lesson simulators, pin levels, goal checks
    tour.js        pure createTour(zoneIds): open, isOpened, openedCount, total, isComplete (lesson 1.1 goal)
    pins.js        pure createPins(): get(name), set(name, level), reset(), subscribe(fn); shared pin levels
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
                   isGoalMet, getReadout, getProgress; checkCode(source) compiles without running; UPLOAD_MS
                   (1500); RAN_MS (1000)
  runner/          code runner for learner code (Level 2 onward)
    lexer.js       pure lex(source) -> tokens { type, value, line, column } (number, string, char, ident, keyword,
                   op, include, eof); CodeError(message, line, column) with message 'Line N: ...'
    parser.js      pure parse(source) -> Program { includes, body } AST; top level VarDecl, Function, Prototype,
                   Enum; statements Block, VarDecl, ExprStmt, If, While, DoWhile, For, Switch, Break, Continue,
                   Return, Empty; expressions Number, String, Char, Bool, Ident, Assign, Conditional, Binary,
                   Unary, Update, Call, Member, Index, Cast, Sequence, InitList; types { name, const } with
                   enum names and LIBRARY_CLASSES (Servo); every node has line; errors throw CodeError
    interpreter.js pure createProgram(source, hw) -> { advance(untilMs), millis(), error }: generator based, virtual
                   clock (delay waits, STATEMENT_MS per statement), C int rules (truncating division, wrap on
                   store), Arduino built-ins, Serial, Servo and String methods; runtime CodeErrors stop it;
                   pinName(n) maps 0 to 13 -> D0 to D13 and 14 to 19 -> A0 to A5
    session.js     pure createSession(source, { random }) -> { advance(untilMs) -> batch, setInputs(levels),
                   sendSerial(text) }; batch { pins (0 to 1), tones (Hz), servos (deg), events ([ms, kind, pin,
                   value] for every change in order, kind 'pin', 'tone', 'servo', or 'input' when the
                   circuit changes an input level), serial, millis, error };
                   tone(pin, hz, ms) ends by itself at its own time; null or unset input pins read HIGH with
                   INPUT_PULLUP, else LOW
    worker.js      Web Worker: start, stop, inputs, serial messages in; started, batch and error messages out;
                   follows real time every 16 ms
    codeChecks.js  pure analyzeCode(source) -> { error, calls [{ name, line, inFunction }], functions, includes },
                   names as written ('delay', 'Serial.println', 'arm.write'); findCalls, countCalls, callLines
                   (each with { inFunction }), definesFunction; a parse error gives error, not a throw
    codeRunner.js  createCodeRunner({ onBatch, onError, createWorker, startTimeoutMs }) -> { start(source), stop(),
                   setInputs(levels), sendSerial(text) }; main thread client for the worker; a worker that
                   cannot load or does not send started within START_TIMEOUT_MS (4 s) reports START_FAILED
                   with line null, so Run never fails silently
  ui/              layout, top bar, course map, guide, info tabs, code panel, params, workbench controls
    layout.js      createLayout(app) -> { topBar, guide, workbench, stageEl, runBar, viewControls, dock, codePanel,
                   setCodeOpen(on), isCodeOpen(), subscribeCode(fn) }: builds header#top-bar, aside#guide-panel,
                   main#workbench (with #stage, #run-bar, #view-controls and #controls-dock inside) and
                   aside#code-panel; setCodeOpen toggles is-closed on the code panel
    topBar.js      createTopBar(container, course, { levels, onOpenMap, flow }) -> { mapButton }: Robo Learn, the
                   'Level 1 Basics / 1.2 Blink' breadcrumb, step progress from the flow (one 28 x 6 px segment
                   per step, good when passed, accent when current, line when locked, then 'Step 2 of 3' or
                   'Done'; the group's aria-label is 'Step 2 of 3' or 'Lesson done'), Prev and Next, and the
                   Course map button
    courseMap.js   createCourseMap({ container, course, levels, button }) -> { open, close, isOpen }: #course-map
                   dialog popover under the top bar with 'N of 13 lessons done', a progress bar and one button
                   per lesson by level (Done, Up next); opening focuses the current lesson, arrow keys move,
                   Escape closes and refocuses the button, a click outside closes; lessons are never locked
    guidePanel.js  createGuidePanel(container, { course, flow, tracker }) -> { referenceBody }: lesson header, an
                   ol.guide-steps from flow.getView() and a closed details.guide-reference hosting the info
                   tabs. One li per step: a row with an 18 px status icon (done tick, current ring and dot,
                   locked padlock), kind label and title; done rows are buttons (aria-expanded) opening a read
                   only card, locked rows are dimmed with aria-label '<title>, locked'. The current card shows
                   the body (generated steps show the lesson intro and Goal box instead), the question with
                   .guide-option buttons (aria-pressed; right good border, wrong bad border, predict accent),
                   the 'To pass' checklist, feedback, a Hint button, and once passed a success box ('Milestone
                   done' and Continue, or 'Lesson done' and the next lesson). Feedback and success sit in
                   persistent role="status" regions; a re-render keeps focus on the same control. 'Start this
                   lesson again' needs a second click within 3 s ('Click again to start over') and calls
                   tracker.reset
    viewControls.js createViewControls({ container, stage, getFrameBox }) -> { setView(kind, opts) }: Top view,
                   3D view and Reset view buttons; Top and 3D follow stage.getView() with aria-pressed
    infoPanel.js   createInfoPanel(panel, course, { heading = true }): lesson heading (left out with heading
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
                   { serialSlot, getValues, subscribe, onInput, getSource, isEdited, setError }; onInput(fn)
                   calls fn(source) on every edit of the sketch text
    runControls.js createRunControls({ container, course, runner, getValues, getSource, onError }) ->
                   { noticeError }: Run sends getSource() and shows a compile or runtime error as
                   'Stopped. Line N: ...' plus onError(error) for the code panel; Stop button and status
                   line; hidden on lessons without a sim; rAF loop calls runner.tick while running; stops
                   the runner on lesson change; .run-readout line shows runner.getReadout(); main.js puts it
                   in #run-bar, a floating bar at the top left of the workbench; options getLock() (a string
                   disables Run and shows as the status; refreshLock() re-checks it) and onFrame() (after
                   every loop frame, on Stop and on an error); returns { noticeError, refreshLock }
    partPress.js   createPartPress({ stage, getItems, inputs }) -> { press(id), release(), isPressed() }: raycast
                   press and release on visible pressable circuit items, orbit off while held, pointer cursor
                   on hover; createHoldButton({ container, partPress, inputs }) -> { setTarget(id) }, the
                   "Hold to press" keyboard path in the Controls dock, aria-pressed follows inputs
    partTurn.js    createPartTurn({ stage, getItems, inputs }) -> { setValue(id, v), release() }: vertical drag on
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
    multimeter.js  createMultimeter({ container, stage, getItems, inputs }) -> { setTargets(targets) }: "Meter on"
                   select in the Controls dock and click to probe a visible part of a target (a pointer up within
                   5 px of its down); both write inputs.setProbe(id); hidden with no targets
    tabKeys.js     pure nextTabIndex(key, current, count) for the tab keyboard logic
    highlight.js   pure tokenize(code) -> [{ type, text }] for Arduino C++ colouring (tok-<type> classes)
    sketch.js      pure defaultValues(params), slotValues(params, values), fillSketch(code, values), stepDuration(step, values),
                   traceStepAt(trace, values, elapsedMs)
    boardTour.js   createBoardTour({ stage, board, course, container, onComplete }): board hover labels, zone
                   clicks and tour card checklist for lessons with a tour; the card sits inside the workbench
                   below the view buttons; calls onComplete(lessonId) once every zone is opened (main.js marks
                   1.1 done while its step is the generated one)
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
  x = 0. On every lesson change it removes and disposes the old circuit group,
  builds `circuits[lesson.id]` if there is one, and calls `invalidate()`. A held
  button is released first.

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
  fit the reference best (ties keep ids).
- `diagnose(build, reference, { only })` -> `[{ id, text, targets: { parts,
  holes, pins, places } }]`, most important first:

  | id | Found when |
  | --- | --- |
  | `short` | a net holds two different pins |
  | `button-gap` | a button's sides share a net, or it does not straddle the channel where the reference one does and the circuit does not match |
  | `same-net` | two terminals of a part share a net they do not share in the reference |
  | `reversed` | turning an LED, RGB LED or TMP36 round fits the reference better |
  | `wrong-pin` | a net with pin P fits a reference net with pin Q, and none with P |
  | `no-resistor` | an LED anode or RGB colour leg meets a pin other than GND that its reference net does not have |
  | `loose-wire` | a pin's net has only places, unless the parts it should meet are unplaced |
  | `missing` | a reference part is not placed |
  | `not-joined` | a reference net has no equal build net (names its first two tokens in different build nets) |
  | `loose` | a terminal is alone in its net and joined to something in the reference |

  The texts are in `netlist.js` and `03-netlist-footprints.md`. Wording helpers:
  `partLabel` (adds the value, colour or id only when needed), `thingLabel`,
  `placeLabel` (`strip 9 (rows a to e)`, `the top + rail`), `formatOhms`.
- Step rules (`rules.js`): `{ placed: id }`, `{ apart: [x, y] }`, `{ allApart: id }`,
  `{ joined: [items] }` (`id.*` any terminal, `id.end` either outer leg, pins
  normalized), `{ wired: pin }`, `{ noShorts: true }`, `{ matches: 'all' | [ids] }`.
  `createRuleContext` aligns the build once and caches its netlist and diagnosis.

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
  board and the runner, and checks that each goal fails at the defaults and passes
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

- A lesson may have `steps: [step, ...]` (1.2 now) and `prebuilt: [ids]`. A step
  is `{ id, kind, title, body: [1 to 3 paragraphs], check, hint?, done?, showMe? }`.
  Ids are kebab case and unique in the lesson. Kinds: `learn`, `explore`, `build`,
  `wire`, `predict`, `run`, `code`. Build and wire steps (with `parts` and a
  `circuit` check) stay hidden while `BUILD_STEPS_ENABLED` in `steps.js` is false
  (phase 5 turns it on). Lessons without steps get one generated step whose check
  is `legacy`.
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
  - `tour` `{ text }`: `ctx.tour.complete`.
  - `all` `{ checks }`: every inner check passes; items in order, the first non
    null feedback.
- The context: `{ lessonId, lessonCompleted, answers, latched, sim: { phase,
  progress }, code: { error }, tour: { complete } }`. `main.js` builds `sim`,
  `code` (checkCode of the code panel source, cached by source) and `tour`; the
  flow adds `lessonId`, `lessonCompleted`, `answers` and `latched` from the course
  and the tracker.
- Latching: on every update the flow latches each sim key of the current step that
  is ok now (`tracker.latch`), so progress made in one run survives Stop. A step
  stored as passed counts its sim keys as latched and its answer as given, so its
  items stay ticked after a reload; code items stay live.
- Flow rules (`src/course/flow.js`): `update(ctx)` evaluates the current step,
  latches, stores a pass once (`markPassed`) and, when every step passed and the
  course does not list the lesson, calls `course.markComplete` once. `next()` moves
  on only from a passed step and does nothing on the last. `answer(stepId,
  option)` works on the current step until it passes. `toggleOpen(index)` opens
  or closes done cards. `runLock()` is `Make a guess first.` on a predict step
  with no guess, else null. A lesson the course lists as done with no tracker
  record gets `completeAll` on first view. A lesson change resets the flow's
  context to idle, so an old run never counts. Subscribers hear only real view
  changes. The view: `{ lesson, steps: [{ step, status: 'done' | 'current' |
  'locked', passed, helped, open, result, answer }], index, result, passedNow,
  lessonDone }`.
- Step progress is saved under `robo-learn:steps`: a JSON object keyed by lesson id
  of `{ current, passed, helped, answers, latched, hintLevels }`. Loading drops
  unknown lesson and step ids, wrong types and non integer indexes, and clamps
  `current`. `reset` keeps an empty record, so a reset lesson is not migrated
  again.

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
