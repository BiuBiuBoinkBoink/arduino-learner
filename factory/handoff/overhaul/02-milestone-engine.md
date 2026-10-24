# Phase 2: Milestone engine

## Goal

Lessons become a list of steps that unlock in order. Each step has a check;
the guide shows a live checklist, feedback and a Continue button. Progress is
saved per step. Every lesson board reports named sub-goals, so a lesson can
have several run steps. Lesson 1.2 gets its real steps (without the build and
wire steps, which arrive in phase 5).

## Read first

- Phase 1 result: `src/course/steps.js`, `src/ui/guidePanel.js`,
  `src/ui/topBar.js`, `src/ui/runControls.js`, `src/sim/runner.js`.
- Every board in `src/sim/` (`blink.js`, `ohms.js`, `button.js`,
  `pullDown.js`, `pot.js`, `fade.js`, `rgb.js`, `light.js`, `temp.js`,
  `tune.js`, `sweep.js`, `monitor.js`).
- `test/lessonGoals.test.js` (the `drive` helper is the model for new tests).
- `lesson-steps.md` in this folder, section "1.2 Blink".

## Step data format

A lesson may have `steps: [step, ...]`. A step:

```js
{
  id: 'led-legs',            // unique within the lesson, kebab case
  kind: 'learn',             // learn | explore | build | wire | predict | run | code
  title: 'What an LED needs',
  body: ['paragraph', ...],  // 1 to 3 short paragraphs
  check: { ... },            // see "Check types"
  hint: 'one sentence',      // optional, the level 1 nudge
  done: 'one sentence',      // optional, shown under "Milestone done": why it works
  showMe: { lines: [10, 12], note: 'try 200' }   // optional, code steps only (phase 5)
}
```

## Check types (this phase)

All checks are evaluated by `evaluate(step, ctx)` in `src/course/checks.js`
and return `{ passed, items, feedback }`:

- `items`: `[{ text, ok }]`, the checklist under "To pass". `ok` is a boolean.
- `feedback`: `null` or `{ tone: 'good' | 'bad' | 'info', text }`.

| Type | Shape | Passes when | Items | Feedback |
| --- | --- | --- | --- | --- |
| `legacy` | `{ type: 'legacy' }` | `ctx.lessonCompleted` is true | `Meet the goal` | none |
| `quiz` | `{ type: 'quiz', question, options: [text], answer: index, explain: [text per option] }` | `ctx.answers[step.id] === answer` | `Answer the question` | after an answer: `bad` with `explain[picked]` when wrong, `good` with `explain[answer]` when right |
| `predict` | `{ type: 'predict', question, options, answer, explain, then: <sim check> }` | a guess is recorded and `then` passes | `Make a guess`, then the items of `then` | after a guess and before `then` passes: `info` `Now press Run and watch.`; after `then` passes: `good` with `explain[answer]` when the guess was right, else `info` with `explain[picked]` |
| `sim` | `{ type: 'sim', progress: 'name', text }` or `{ type: 'sim', goal: true, text }` | the item is ok | one item with `text` | none |
| `code` | `{ type: 'code', rule: 'compiles', text }` | `ctx.code.error` is null | one item with `text` | when there is an error: `bad` `The sketch does not compile. <error message>` |
| `tour` | `{ type: 'tour', text }` | `ctx.tour.complete` | one item with `text` | none |
| `all` | `{ type: 'all', checks: [check, ...] }` | every inner check passes | all inner items in order | the first non null inner feedback |

