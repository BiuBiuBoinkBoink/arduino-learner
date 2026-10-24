# Arduino Learner

A browser course that teaches Arduino (and later robotics) on an interactive 3D board.
Learners explore an Uno, wire parts on a breadboard, run a sketch and pass each lesson
by meeting a goal the simulator checks. Clicking Run alone never completes a lesson.

Built with Vite, vanilla JavaScript and three.js. No backend. Everything runs in the browser.

## Quick start

You need Node 22 and git.

```bash
git clone https://github.com/BiuBiuBoinkBoink/arduino-learner.git
cd arduino-learner
npm install
npm run dev -- --port 7100 --strictPort
```

Open http://localhost:7100/ and you should see the Uno and breadboard with the lesson strip
along the bottom. Go to `#1.1` for the board tour or `#1.2` for Blink.

Before every commit, both of these must pass:

```bash
npm test        # vitest, 244 tests at the moment
npm run build   # production build
```

The build prints a chunk size warning for three.js. That is expected.

**Windows note:** Windows reserves some port ranges (on Kian's machine 5041 to 5240).
If the dev server fails with `EACCES`, pick a port in the 7000s. Check yours with
`netsh interface ipv4 show excludedportrange protocol=tcp`.

## Read this before writing code

**[AGENTS.md](AGENTS.md)** is the rulebook. It has the folder layout, every module and its
job, the lesson and circuit data formats, the sim contract and the conventions. Read it
first. Keep it updated whenever you add a file or change a convention.

The rules people trip on most:

- All 3D parts are built in code from three.js geometry. No model files, no loaders.
- Render on demand. After any scene change, call the stage `invalidate()`.
- Lesson text, code and circuits are data in `src/course/` and `src/circuits/`, never in UI modules.
- Pure logic (course state, sims, runner) has no DOM or WebGL access, so it can be unit tested.
- Set text with `textContent`, never `innerHTML`.
- All files ASCII only: no curly quotes, arrows or special symbols. Write ohm, deg C.
- Every lesson needs a goal check. Finishing means meeting the goal.
- Add packages with `npm install <pkg>@latest`. Never `npm update`.
- All content must be original. The idea came from learn-arduino-red.vercel.app.
  Do not copy its code, text, layout or visuals.

## Where the project is

Phase 1 (engine foundation) is done. Jobs 001 to 007 are merged into `main`; 008 and 009 are on their own branches.

| Job | What it added |
| --- | --- |
| 001 | Full screen 3D stage, orbit camera, soft shadows, render on demand, empty panels |
| 002 | Course engine: 12 Level 1 lessons as data, `goTo(id)`, URL hash, lesson strip, progress saved in localStorage |
| 003 | Info panel with Overview, Pinout, Example and Specs tabs, keyboard accessible |
| 004 | Procedural Uno with 6 clickable zones. Lesson 1.1 tour completes when all 6 are opened |
| 005 | Breadboard with a column plus row grid, LED, resistor and arched wires, per lesson circuits for 1.2, 1.3 and 1.7 |
| 006 | Code panel with syntax colouring, sliders and choices that fill `{{param}}` slots, looping line highlight |
| 007 | Run and Stop with a fake upload, shared pin levels, per lesson sim registry, goal check API |
| 008 | Lesson 1.2 end to end: LED glows from pin levels, goal passes when a blink takes under 500 ms |
| 009 | Push button you press in 3D or with Hold to press, lessons 1.4 Button input and 1.5 Pull up vs pull down with a floating pin |
| 010 | Potentiometer you turn by dragging or with the Knob slider, analog pin levels, LED brightness, lessons 1.6 Potentiometer and 1.7 PWM fade |
| 011 | Sim multimeter you point at a part in 3D or with Meter on, lesson 1.3 Resistors and Ohm's law with a 220 ohm, 1k and 10k choice |
| 012 | RGB LED part and lesson 1.8 Colour mixing, match orange with three sliders |
| 013 | Room light and temperature sliders, photoresistor and TMP36 parts, lessons 1.9 Light sensor and 1.10 Temperature |
| 014 | Piezo buzzer with Web Audio and a Sound on/off toggle, lesson 1.11 Sound with an E D C tune goal |
| 015 | SG90 style servo with a turning horn, lesson 1.12 Servo basics with a 45, 90 and 135 deg goal |
| 016 | Level 1 project P1 Room monitor: photoresistor, TMP36, night light and alarm buzzer over a 24 s sim day |
| 017 | Serial Monitor panel with scrolling output, Clear and Send, fed by the 1.6 and 1.10 sims |
| 018 | Code runner lexer and parser: Arduino C subset to an AST, errors with line numbers |
| 019 | Code runner runtime: interpreter on a virtual clock, Arduino built-ins, Serial, tone and Servo, in a Web Worker |

### Where we stopped

**Phase 1 is done.** Job 008, Lesson 1.2 Blink end to end, was built by hand on the
`feature/blink-end-to-end` branch: the LED glows from the D13 pin level, and 1.2 completes
when one full blink takes under 500 ms. Its spec is
[factory/handoff/008-blink-end-to-end-spec.md](factory/handoff/008-blink-end-to-end-spec.md).

**Job 009, the first Phase 2 item, is built** by hand on the `feature/button-input` branch
(cut from `feature/blink-end-to-end`), from
[factory/handoff/009-button-input-spec.md](factory/handoff/009-button-input-spec.md):

- A procedural push button part (`src/parts/button.js`) that straddles the breadboard
  centre channel, with `setPressed(on)` moving its cap.
- A pure `inputs` store for held buttons, passed into every sim by the runner.
- `src/ui/partPress.js`: raycast press and release on the 3D button, with camera orbit
  paused while it is held, plus a "Hold to press" button for keyboard users.
- Circuits, sketches and sims for 1.4 and 1.5. In 1.5 a choice removes the 10 kohm pull
  down resistor and the input floats, so the LED flickers.
- Goals: three clean presses while running (1.5 only counts them with the resistor fitted).
  These goals are an assumption; check them against the curriculum doc.

**Job 010, the second Phase 2 item, is built** on the `feature/potentiometer` branch, from
[factory/handoff/010-potentiometer-spec.md](factory/handoff/010-potentiometer-spec.md):

- A procedural potentiometer part (`src/parts/potentiometer.js`) whose knob turns over 270 degrees.
- `src/ui/partTurn.js`: drag up or down on the knob to turn it, orbit paused while turning,
  plus a "Knob" slider (0 to 1023) for keyboard users.
- Pin levels from 0 to 1 for analog inputs and PWM duty, and LED `setBrightness`.
- A readout line under the run status that stands in for the Serial Monitor.
- 1.6 passes when A0 has read near both ends since Run; 1.7 passes on one full fade taking
  1 to 3 s (step delay 2 to 5 ms; the default 10 ms does not pass).
  These goals are an assumption; check them against the curriculum doc.

**Job 011 is built** on `feature/multimeter`, from
[factory/handoff/011-multimeter-spec.md](factory/handoff/011-multimeter-spec.md): a sim
multimeter (click a part or use "Meter on") and lesson 1.3, where the resistor choice swaps
the resistor and dims the LED. 1.3 passes once the LED current has been measured with all
three resistors. This goal is an assumption; check it against the curriculum doc.

**Job 012 is built** on `feature/rgb-led`, from
[factory/handoff/012-rgb-led-spec.md](factory/handoff/012-rgb-led-spec.md): a common cathode
RGB LED part and lesson 1.8, which passes when the Red, Green and Blue sliders bring the LED
within 25 of orange (255, 128, 0) while running. The target is an assumption.

**Job 013 is built** on `feature/room-sensors`, from
[factory/handoff/013-room-sensors-spec.md](factory/handoff/013-room-sensors-spec.md): a shared
room with Room light and Room temperature sliders (the light also dims the scene), photoresistor
and TMP36 parts, and lessons 1.9 (the night light turns on and off again) and 1.10 (15 deg C or
less and 30 deg C or more). These goals are assumptions.

**Job 014 is built** on `feature/buzzer`, from
[factory/handoff/014-buzzer-spec.md](factory/handoff/014-buzzer-spec.md): a piezo buzzer part,
a tones store (Hz per pin), a Web Audio square wave with a saved Sound on/off toggle, and
lesson 1.11, which passes when one loop plays E, D, C. The target tune is an assumption.

**Job 015 is built** on `feature/servo`, from
[factory/handoff/015-servo-spec.md](factory/handoff/015-servo-spec.md): a servo part whose horn
follows a servos store (deg per pin, held on Stop), and lesson 1.12, where the arm moves at SG90
speed and the goal is resting at 45, 90 and 135 deg. The targets are an assumption.

**Job 016 is built** on `feature/room-monitor`, from
[factory/handoff/016-room-monitor-spec.md](factory/handoff/016-room-monitor-spec.md): the Level 1
project, lesson P1 Room monitor. A 24 s sim day drives the room. The learner sets the dark level
and alarm temperature so that one whole day has the night light on at night only and the alarm
on in the hottest hours only. Circuit wires can now be hole to hole jumpers.

**Phase 2 is done.** Every lesson in the app (1.1 to 1.12 and P1) has a sim and a goal check.

**Job 017, the first Phase 3 item, is built** on `feature/serial-monitor`, from
[factory/handoff/017-serial-monitor-spec.md](factory/handoff/017-serial-monitor-spec.md): a shared
serial port and a Serial Monitor panel (scrolling output, Clear, Send) shown on lessons whose
sketch starts Serial. The 1.6 and 1.10 sims now print what their sketches print.

**Job 018 is built** on `feature/code-parser`, from
[factory/handoff/018-code-parser-spec.md](factory/handoff/018-code-parser-spec.md): `src/runner/lexer.js`
and `src/runner/parser.js` turn an Arduino C subset into an AST, with errors like
`Line 2: expected ';' after the statement`. Every lesson sketch parses.

**Job 019 is built** on `feature/code-runtime`, from
[factory/handoff/019-code-runtime-spec.md](factory/handoff/019-code-runtime-spec.md): an interpreter
that runs the AST on a virtual clock with the Arduino built-ins, Serial, tone and Servo, a
session that holds pin state, and a Web Worker with a main thread client. Every lesson sketch
runs without errors. It is not wired to the code panel yet (job 020).

**New lessons are paused** at the owner's request. The Level 2 lesson items in the backlog
are on hold.

## How to continue

The work queue is **[factory/backlog.md](factory/backlog.md)**. Items are in order and each
one builds on the ones above it. Always take the first unticked `- [ ]` item.

### Option A: by hand

1. Pull the latest `main`.
2. Tell the group which backlog item you are taking, so two people never build the same one.
3. Make a branch: `git checkout -b feature/<short-name>`, for example `feature/blink-end-to-end`.
4. Build it. Follow AGENTS.md and match the style of the code around you.
5. Add or update tests for any pure logic. Update AGENTS.md if you added files or changed a format.
6. Check it in the browser, then run `npm test` and `npm run build`. Both must pass.
7. Tick the item in `factory/backlog.md`: change `- [ ]` to `- [x]` and add your branch name.
8. Push and open a pull request to `main`. Get one mate to review before merging.

A backlog line is a one line brief, not a full spec. Before you start, write down what
"done" means (the acceptance criteria) in your pull request description, and check against it.

### Option B: with the Claude Code factory

Kian built phase 1 with a Claude Code workflow called the factory. For each backlog item it
writes a spec, builds it, runs four reviewers (security, UX, UI, code) in parallel, then an
approver decides whether it merges. Jobs 001 to 007 all went through it. Six passed review
first time; job 004 needed one fix round for the phone layout.

The factory is included in this repo, so Claude Code loads it automatically when you open
the project folder:

| Path | What it is |
| --- | --- |
| `.claude/skills/factory/SKILL.md` | The orchestrator: the loop, job files, ports, merge rules and commands |
| `.claude/skills/factory/template/` | A starter `backlog.md` and `dashboard.html` (a live board of jobs) |
| `.claude/agents/spec-writer.md` | Turns a backlog line into `spec.md` with acceptance criteria |
| `.claude/agents/builder.md` | Builds the spec on the job branch, tests it, writes `build.md` |
| `.claude/agents/reviewer-security.md` | Security review |
| `.claude/agents/reviewer-ux.md` | Flows, states, copy, accessibility, checked in a real browser |
| `.claude/agents/reviewer-ui.md` | Visual consistency, checked with screenshots |
| `.claude/agents/reviewer-code.md` | Correctness, simplicity, conventions, runs the tests |
| `.claude/agents/approver.md` | Final gate: APPROVE merges to `main`, ESCALATE hands it to a human |

**One time setup:**

1. Install Claude Code and open it in the repo folder.
2. Install the browser tool the UX and UI reviewers use:
   `npm install -g agent-browser@latest`, then `agent-browser install`.
3. Make sure `npm install`, `npm test` and `npm run build` all work on your machine first.

**Commands** (run from the repo folder, on a clean `main`):

| Command | What it does |
| --- | --- |
| `/factory next` | Takes the first unticked backlog item and runs spec, build, review and approve |
| `/factory <feature>` | Runs the loop for a one line feature that is not in the backlog |
| `/factory approve <job-id>` | Merges a job that is waiting for a human |
| `/factory rework <job-id> <note>` | Sends a waiting job back to the builder with your note |

A job goes spec, build, then four reviews in parallel. If any reviewer asks for changes,
the builder fixes them and all four review again, up to 3 rounds. Then the approver
merges it into `main` or hands it to you. The factory pushes `main` after a merge. Agents
handle all commits, pushes, pull requests and merges themselves; see "Git and pull requests"
in AGENTS.md.

**Things we learned running it:**

- **Ports on Windows:** the skill gives dev servers ports `5100 + 10n`. On Windows those can
  sit in a reserved range and fail with `EACCES`. We ran with `7100 + 10n` instead (job 008 gets
  7180, 7181, 7182). Check your reserved ranges with the `netsh` command above.
- **Worktrees:** each job runs in its own git worktree next to the repo, at
  `../<repo-folder>-factory/<job-id>`. Your main checkout stays untouched until the merge.
- **Job files stay local:** specs, builds, reviews and decisions go in `factory/jobs/`, which is
  gitignored. Job numbers count up from whatever is in your local `factory/jobs/`, so a fresh
  clone starts at 001 again. That is fine: the branch is deleted after each merge.
- **Leftover dev servers:** reviewers sometimes leave a dev server running. If a worktree folder
  will not delete, find the process on that port (`netstat -ano | findstr :7171`) and stop it.
- **Phone layout:** UX and UI reviewers keep noting the 390 px panel overlap. It predates every
  job and is not a blocker. It needs its own backlog item.
- **One job at a time per person:** jobs can run in parallel (one Claude session each), but two
  people must never claim the same backlog item. Pull `main` before `/factory next`.

**Dashboard (optional):** copy `.claude/skills/factory/template/dashboard.html` into `factory/`,
run `python -m http.server 8000` from the `factory/` folder, and open
http://localhost:8000/dashboard.html to watch jobs move through the stages.

## Curriculum

5 levels, 43 lessons, each level ending in a project:

1. Basics (12 lessons): LED, button, pot, PWM, RGB, light sensor, temperature, buzzer, servo. Project: room monitor.
2. Programming properly (8): Serial Monitor, functions, arrays, millis() not delay(), debouncing, state machines. Project: traffic light with no delay().
3. Communication (8): I2C, SPI, UART, OLED, IMU, SD logging, IR remote, Bluetooth. Project: weather station.
4. Robot hardware (8): H bridge, 2WD chassis, encoders, distance and heading sensors, power. Project: RC car with auto stop.
5. Beyond the Uno (7): ESP32, WiFi, IoT dashboard, low power, PCB basics. Project: WiFi robot.

The full lesson list with parts and goal checks is in Kian's curriculum doc. Ask Kian for access.

## Roadmap

- **Phase 1, engine foundation:** done.
- **Phase 2, Level 1 lessons:** job 009 (button, 1.4, 1.5) built, job 010 spec ready in `factory/handoff/`. Interaction (button, knob), multimeter, RGB, light and temperature, buzzer, servo, room monitor project.
- **Phase 3, code runner and Level 2:** Serial Monitor, a parser and runtime for an Arduino C subset, editable code, code based goal checks, Level 2 lessons.
- **Phase 4 onward, not queued yet:** robot world with 2WD kinematics and sensors, Level 4 and the RC car, then Levels 3 and 5, translations (English, BM, Chinese).

Phase 3 builds our own interpreter for an Arduino C subset rather than using avr8js.
If the team wants avr8js instead, change the two code runner items in the backlog before Phase 3 starts.

## Known issues

- At phone width (around 390 px) the left and right panels overlap each other and the stage.
  Desktop only for now. A narrow screen layout needs its own backlog item.
