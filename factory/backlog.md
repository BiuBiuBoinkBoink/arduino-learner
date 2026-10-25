# Factory backlog

`/factory next` takes the first unchecked item. Items are ordered: each builds on
the ones above it. Phases 4 and later are notes, not queued yet.

## Phase 1: Engine foundation

- [x] App shell layout: full screen three.js stage with orbit camera, lights, soft shadows and a render on demand loop, plus empty placeholder panels for lesson strip (bottom), info panel (left), code panel (right) → 001-app-shell-layout
- [x] Course engine: lessons data module, central state, goTo(id) that syncs every panel and the URL hash, lesson strip with numbered cards, prev and next buttons, progress bar from completed lessons saved in localStorage → 002-course-engine
- [x] Info panel with Overview, Pinout, Example and Specs tabs rendered from the current lesson data, keyboard accessible tabs → 003-info-panel-tabs
- [x] Procedural Arduino Uno board model with clickable zones (digital pins, analog pins, power pins, USB and power jack, chip, reset button) and hover labels, used by lesson 1.1 Meet the Uno, which completes when all zones are opened → 004-uno-board-model
- [x] Breadboard and parts system: breadboard model with a column plus row grid helper, per lesson circuit tables that build parts at grid positions, LED and resistor parts, and wires as arched tubes from board pins to breadboard holes → 005-breadboard-parts
- [x] Code panel: shows the lesson sketch with syntax colouring, fills {{param}} slots from param controls (range sliders and choices built from lesson data), and highlights the active line from a timed trace → 006-code-panel
- [x] Sim framework: Run and Stop buttons, fake upload step, per lesson sim registry with update(now) and stop(), shared pin levels, and a goal check API that marks a lesson done only when its goal passes → 007-sim-framework
- [x] Lesson 1.2 Blink end to end: LED glow driven by the sim, on and off sliders, goal check passes when the LED blinks with a period under 500 ms → feature/blink-end-to-end

## Phase 2: Level 1 lessons

- [x] Scene interaction: raycast press and release on parts, and a push button part, with lessons 1.4 Button input and 1.5 Pull up vs pull down including a floating pin effect → feature/button-input
- [x] Potentiometer part with drag to turn, and lessons 1.6 Potentiometer and 1.7 PWM fade with LED brightness from analogWrite values → feature/potentiometer
- [x] Sim multimeter that reads current through a selected part, and lesson 1.3 Resistors and Ohm's law with a resistor choice of 220 ohm, 1k and 10k → feature/multimeter
- [x] RGB LED part and lesson 1.8 Colour mixing with a target colour match goal → feature/rgb-led
- [x] Room environment controls for light level and temperature, LDR and TMP36 parts, and lessons 1.9 Light sensor and 1.10 Temperature → feature/room-sensors
- [x] Piezo buzzer part with Web Audio square wave sound, a sound on/off setting, and lesson 1.11 Sound with a 3 note tune goal → feature/buzzer
- [x] Servo part with an animated horn and lesson 1.12 Servo basics with a 3 target angle goal → feature/servo
- [x] Level 1 project lesson Room monitor combining LDR, TMP36, buzzer and LED, checked across a sim day and night cycle → feature/room-monitor

## Phase 3: Code runner and Level 2

- [x] Serial Monitor panel with scrolling output, a text input that sends lines to the running sketch, and a clear button → feature/serial-monitor
- [x] Code runner parser: tokenise and parse an Arduino C subset (setup and loop, int float bool long, const, arrays, if else, for, while, switch, functions, enum) into an AST, with clear error messages and line numbers, fully unit tested → feature/code-parser
- [x] Code runner runtime: interpret the AST in a Web Worker against a virtual clock with digitalWrite, digitalRead, pinMode, analogRead, analogWrite, delay, millis, Serial print and read, tone, and Servo, posting pin changes to the sim, fully unit tested → feature/code-runtime
- [x] Editable code panel: learners edit the sketch, Run sends it through the code runner instead of the per lesson sim, errors show inline on the right line, and a reset button restores the lesson code → feature/code-editor
- [x] Code checks for goals: goal checks can inspect the learner's code (for example count delay() calls) and measure timing (for example button response under 50 ms) → feature/code-checks
- [ ] (On hold: no new lessons for now) Level 2 lessons 2.1 Serial Monitor, 2.2 Serial commands, 2.3 Variables and functions and 2.4 Arrays and loops with their goal checks
- [ ] (On hold: no new lessons for now) Bouncy button sim option and Level 2 lessons 2.5 millis() not delay(), 2.6 Debouncing, 2.7 State machines and 2.8 Using libraries
- [ ] (On hold: no new lessons for now) Level 2 project lesson Traffic light with crossing, passing only with the full cycle in order, the crossing served next cycle, and zero delay() calls

## Lesson overhaul (branch feature/lesson-overhaul, do not merge yet)

Full plan in `factory/handoff/overhaul/` (start with `00-plan.md`). Work on
the `feature/lesson-overhaul` branch only; no merge into `main` and no pull
request until the owner says so.

- [x] Overhaul phase 1, layout shell: top bar, course map, step guide with Reference drawer, collapsible code panel, run bar, view buttons and controls dock on the workbench -> 01-layout-shell.md -> feature/lesson-overhaul
- [x] Overhaul phase 2, milestone engine: lesson steps, checks, per step progress, board progress names, lesson 1.2 as steps -> 02-milestone-engine.md -> feature/lesson-overhaul
- [x] Overhaul phase 3, netlist and footprints: power rails, part footprints, connection checker with mistake messages, step rules -> 03-netlist-footprints.md -> feature/lesson-overhaul
- [x] Overhaul phase 4, placement: workbench build, parts tray, ghost and snap placement, wires, keyboard path, edit mode, run lock -> 04-placement.md -> feature/lesson-overhaul
- [x] Overhaul phase 5, build steps and hints: circuit checks, mistakes in 3D, hint ladder with show me and do it for me, 1.2 built by hand -> 05-build-steps-hints.md -> feature/lesson-overhaul
- [x] Overhaul phase 6, lessons converted: every lesson as milestones with carry over, breadboard steps in 1.1 -> 06-lessons-converted.md -> feature/lesson-overhaul
- [x] Overhaul phase 7, narrow screens: medium and compact layouts, bottom sheet, touch placement -> 07-narrow-screens.md -> feature/lesson-overhaul
- [ ] Overhaul phase 8, explain tools: x-ray, current trace, scope, connections, part cards, voltage, slow motion, what if -> 08-explain-tools.md
- [ ] Overhaul phase 9, help chat: Ask tab, tutor server, tool calls, privacy rules -> 09-help-chat.md

## Phase 4 onward (not queued yet)

- Robot world: floor, walls, line tracks, 2WD chassis, differential drive kinematics
- Raycast sensors: ultrasonic, IR line sensors, wheel encoders, IMU heading
- Level 4 lessons 4.1 to 4.6 and the RC car project
- Bus animation, OLED pixel rendering, second board, sim phone app, then Level 3
- Battery and brownout model, relay, then 4.7 and 4.8
- ESP32 board, sim web page and MQTT dashboard, PCB editor, then Level 5
- Translations: English, BM, Chinese
