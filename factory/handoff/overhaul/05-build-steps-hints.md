# Phase 5: Build steps and hints

## Goal

Build and wire steps become real: the learner builds the circuit in the steps
of a lesson, the checklist ticks as connections become right, mistakes are
named in words and marked in 3D, and the hint ladder (where to look, hint,
show me, do it for me) helps when they are stuck. Lesson 1.2 becomes the first
fully hand built lesson.

## Read first

- Phase 2: `checks.js`, `flow.js`, `stepTracker.js`, `steps.js`, the guide.
- Phase 3: `rules.js`, `netlist.js` (`diagnose`).
- Phase 4: `workbench.js`, `placement.js`, `partsTray.js`, `circuitView.js`.
- `lesson-steps.md`, section "1.2 Blink" and "Step fields for build and wire
  steps".

## 5.1 Turn build steps on

- `src/course/steps.js`: `BUILD_STEPS_ENABLED = true`.
- Lesson 1.2: add `prebuilt: []` (empty breadboard at the start).
- Build and wire steps have a `parts` field: the kit ids this step places (see
  `lesson-steps.md`). The scope of a step is the union of `parts` of this step
  and every build or wire step before it, plus the lesson's `prebuilt` parts.
  Put a `scopeFor(lesson, stepIndex)` helper in `src/course/steps.js` and test it.

## 5.2 Circuit check

Add the `circuit` type to `src/course/checks.js`:

```js
{ type: 'circuit', items: [{ text, rule }], pass: rule }   // pass is optional
```

- ctx gains `build` (the workbench build), `reference` (the lesson's
  reference circuit), `scope` (the step scope ids), `attempts` (workbench
  changes since this step became current) and `busy` (true while the learner
  is carrying a part or half way through a wire or bend).
- Use one `createRuleContext(build, reference)` per evaluation.
- `passed`: every item rule is true and `pass` (when present) is true.
- Items: `{ text, ok: evaluateRule(rule) }`.
- Feedback, only when not passed, `attempts > 0` and not `busy`: the first
  mistake from `diagnose(build, reference, { only: scope })` for build steps,
  or `diagnose(build, reference)` for wire steps, as
  `{ tone: 'bad', text, targets }`. When there is no mistake: no feedback.
- The flow keeps `targets` in the view so the UI can mark them.

Update `src/circuits/netlist.js` if needed so `diagnose` with `only` never
reports parts outside the scope and never reports a missing part that a later
step adds.

## 5.3 Suggestions (show me and do it for me)

New pure module `src/circuits/suggest.js`:

```js
// suggest(build, reference, step, scope) -> [
//   { kind: 'part', id, legs } | { kind: 'wire', from, to } | { kind: 'unwire', id }
// ]
```

Build steps (for each id in `step.parts` that is not placed, or placed but
failing the step):
1. Try the part's reference legs, if free (its own current holes count as
   free).
2. Try the reference legs shifted by the offset of the nearest placed part
   that shares a net with this part in the reference (same column offset;
   rows shifted by the same number of rows within the same half; skip when
   that leaves the board).
3. Search: fixed shapes every anchor in `ALL_HOLES` and every orientation;
   bend shapes every valid pair whose first end is in a place the part must
   join (from the scoped reference nets), else every valid pair. Stop after
   3000 candidates.

A candidate wins when, with it placed, the step's `pass` rule (or all its
item rules) is true. Among winners pick the one with the smallest total leg
distance (columns plus rows) to the reference legs.

Wire steps: for each reference wire whose ends are not joined in the build
the way the reference joins them:
- Its pin end stays (`from`). For the other end find the build place that
  holds the tokens the reference wire reaches, and pick the free hole in that
  place nearest to the reference `to` hole.
- If a learner wire from that pin goes somewhere wrong, add an `unwire` for it
  first.

Return an empty list when nothing is found. Tests `test/suggest.test.js`: 1.2
from an empty board for each build step; the LED placed 11 columns right
(the suggestion follows it); wires for 1.2 and 1.4; a wrong GND wire gives an
unwire then a wire.

## 5.4 Hint ladder

Tracker: `hintLevels[stepId]` 0 to 3 (already in the phase 2 API), and
`helped` steps.

Guide (current card, while the step has not passed):
- A row `Stuck?` followed by buttons that appear one rung at a time:
  - `Hint` always (on project lessons, `lesson.project: true`, the label is
    `Need a hint?`). Sets level 1 and shows `Hint: <step.hint>`; when the step
    has no `hint`, show the current mistake text if any, else
    `Look at the checklist: the first item without a tick is the next thing to do.`
  - `Show me` after level 1, on build, wire and code steps. Sets level 2.
  - `Do it for me` after level 2, on build and wire steps only. Sets level 3,
    applies the suggestion through the workbench (unwire, place, add wire), and
    the step is stored as helped when it passes. The success box then adds a
    small muted line `Helped`.
- Buttons have `aria-pressed` for the levels already used.

Level 0, always on for build and wire steps, from the moment the step starts:
- The tray items in `step.parts` pulse (an accent ring animation, none under
  reduced motion).
