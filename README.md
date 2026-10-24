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
npm test        # vitest, 186 tests at the moment
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

Phase 1 (engine foundation) is 7 of 8 jobs done. Everything below is merged into `main`.

| Job | What it added |
| --- | --- |
| 001 | Full screen 3D stage, orbit camera, soft shadows, render on demand, empty panels |
| 002 | Course engine: 12 Level 1 lessons as data, `goTo(id)`, URL hash, lesson strip, progress saved in localStorage |
| 003 | Info panel with Overview, Pinout, Example and Specs tabs, keyboard accessible |
| 004 | Procedural Uno with 6 clickable zones. Lesson 1.1 tour completes when all 6 are opened |
| 005 | Breadboard with a column plus row grid, LED, resistor and arched wires, per lesson circuits for 1.2, 1.3 and 1.7 |
| 006 | Code panel with syntax colouring, sliders and choices that fill `{{param}}` slots, looping line highlight |
| 007 | Run and Stop with a fake upload, shared pin levels, per lesson sim registry, goal check API |

**Next up is job 008: Lesson 1.2 Blink end to end.** The blink sim already drives pin D13,
but nothing lights the LED yet and there is no goal check. That job adds the LED glow,
wires pin changes to the LED, and adds a goal that passes when the LED blinks with a
period under 500 ms. After that, Phase 2 builds the rest of Level 1.

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
approver decides whether it merges.

To use it you need Claude Code plus Kian's factory skill and agent files
(`skills/factory/SKILL.md` and `agents/*.md`). They are not in this repo yet, so ask Kian
for them and put them in your own `~/.claude/` folder. Then, from the repo folder:

```text
/factory next
```

That takes the first unticked backlog item and runs the full loop. Notes:

- The UX and UI reviewers need `agent-browser`: `npm install -g agent-browser@latest`, then `agent-browser install`.
- Each job runs in its own git worktree next to the repo (`../<repo>-factory/<job-id>`).
- Specs, reviews and decisions go in `factory/jobs/`, which is gitignored and stays on your machine.
- On Windows, give dev servers ports in the 7000s (see the Windows note above).
- Reviewers sometimes leave a dev server running. If a worktree folder will not delete, find the process on that port and stop it.

## Curriculum

5 levels, 43 lessons, each level ending in a project:

1. Basics (12 lessons): LED, button, pot, PWM, RGB, light sensor, temperature, buzzer, servo. Project: room monitor.
2. Programming properly (8): Serial Monitor, functions, arrays, millis() not delay(), debouncing, state machines. Project: traffic light with no delay().
3. Communication (8): I2C, SPI, UART, OLED, IMU, SD logging, IR remote, Bluetooth. Project: weather station.
4. Robot hardware (8): H bridge, 2WD chassis, encoders, distance and heading sensors, power. Project: RC car with auto stop.
5. Beyond the Uno (7): ESP32, WiFi, IoT dashboard, low power, PCB basics. Project: WiFi robot.

The full lesson list with parts and goal checks is in Kian's curriculum doc. Ask Kian for access.

## Roadmap

- **Phase 1, engine foundation:** job 008 left.
- **Phase 2, Level 1 lessons:** interaction (button, knob), multimeter, RGB, light and temperature, buzzer, servo, room monitor project.
- **Phase 3, code runner and Level 2:** Serial Monitor, a parser and runtime for an Arduino C subset, editable code, code based goal checks, Level 2 lessons.
- **Phase 4 onward, not queued yet:** robot world with 2WD kinematics and sensors, Level 4 and the RC car, then Levels 3 and 5, translations (English, BM, Chinese).

Phase 3 builds our own interpreter for an Arduino C subset rather than using avr8js.
If the team wants avr8js instead, change the two code runner items in the backlog before Phase 3 starts.

## Known issues

- At phone width (around 390 px) the left and right panels overlap each other and the stage.
  Desktop only for now. A narrow screen layout needs its own backlog item.
