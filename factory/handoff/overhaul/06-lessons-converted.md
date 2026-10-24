# Phase 6: Lessons converted

## Goal

Every lesson (1.1 to 1.12 and P1) runs as milestones from `lesson-steps.md`,
with hand built circuits, carry over from earlier lessons, and the new
breadboard basics steps at the end of 1.1. No lesson uses a generated step any
more.

## Read first

- `lesson-steps.md` (all of it).
- Phase 2 to 5 modules, especially `checks.js`, `rules.js`, `kit.js`,
  `workbench.js`, `placement.js`, `boardTour.js`.

## 6.1 Event checks (for lesson 1.1)

Add the `event` check type to `src/course/checks.js`:

```js
{ type: 'event', items: [{ text, event, count }] }
```

- ctx gains `events`: `{ 'strip-hover': Set of places, 'part-moved': n, 'part-returned': n }`,
  counted per lesson while the step is current (reset when the step changes,
  kept in memory only).
- An item is ok when the count (the set size for `strip-hover`) is at least
  `count`. Passed when every item is ok.
- Sources in main.js:
  - `strip-hover`: the placement `onHover(hole)` adds `placeOf(hole)` to the
    set. Hovering must work on explore steps too: on an `explore` step with an
    `event` check, enable a hover only placement mode (`placement.setHoverOnly(true)`:
    strip highlight and tooltip, no picking).
  - `part-moved`: a workbench `move` event (a placed part placed again
    somewhere else).
  - `part-returned`: a workbench `remove` event.

Tests in `test/checks.test.js`.

## 6.2 Lessons without a reference circuit

Lesson 1.1 has no entry in `circuits.js`. Give it `kit` in its lesson data
(see `lesson-steps.md`). `kitFor` already uses `lesson.kit`. With no
reference: `compare` is not used, the run lock has no circuit part, circuit
checks evaluate only their item rules (rules that need a reference, like
`matches`, are not used in 1.1), and `diagnose` is called with an empty
reference only for the rules in 1.1 (so only `short` and `same-net` can
appear; make sure `diagnose` handles an empty reference without throwing and
reports `same-net` for two legs of one part in one place even then).

## 6.3 Convert the lessons

For each lesson, in `src/course/lessons.js`:

- Add `steps` exactly as in `lesson-steps.md`. Keep `overview`, `pinout`,
  `example`, `specs` and `sketch` as they are (they are the Reference tabs and
  the code). Remove the `Goal: ...` sentence from `overview` (the steps carry it
  now); for 1.12 keep the sentence before it.
- Add `prebuilt` exactly as listed (reference ids from `circuits.js`).
- Lesson 1.1: new title `Meet the Uno and breadboard`, summary
  `Tour the board, then learn how a breadboard joins holes.`, and `kit`.
- P1: `project: true`.
- Lesson 1.2 already has its steps (phase 2) and `prebuilt: []` (phase 5).

Keep the existing sketches and params. The step text refers to existing
controls by their current labels (`Resistor`, `Pull`, `Knob`, `Room light`,
`Room temperature`, `Angle`, `Red`, `Green`, `Blue`, `Dark level`,
`Alarm temperature`, `Step delay`, notes). Check every label in `lessons.js`
before writing the text, and fix the step text if a label differs.

## 6.4 Built earlier

- Tray items for prebuilt parts say `Built earlier`.
- Prebuilt parts are placed when the lesson loads with no saved build (phase 4
  already does this).
- Build steps never list prebuilt parts in `parts`.

## 6.5 Board tour as a step

Lesson 1.1's first step has `check: { type: 'tour', text: 'Open all six parts of the Uno' }`.
The tour card keeps working as the keyboard path. The tour's own completion no
longer marks the lesson done (the flow does once every 1.1 step passes).

## 6.6 Tests

- `test/lessons.test.js`: every lesson has steps; ids unique; every build and
  wire step lists `parts` that exist in the kit and are not prebuilt; every
  kit part is placed by some step or prebuilt; every `progress` name used by a
  sim check exists in that board's `progress()` (keep a table in the test);
  every rule's ids exist in the kit or are valid pin names; every quiz answer
  is inside its options; text is ASCII only.
- New `test/lessonFlows.test.js`: for every lesson, play a perfect learner
  through the flow with real modules: create the course, tracker, flow and a
  workbench (memory storage); for each step in order:
  - quiz and predict: answer the right option;
  - build and wire: `workbench.placeReference(step.parts)` and the reference
    wires that reach those parts (for wire steps, every reference wire not yet
    placed);
  - explore steps: feed the events the check needs;
  - tour: set the tour complete;
  - run and code: drive the board with the `drive` helper pattern from
    `lessonGoals.test.js` (the same overrides as there make the goal pass) and
    pass its progress into the ctx;
  - assert the step passes, then `next()`.
  At the end assert the course marked the lesson complete exactly once.
- Also for every lesson with build steps: the empty build fails the first
  build step, and placing the first part 3 columns to the right of its
  reference legs (when it fits) still passes that step.

## Browser checks

Play every lesson once from a cleared localStorage. For each: the steps
appear in the right order, the code panel and edit mode switch with the step
kind, the prebuilt parts are there and marked, and the lesson completes. In
particular:

1. 1.1: tour, hovering three strips ticks, the gap quiz, the resistor, two
   power wires (the rails work), moving and returning the resistor.
2. 1.3: only the D9 wire is needed; the measuring steps tick one by one, even
   across Stop and Run.
3. 1.4: the button in rows a and d gives the centre gap message.
4. 1.5: the float step then the three presses.
5. 1.8: three resistors placed in any order still pass (alignment).
6. 1.10: swapping 5V and GND gives the TMP36 message.
7. P1: no automatic hints; `Need a hint?` shows the hint.

## Acceptance criteria

- [ ] Every lesson completes only through its steps.
- [ ] `test/lessonFlows.test.js` passes for all 13 lessons.
- [ ] `test/lessonGoals.test.js` still passes unchanged.
- [ ] No `Goal:` text remains in `overview`.

## AGENTS.md updates

Update the lessons.js description (steps, kit, prebuilt, project), the
Curriculum section (1.1 title), and the event check.

## Decisions made while building

(Write any choice you had to make here.)