Sim items latch: an item is ok when the runner reports it now **or** it was
reported before while this step was current (see the tracker's `latched`).
So progress made in one run survives Stop and Run.

A quiz wrong answer never locks anything: the learner can pick again.

## Work items

### 2.1 Board progress

Add an optional `progress()` method to each board, returning an object of
booleans. Names are fixed; the lesson steps refer to them.

| Board | progress() |
| --- | --- |
| blink (1.2) | `blinked`: a full blink seen (`lastGap !== null`); `fast`: same as the goal |
| ohms (1.3) | `measured220`, `measured1000`, `measured10000` from the measured set |
| button (1.4) | `pressedOnce`: at least one full press counted |
| pullDown (1.5) | `floated`: while the pull choice is `none`, the floating D2 level changed at least twice; `pressedOnce` |
| pot (1.6) | `seenLow`, `seenHigh` (the existing flags) |
| fade (1.7) | `rampSeen`: the duty has been at or below `END` and later at or above `1 - END`, or the other way round, since Run (timing does not matter) |
| rgb (1.8) | `{}` |
| light (1.9) | `turnedOn`: the LED changed at least once (`changes >= 1`) |
| temp (1.10) | `seenCool`, `seenWarm` |
| tune (1.11) | `played`: at least three tone starts on D8 since Run |
| sweep (1.12) | `reached45`, `reached90`, `reached135` |
| monitor (P1) | `{}` |

Read each board before adding flags; add a counter only where none exists.
Keep `checkGoal()` exactly as it is.

`src/sim/runner.js`:
- Track the time of the last `tick(now)`.
- New `getProgress()`: `{}` unless the phase is `running`; otherwise
  `{ ran, goal, ...board.progress() }` where `ran` is true once the board has
  been running for 1000 ms and `goal` is `isGoalMet()`.

Tests: extend `test/lessonGoals.test.js` with one test per board that drives
the lesson (reuse `drive`) and checks the progress names flip at the right
moment (for example 1.6: `seenLow` true after the knob goes to 0 and still
false for `seenHigh`). Add a runner test that `getProgress()` is `{}` when
idle and includes `ran` after 1000 ms.

### 2.2 Step tracker

`src/course/stepTracker.js` (pure):

```js
// createStepTracker({ storage, lessons, stepsFor }) -> {
//   get(lessonId) -> { current, passed: [ids], helped: [ids], answers: {id: index},
//                      latched: {stepId: [keys]}, hintLevels: {stepId: n} }
//   setCurrent(lessonId, index)
//   markPassed(lessonId, stepId, { helped = false } = {})
//   answer(lessonId, stepId, option)
//   latch(lessonId, stepId, key)
//   setHintLevel(lessonId, stepId, level)      // used from phase 5
//   reset(lessonId)
//   completeAll(lessonId)                       // every step passed, current = last
//   subscribe(fn) -> unsubscribe
// }
```

- Storage key `robo-learn:steps`, JSON object keyed by lesson id. Save on every
  change. Load once. Drop unknown lesson ids, unknown step ids, non integer
  indexes and wrong types; clamp `current` to the step range.
- A lesson with no stored record starts at `current: 0` with nothing passed.
- Every storage call inside try/catch; storage that throws means memory only.

Tests `test/stepTracker.test.js`: defaults; save and restore; corrupt JSON;
unknown ids dropped; storage that throws; reset; latch is idempotent.

### 2.3 Checks

`src/course/checks.js` (pure): `evaluate(step, ctx)` for the types above. The
context shape (built in main.js, see 2.6):

```js
{
  lessonId, lessonCompleted,          // boolean
  answers: { stepId: index },
  latched: [keys],                    // latched sim keys for this step
  sim: { phase, progress: {} },       // runner.getPhase(), runner.getProgress()
  code: { error: null | { message, line } },
  tour: { complete: boolean }
}
```

Tests `test/checks.test.js`: every type, pass and fail, feedback text for
right and wrong quiz answers, predict before and after its sim check, latched
items, `all` combining a code and a sim check.

### 2.4 Steps and the build flag

`src/course/steps.js`:
- `export const BUILD_STEPS_ENABLED = false` (phase 5 sets it to true).
- `stepsFor(lesson)`: lessons with `steps` return them, without steps of kind
  `build` or `wire` while the flag is false. Others get the phase 1 generated
  step, whose check is now `{ type: 'legacy' }`.
- `CODE_OPEN_KINDS = ['predict', 'run', 'code']`.

### 2.5 Flow

`src/course/flow.js` (pure): ties the course, tracker and checks together.

```js
// createFlow({ course, tracker, stepsFor, evaluate }) -> {
//   getView(), update(ctx), answer(stepId, option), next(), toggleOpen(index),
//   runLock() -> null | string, subscribe(fn)
// }
// getView() -> {
//   lesson, steps: [{ step, status: 'done' | 'current' | 'locked', helped, open }],
//   index, result,            // evaluate() of the current step
//   passedNow,                // current step passed: show Milestone done + Continue
//   lessonDone                // every step passed
// }
```

Rules:
- `update(ctx)` evaluates the current step. For sim items that are ok now,
  call `tracker.latch` (so they survive Stop). When the result passes and the
  step is not yet stored as passed, call `tracker.markPassed`. When every step
  of the lesson is passed and the course does not list the lesson as
  completed, call `course.markComplete(lesson.id)` once.
- Notify subscribers only when the view changed (compare a JSON string of
  `{ index, statuses, items, feedback, passedNow, lessonDone }`).
- `next()` moves `current` to the next step when the current one passed. On
  the last step it does nothing (the guide shows the next lesson button).
- `answer()` records the answer (allowed again and again for quizzes; for a
  predict step only until its `then` check has passed) and re-evaluates.
- `toggleOpen(index)` opens or closes a done step's card (read only); the
  current step's card is always open; locked steps cannot open.
- A lesson the course already lists as completed but the tracker has no
  record of: call `tracker.completeAll(lessonId)` on first view, so returning
  learners keep their progress.
- `runLock()`: on a predict step with no guess yet, `Make a guess first.`;
  otherwise null. (Phase 5 adds the circuit lock.)
- On a lesson change, the view switches to the new lesson's record.

Tests `test/flow.test.js` with a fake course (the real `createCourse` with
memory storage is fine) and a stub ctx: steps pass in order; Continue only
after passing; completing the last step calls `markComplete` once; quiz wrong
then right; latching through `update`; completed lesson migration; runLock on
a predict step.

### 2.6 Wire it up in main.js

- Create the tracker and flow after the course.
- Build the ctx in one function `currentContext()`:
  - `code.error`: `checkCode(codePanel.getSource())` from `src/sim/runner.js`,
    cached by source string (do not compile on every frame).
  - `tour.complete`: from the board tour (see 2.8).
  - `latched`: from the tracker for the current step.
- Call `flow.update(currentContext())`:
  - every animation frame while the runner is uploading or running (add an
    `onFrame` option to `createRunControls` and call it at the end of `loop`),
  - after a Stop, a lesson change, an answer, a tour change, and a code edit
    (debounced 300 ms, through `codePanel.subscribe` plus an input listener;
    add `onInput(fn)` to the code panel's return value if needed).
- Runner `onGoal`: when the lesson's steps are generated (`legacy`), call
  `course.markComplete(id)` as today. Otherwise do nothing (the flow marks
  the lesson done when its steps pass).
- Run lock: pass `getLock: () => flow.runLock()` to `createRunControls`.
  When it returns a string, Run is disabled and the status line shows the
  string. Re-check it whenever the flow notifies.
- Code panel default: on every step change (lesson or index), open the code
  panel if the current step kind is in `CODE_OPEN_KINDS`, close it otherwise.
  The learner's own open or close sticks until the step changes.

### 2.7 Guide panel steps

`src/ui/guidePanel.js` renders `flow.getView()` (subscribe to the flow, not
the course, for everything below the header):

- Step list: one `li` per step. Each row: a status icon (18px SVG: done is a
  filled `--good` circle with a white tick; current is an `--accent` ring
  with a dot; locked is a small grey padlock), the kind label (`Learn`,
  `Explore`, `Build`, `Wire`, `Predict`, `Run`, `Code`) and the title.
  - Done rows are buttons (`aria-expanded`) that toggle a read only card.
  - The current row is not a button; its card is always open.
  - Locked rows are plain text, dimmed, with `aria-label` `<title>, locked`.
- Current card, in this order:
  1. Body paragraphs.
  2. For `quiz` and `predict`: the question in bold, then one button per
     option (`.guide-option`, `aria-pressed`). A picked right quiz answer gets
     a `--good` border, a picked wrong one `--bad`; predict picks get the
     accent border only.
  3. Checklist: a box titled `To pass` with each item: an icon (filled
     `--good` circle with a tick when ok, hollow grey circle when not) and the
     text.
  4. Feedback box (when not null): tone colours as in phase 1 tokens,
     `role="status"`.
  5. Hint: when `step.hint` exists and the step has not passed, a small
     button `Hint`; clicking shows a box `Hint: <text>`. (Phase 5 replaces this
     with the ladder.)
  6. When `passedNow`: a success box with `Milestone done` in bold, `step.done`
     when present, and a `Continue` button (`flow.next()`). On the last step
     the box says `Lesson done` and shows `Next lesson: <id> <title>`
     (`course.next()`), or `You finished every lesson so far.` on the last lesson.
- Do not move keyboard focus when a step passes; the success box is inside a
  `role="status"` region so screen readers announce it.
- A small text button at the bottom of the guide, above Reference:
  `Start this lesson again`. First click changes the text to
  `Click again to start over` for 3 seconds; a second click calls
  `tracker.reset(lessonId)` and, when the lesson is completed, leaves the
  course completion as it is.

### 2.8 Board tour callback

`createBoardTour` gets an `onComplete(lessonId)` option. It calls it instead of
`course.markComplete` when every zone is opened. main.js passes a function that
records the tour as complete for the ctx and, for a lesson with a generated
step, calls `course.markComplete` (same behaviour as today for 1.1).

### 2.9 Top bar progress

Replace the Done pill with step progress: one 28px x 6px segment per step
(`--good` done, `--accent` current, `--line` locked) and a text after it:
`Step 2 of 3`, or `Done` when the lesson is done. `aria-label` on the group:
`Step 2 of 3` / `Lesson done`.

### 2.10 Lesson 1.2 steps

Add the six steps of "1.2 Blink" from `lesson-steps.md` to lesson 1.2 in
`src/course/lessons.js`, exactly as written there (the build and wire steps are
hidden by the flag until phase 5). Add a test in `test/lessons.test.js` that
every lesson's steps have unique ids, a known kind, a non empty title and body,
a check of a known type, and quiz answers inside the options range.

## Browser checks

1. Clear localStorage. Open `#1.2`. The guide shows 3 steps: `Learn What an
   LED needs` (current), `Predict Guess, then run` (locked), `Code Blink
   faster` (locked). Top bar shows 3 segments and `Step 1 of 3`. Code panel
   is closed.
2. Pick `The long leg, the anode`: red border, feedback explains. Pick `The
   short leg, the cathode`: green border, feedback, `Milestone done`, Continue.
3. Continue: predict step is current, code panel opens, Run is disabled with
   `Make a guess first.`. Pick `Blink once a second`: Run enables, feedback
   `Now press Run and watch.`. Run: after two blinks the item ticks and the
   step passes with the right explanation.
4. Continue: code step. Edit both delays to 200 and Run: `Sketch compiles` is
   ticked; after two fast blinks the step passes, the guide shows `Lesson
   done` and the top bar `Done`. The course map lists 1.2 as Done.
5. Reload the page: 1.2 is still done with all steps ticked; done steps open
   read only.
6. Start this lesson again (two clicks): back to step 1, the course map still
   says Done.
7. Open `#1.4` (generated step): it still passes after three presses, as before.
8. Break the code (delete a `;`) on the code step: `Sketch compiles` unticks
   and the feedback names the line.

## Acceptance criteria

- [ ] All 12 boards report the progress names listed in 2.1.
- [ ] Steps unlock in order and never pass by themselves twice.
- [ ] Progress survives reload; corrupt storage does not break the app.
- [ ] Lessons without steps pass exactly as before.
- [ ] Lesson 1.2 can be finished only by passing its three steps.
- [ ] No focus jumps; the success box is announced.

## AGENTS.md updates

Add a section "Lesson steps and checks" (step format, check types, ctx,
latching, the build flag, flow rules, storage key `robo-learn:steps`). Add the
new modules to the architecture tree. Under "Sims and goal checks", document
`progress()` and `runner.getProgress()`.

## Decisions made while building

- The flow fills `lessonId`, `lessonCompleted`, `answers` and `latched` into the context itself,
  from the course and the tracker; `currentContext()` in main.js only builds `sim`, `code` and
  `tour`. This keeps one source of truth for answers and latched keys.
- A step stored as passed is evaluated with its sim keys latched and its stored answer (or the
  right one, after a migration) given, so its checklist stays ticked after a reload or for a
  lesson done before steps existed. Code items stay live, so breaking the code on a passed code
  step unticks `The sketch compiles` and shows the error (browser check 8 was done this way,
  before the reset in check 6).
- Answers are accepted only for the current step and only until it passes, for quiz and predict
  alike, so a passed quiz cannot be turned wrong again.
- The tracker has `has(lessonId)` for the migration rule. `reset` leaves an empty record, so a
  reset lesson that the course lists as done is not completed again on the next view.
- A lesson change resets the flow's context to idle, so the old lesson's run progress (main.js
  feeds the flow after the run controls stop the runner) can never latch for the new lesson.
- Step rows show the done icon for a passed current step (the last step of a finished lesson),
  so all steps look ticked; the row stays the current row with its card open.
- The guide keeps the feedback and success boxes in two persistent `role="status"` regions that
  move into the current card on each render, and only changes their content when the text
  changes, so screen readers announce a pass once. Re-rendering restores focus by a
  `data-focus-key`; a passed step's answer buttons use `aria-disabled` instead of `disabled` so
  focus stays on them. After Continue, focus moves to the new current row (tabindex -1), because
  the Continue button is gone.
- Generated steps keep the phase 1 card look (lesson intro and Goal box) above the checklist.
- runControls calls `onFrame` also on Stop and on an error, which covers the "after a Stop"
  update. Code edits and slider changes update the flow 300 ms after the last change.
- 1.5 `floated` counts changes of the floating level only while it keeps floating; a press or
  fitting the pull down starts the count of the next change again. 1.7 `rampSeen` is set when the
  duty reaches one end after the other since Run, and is not cleared by a reload.
- The lessons test accepts the `circuit` check type only on build and wire steps; phase 5 adds
  that type to `checks.js`.
