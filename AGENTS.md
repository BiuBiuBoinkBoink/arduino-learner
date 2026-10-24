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
`src/ui/codePanel.js`, `src/ui/tabKeys.js`, `src/parts/unoBoard.js`, `src/sim/tour.js`,
`src/ui/boardTour.js`. The other folders are the target for later jobs.

```
src/
  main.js          boot: builds the scene, adds the Uno board to it, UI and course engine
  style.css        full viewport layout: stage behind, panels on the edges
  course/          lessons data, state, goTo(id), progress
                   createCourse({ lessons, storage }): goTo, next, prev, markComplete, subscribe; hash #<lesson id>; progress key robo-learn:progress
    lessons.js     lesson objects: id, level, title, summary, plus info tab content:
                   overview (1 to 3 paragraph strings), pinout ([{ pin, use }]),
                   example ({ code, note }), specs ([{ label, value }]); optional
                   tour ([{ zone, label, text }], one entry per UNO_ZONE_IDS id, lesson 1.1 only)
  scene/           renderer, camera, lights, render loop
    stage.js       renderer, camera, orbit controls, lights, ground (no placeholder); returns invalidate()
    renderLoop.js  pure render on demand loop (dirty flag, one frame per invalidate burst)
  parts/           one module per procedural 3D part (board, led, resistor, wire...)
    unoBoard.js    createUnoBoard() -> { group, zones }, 1 unit = 1 cm; UNO_ZONE_IDS for the six clickable zones
  circuits/        per lesson circuit tables: which parts sit where on the breadboard
  sim/             per lesson simulators, pin levels, goal checks
    tour.js        pure createTour(zoneIds): open, isOpened, openedCount, total, isComplete (lesson 1.1 goal)
  runner/          code runner for learner code (Level 2 onward)
  ui/              panels: lesson strip, info tabs, code panel, params, serial monitor
    panels.js      panel elements: #info-panel (left), #code-panel (right), #lesson-strip (bottom), filled by infoPanel, codePanel, lessonStrip
    infoPanel.js   lesson heading plus Overview, Pinout, Example, Specs tabs rendered from lesson data;
                   WAI-ARIA tabs with roving tabindex, arrow, Home and End keys; selected tab kept across lessons
    tabKeys.js     pure nextTabIndex(key, current, count) for the tab keyboard logic
    boardTour.js   board hover labels, zone clicks and tour card checklist for lessons with a tour; marks 1.1 done
test/              vitest unit tests
```

Data flows one way: lesson data -> circuit table -> scene parts; Run -> sim ->
pin levels -> parts update -> goal check -> progress. Only `goTo(id)` changes
the current lesson, and every panel updates from it.

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
