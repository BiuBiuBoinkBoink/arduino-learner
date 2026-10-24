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
- [ ] RGB LED part and lesson 1.8 Colour mixing with a target colour match goal
- [ ] Room environment controls for light level and temperature, LDR and TMP36 parts, and lessons 1.9 Light sensor and 1.10 Temperature
- [ ] Piezo buzzer part with Web Audio square wave sound, a sound on/off setting, and lesson 1.11 Sound with a 3 note tune goal
- [ ] Servo part with an animated horn and lesson 1.12 Servo basics with a 3 target angle goal
- [ ] Level 1 project lesson Room monitor combining LDR, TMP36, buzzer and LED, checked across a sim day and night cycle

## Phase 3: Code runner and Level 2

- [ ] Serial Monitor panel with scrolling output, a text input that sends lines to the running sketch, and a clear button
- [ ] Code runner parser: tokenise and parse an Arduino C subset (setup and loop, int float bool long, const, arrays, if else, for, while, switch, functions, enum) into an AST, with clear error messages and line numbers, fully unit tested
- [ ] Code runner runtime: interpret the AST in a Web Worker against a virtual clock with digitalWrite, digitalRead, pinMode, analogRead, analogWrite, delay, millis, Serial print and read, tone, and Servo, posting pin changes to the sim, fully unit tested
- [ ] Editable code panel: learners edit the sketch, Run sends it through the code runner instead of the per lesson sim, errors show inline on the right line, and a reset button restores the lesson code
- [ ] Code checks for goals: goal checks can inspect the learner's code (for example count delay() calls) and measure timing (for example button response under 50 ms)
- [ ] Level 2 lessons 2.1 Serial Monitor, 2.2 Serial commands, 2.3 Variables and functions and 2.4 Arrays and loops with their goal checks
- [ ] Bouncy button sim option and Level 2 lessons 2.5 millis() not delay(), 2.6 Debouncing, 2.7 State machines and 2.8 Using libraries
- [ ] Level 2 project lesson Traffic light with crossing, passing only with the full cycle in order, the crossing served next cycle, and zero delay() calls

## Phase 4 onward (not queued yet)

- Robot world: floor, walls, line tracks, 2WD chassis, differential drive kinematics
- Raycast sensors: ultrasonic, IR line sensors, wheel encoders, IMU heading
- Level 4 lessons 4.1 to 4.6 and the RC car project
- Bus animation, OLED pixel rendering, second board, sim phone app, then Level 3
- Battery and brownout model, relay, then 4.7 and 4.8
- ESP32 board, sim web page and MQTT dashboard, PCB editor, then Level 5
- Translations: English, BM, Chinese