- The places the new part must join glow (`info` highlight): for each scoped
  reference net that holds a token of `step.parts` and a token of a part
  already placed, highlight the build place of that placed token.
- Wire steps: the Uno pins of reference wires that are not joined yet glow.
  Add `board.highlightPins(names)` to `createUnoBoard`: a thin accent ring
  above each pin, from a small pool.
- The camera frames the breadboard in the top view (edit mode, 5.6).

Auto nudge: on a non project lesson, when a mistake is shown, or after 40
seconds on the step with no checklist change and no workbench change, raise
the level to at least 1 (show the hint box). Reset the timer on every change.

Level 2 visuals:
- Build and wire steps: draw the suggestion as ghosts (reuse the placement
  ghost builder, accent coloured, not red) and pin labels (5.5) at the legs:
  LED `long leg: 9e` and `short leg: 10e`; other parts `<terminal label>: <hole>`
  for each terminal, or `ends: 5c and 9c` for bend parts; wires
  `<pin> to <hole>`. They stay until the step passes or the build changes in a
  way that makes the suggestion stale (recompute after each change).
- Code steps: `step.showMe = { lines: [n...], note }` marks those lines in the
  editor with class `is-hint` (accent soft background) and shows the note at
  the end of the first marked line. Add `markLines(lines, note)` and
  `clearMarks()` to the code panel.

## 5.5 Labels pinned to 3D positions

New module `src/ui/labels.js`:

```js
// createLabels({ stage, container }) -> { set(list), clear() }
// list: [{ id, position: THREE.Vector3, text, tone: 'info' | 'bad' | 'good' }]
```

- Absolutely positioned divs in the workbench: white background, 1.5px border
  in the tone colour, radius 8px, 12px bold text, max width 220px (wraps),
  a small pointer at the bottom centre; placed above the projected point.
- Re-project on controls `change`, on resize and after `set`. Hide labels
  whose point is behind the camera or outside the workbench.
- `aria-hidden="true"`; the guide always carries the same text.

## 5.6 Edit mode follows the step

- When the current step is `build` or `wire`, turn edit mode on (tray,
  placement, top view). Other steps turn it off. The `Edit circuit` toggle
  still works for the learner in between; a step change applies the default
  again.
- Build steps only show the tray parts of this step and earlier steps as
  pickable; later parts show `Later` as their sub line and are disabled. Wire
  steps enable the wire tool and disable part pick ups of later parts.
- On a mistake: highlight its target places in `bad`, and pin one label with
  the mistake text at its first target hole (or pin).

## 5.7 Run lock

The circuit part of the run lock (phase 4) now reads, in order:
- a `short` in the diagnosis: `Fix the short circuit to unlock Run.`
- otherwise not matching: `Finish the circuit to unlock Run.`

## 5.8 Tests

- `test/checks.test.js`: the circuit type, items, pass rule, feedback only
  after attempts and when not busy.
- `test/suggest.test.js` (5.3).
- `test/flow.test.js`: a full 1.2 run: answer the quiz, place the LED
  (reference legs), the resistor, both wires, guess, run (stub sim progress),
  code (stub goal); the lesson completes once.
- Hint level storage in `test/stepTracker.test.js`.

## Browser checks

1. Clear localStorage, open `#1.2`. Six steps. Answer the quiz, Continue.
2. `Build Place the LED`: edit mode is on, top view, the LED pulses in the
   tray. Pick it up, put both legs in one column (turn it with R so it is
   vertical, rows c and d): the feedback says
   `Both legs of the LED are in strip 9 (rows a to e), so the current goes round it.`
   (with your strip number), the strip is red and a label sits on it. The
   hint box appears.
3. Move it to two columns: both items tick, `Milestone done`, Continue.
4. `Add the resistor`: the LED's long leg strip glows. Place the resistor
   ending one strip short: the not joined message names the resistor and the
   long leg of the LED. Show me: a ghost resistor and a label `ends: ...`.
   Do it for me: it is placed, the step passes, the success box says Helped.
5. `Wire D13 and GND`: D13 and GND pins glow. Put the GND wire into the long
   leg strip: a message about the LED or the wrong place appears, Run says
   `Finish the circuit to unlock Run.` Fix it: the step passes and Run unlocks.
6. Predict and code steps work as in phase 2. The lesson completes.
7. Reload in the middle of the resistor step: the same step and the same build
   come back.
8. Try a short: wire 5V into the GND strip: the short message and
   `Fix the short circuit to unlock Run.`

## Acceptance criteria

- [ ] Lesson 1.2 is built by hand, step by step, from an empty breadboard.
- [ ] Every mistake shows plain words in the guide and a mark in 3D.
- [ ] The hint ladder climbs one rung at a time and Do it for me works for
      parts and wires.
- [ ] Other lessons still work (prebuilt) and pass.

## AGENTS.md updates

Document the circuit check, scope, `suggest`, the hint ladder (levels, auto
nudge, project lessons), `labels.js`, `highlightPins`, and edit mode by step.

## Decisions made while building

(Write any choice you had to make here.)
