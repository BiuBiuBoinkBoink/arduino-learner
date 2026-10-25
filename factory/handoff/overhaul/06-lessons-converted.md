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

Code:

- 6.1: the flow passes `stepPassed` in the step context. Tour and event items of a step stored as
  passed stay ticked, because opened zones and event counts live in memory only (a reload or the
  next step would untick them in the done card otherwise).
- 6.1: hover only placement also has a keyboard path: the arrow keys move the hovered hole (from
  15e) while the page body or the canvas has focus, so tabs, the course map and option buttons
  keep their own arrows. The hole tooltip shows only for the pointer.
- 6.1: main.js counts the events itself (no new module): the placement `onHover` adds `placeOf`
  of the hole, workbench `move` and `remove` events add to the counts, and a new current step
  starts from empty counts, like `attempts`.
- 6.2: `checks.js` treats a null reference as an empty one, so 1.1's item rules (placed, apart,
  wired, noShorts) work. With an empty reference `diagnose` now reports `same-net` for a part the
  reference does not have, and skips `loose-wire` (a power wire on a bare rail is the point of the
  1.1 step), so only `short` and `same-net` can appear.
- 6.2: main.js has `hasCircuit` (a reference circuit or a kit): edit mode, the tray, the Later
  lock, the tray pulse and the mistake glow and label work on 1.1; the run lock, hint glows, pin
  rings and ghosts still need a reference. The guide gets `canSuggest(lesson, step)`: Show me and
  Do it for me appear only on build and wire steps with a circuit check in a lesson with a
  reference circuit, so 1.1 (and its practice step, a build step with an event check) offers Hint
  only.
- 6.5: the tour card and the zone clicks are on only while the current step has a tour (or legacy)
  check. On later 1.1 steps the card covered part of the breadboard and a click on an Uno pin
  while wiring also opened a zone. The card's last line is now `All 6 parts opened.` (it said
  `Lesson done.`). Start this lesson again also forgets the opened zones.
- Check 3 needed a rule: a button with its legs in rows a and d works as a switch in the netlist,
  so `apart` passed it and `diagnose` stayed quiet on the build step (the scoped compare matched).
  `rules.js` gained `{ straddles: id }` (legs in rows e and f) and `button-gap` now fires whenever
  the reference button straddles and the learner's does not, without the old "and the circuit
  does not match" condition. Only 1.4 and 1.5 have buttons, both straddling.
- Found while playing 1.8: with one resistor placed, `align` kept its id (it only swapped ids
  among placed parts), so a resistor picked as r3 and put on the red leg made `diagnose` say the
  RGB LED was the wrong way round. `align` now lets placed parts take any id of their group.
- Found while playing 1.6: the run bar said `Goal met. Lesson done.` when the sim goal was met on a
  step before the last. It now says `Goal met.`; the guide says when the lesson is done.
- P1 Do it for me: `suggest` checked earlier parts of a build step with `compare` over the scope,
  which can never match in P1 before wiring (the GND pin joins the divider, TMP36 and LED). Earlier
  parts are now compared with the wires from pins left out of both circuits. For wire steps, when
  no one build net holds every part a reference wire reaches (the P1 GND wire to the LED, joined
  to the buzzer by the reference jumper w10), the pin goes to the net holding most of them and
  hole to hole jumpers join the rest. Tests in `suggest.test.js` and a Do it for me pass over every
  build and wire step of every lesson in `lessonFlows.test.js`.
- `lessonFlows.test.js`: build steps place only `step.parts` (no wires), wire steps every reference
  wire not yet placed; 1.1 places by hand (no reference). The 3 columns right test moves every part
  of the first build step, and is skipped where the first part must join an earlier part (1.5's
  pull down must share D2's strip); 1.1 uses 8c and 12c. "Empty build" is the starting build with
  the prebuilt parts.
- Removing the Goal sentences: a paragraph that was only the goal is dropped (so most overviews
  have two paragraphs), 1.12 keeps the sentence before it. `goalText.test.js`, `steps.test.js` and
  the overview test in `lessons.test.js` read the old sentences or the generated steps of 1.1 and
  1.4; they now use small lessons of their own, and the overview test checks no `Goal:` is left.

Content (lesson-steps.md matches lessons.js):

- 1.4 place-button: `Across the centre gap` uses `{ straddles: 'btn1' }` instead of `apart`, so
  rows a and d fail with the centre gap message (see above).
- 1.4 wire-button, 1.5 wire-pull and 1.9 wire-divider: added `The GND pin next to D13 is in use,
  so take one from the bottom header.` The prebuilt LED wire uses that pin, and clicking it only
  says `That hole is already used.`
- 1.10 place-tmp, 1.11 place-buzzer, 1.11 wire-buzzer and 1.12 wire-servo: added a hint. Without
  one the Hint rung (and the 40 s nudge) only pointed at the checklist.
- P1 outputs: the pass rule is `{ matches: ['r1', 'led1'] }` instead of all six parts. The
  reference joins the divider resistor, the TMP36, the LED and (through w10) the buzzer to GND,
  so a compare over them could never pass on a build step. The items still check the LED, its
  resistor and the buzzer; the wire step's `matches: 'all'` checks the rest.
- No reference circuit changed.

Browser checks (preview at 1440 x 900, localStorage cleared first, every lesson played once):

- Hovering three strips was done with pointer moves sent to the canvas: at pane size the holes are
  a few pixels, and the tool's hover did not land on one. The hole tooltip and the tick were seen.
- Parts, wires, presses (Hold to press with Space) and sliders went through the keyboard paths and
  form controls; run steps were stepped with small screenshots because the pane runs no frames
  between them.

