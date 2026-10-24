# Lesson overhaul: master plan

This folder is the full plan for the lesson overhaul. It turns each lesson into
milestones (steps) that unlock in order, makes learners place every part and
wire by hand, adds smart hints, rearranges the screen, and finally adds
explain tools and a help chat.

The proposal this plan comes from (with a clickable mockup of the new lesson
screen) is the "Robo Learn Lesson Overhaul" page the owner has. Everything you
need is written down here; you do not need the page.

## Files in this folder

| File | What it is |
| --- | --- |
| `00-plan.md` | This file: rules, decisions, glossary, order of work, progress log |
| `01-layout-shell.md` | Phase 1: new screen layout, no change to how lessons pass |
| `02-milestone-engine.md` | Phase 2: steps, checks, per step progress, lesson 1.2 as steps |
| `03-netlist-footprints.md` | Phase 3: power rails, part footprints, connection checker (pure) |
| `04-placement.md` | Phase 4: workbench state, parts tray, placing parts and wires |
| `05-build-steps-hints.md` | Phase 5: build and wire steps, mistake messages, hint ladder |
| `06-lessons-converted.md` | Phase 6: every lesson as steps, breadboard steps in 1.1 |
| `07-narrow-screens.md` | Phase 7: tablet and phone layout |
| `08-explain-tools.md` | Phase 8: x-ray, current trace, scope, connections, part cards, what if |
| `09-help-chat.md` | Phase 9: Ask tab, tutor server, tool calls |
| `lesson-steps.md` | The step content for every lesson (used by phases 2, 5 and 6) |

## How to work through this plan

1. Read this whole file, then `AGENTS.md` and `README.md` in the repo root.
2. Do the phases strictly in order, 1 to 9. Each phase builds on the ones
   before it. Do not start a phase until the one before it is finished and
   committed.
3. For each phase: read its whole file first, then do its work items in the
   order given. Each work item names the files it touches.
4. When a phase file and the existing code disagree about something the phase
   file does not change on purpose, follow the existing code and AGENTS.md.
5. When something is not specified, pick the simplest option that fits
   AGENTS.md and the surrounding code, and write the choice into the "Decisions
   made while building" section at the bottom of that phase file. Do not stop to
   ask unless you are truly blocked.
6. Do not do work from a later phase early, and do not add features that no
   phase asks for.

## Branch and git rules (these override AGENTS.md for this work)

- All work happens on the branch `feature/lesson-overhaul`. It already exists
  and holds this plan. Check it out: `git checkout feature/lesson-overhaul`,
  then `git pull`.
- **Do not merge into `main`. Do not open a pull request.** The owner will
  review and merge later. This overrides steps 3 and 4 of "Git and pull
  requests" in AGENTS.md.
- If `main` moves while you work, do not merge it in unless a phase is blocked
  by it. If you must, use `git merge main` (never rebase), run the validation,
  then push.
- Commit as you go: one commit per work item or smaller, short one line
  messages in the style of `git log --oneline` (for example
  `Add step tracker with per step progress in localStorage`). Stage explicit
  paths, never `git add -A`.
- Before every commit run `npm test` and `npm run build`. Both must pass.
- Push after each finished phase: `git push`. Never force push.
- End each phase with a commit titled `Finish overhaul phase N: <name>` that
  ticks the phase in `factory/backlog.md`, updates AGENTS.md and README.md,
  and adds a line to the progress log at the bottom of this file.

## Verifying in the browser

Every phase that changes what the app shows must be checked in a real browser
before it is called finished.

- Start the dev server with the preview tool, using the `arduino-learner`
  configuration in `../.claude/launch.json` (port 7100). Without the preview
  tool, run `npm run dev -- --port 7100 --strictPort` in the background.
- Test at a desktop size of 1440 x 900 unless the phase says otherwise.
- Check the console for errors after each check. There must be none.
- Each phase file lists its browser checks. Do every one, in order.
- Take a screenshot at the end of each phase and describe it in the progress
  log line (what is on screen).

## Decisions already made

The owner was given these as recommendations. Build to them.

1. **Any working layout passes.** Build checks compare what is connected to
   what (a netlist), not exact holes.
2. **Later lessons start with earlier circuits in place.** A lesson lists
   `prebuilt` parts from its reference circuit; they appear placed and marked
   "Built earlier". The Level 1 project P1 starts from an empty breadboard.
3. **Lessons are never locked.** The course map shows every lesson and marks
   the recommended next one. Only steps inside a lesson are locked.
4. **The breadboard gets power rails** (phase 3). Existing reference circuits
   do not have to use them.
5. **Breadboard basics are new steps at the end of lesson 1.1**, which is
   renamed "Meet the Uno and breadboard". No new lesson ids.
6. **"Do it for me" costs nothing.** The step is stored as helped, nothing more.
7. **Sliders stay.** They show on run, predict and code steps (the code panel
   is closed on build steps anyway).
8. **Help chat is off by default** and only appears when the build is
   configured for it. It keeps no chat text anywhere (memory only), and it
   stays on course topics. The owner has not said how old learners are, so
   assume they may be under 18.

## Glossary

| Word | Meaning |
| --- | --- |
| Step | One milestone inside a lesson. Has a kind, a title, text, a check and optional hints. |
| Kind | `learn`, `explore`, `build`, `wire`, `predict`, `run` or `code`. Sets the layout for the step. |
| Check | Data that says when a step passes. Evaluated by `src/course/checks.js`. |
| Context (ctx) | Everything a check can look at: answers, sim progress, the built circuit, the code, events. |
| Reference circuit | The lesson's table in `src/circuits/circuits.js`. Since phase 4 it is the answer key, not what is drawn. |
| Build | The learner's own circuit table, held by the workbench (`src/build/workbench.js`). |
| Kit | The parts and wires a lesson puts in the tray. Derived from the reference circuit unless the lesson gives one. |
| Prebuilt | Reference parts placed for the learner when a lesson opens. |
| Terminal | One electrical end of a part, written `id.name`, like `led1.anode` or `r1.a`. |
| Net | A set of things joined electrically: terminals, Uno pins, strips and rails. |
| Strip | Five breadboard holes that are joined: `12-top` (12a to 12e) or `12-bottom` (12f to 12j). |
| Rail | A power rail along a long edge of the breadboard: `T+`, `T-`, `B+`, `B-`. |
| Netlist | The nets of a circuit, made by `src/circuits/netlist.js`. |
| Hint ladder | Level 0 where to look, 1 nudge, 2 show me, 3 do it for me. |

## Order of work

| Phase | Name | Depends on | Size |
| --- | --- | --- | --- |
| 1 | Layout shell | nothing | medium |
| 2 | Milestone engine | 1 | large |
| 3 | Netlist, footprints and power rails | nothing new (pure), but do it after 2 | large |
| 4 | Placement | 3 | very large |
| 5 | Build steps and hints | 2, 4 | large |
| 6 | Lessons converted | 5 | large (mostly content and tests) |
| 7 | Narrow screens | 6 | medium |
| 8 | Explain tools | 6 | very large |
| 9 | Help chat | 8 | large |

## Global conventions for this work

All of AGENTS.md "Conventions" still applies. In particular:

- **ASCII only** in every file, including these plan files, lesson text and UI
  copy. No curly quotes, no arrows, no em dashes, no special symbols. Write
  `ohm`, `deg C`, `->`, `<=`.
- **UI copy**: short sentences, plain words, no emoji, no exclamation marks.
  Every string in the UI must match the exact copy given in the phase files
  where one is given.
- **Text with `textContent`, never `innerHTML`.** SVG built with
  `document.createElementNS`.
- **Pure logic in pure modules** (no DOM, no three.js unless the module is a
  scene module): `src/course/`, `src/circuits/` (except `buildCircuit.js`),
  `src/build/`, `src/explain/` (except files that say otherwise), `src/sim/`,
  `src/runner/`, `src/tutor/` (except `chat.js` network code). Every pure module
  gets unit tests in `test/`.
- **localStorage** keys start with `robo-learn:`. Wrap every access in
  try/catch, and treat stored data as untrusted (validate shape, drop unknown
  ids).
- **Render on demand**: any scene change calls `stage.invalidate()`.
- **Accessibility**: every interactive element is a real button, input or
  link with a visible focus ring. Anything you can do with the mouse in 3D has
  a keyboard path. Live text that changes on its own uses `aria-live="polite"`.
- **Motion**: every animation and camera move checks
  `window.matchMedia('(prefers-reduced-motion: reduce)')` and jumps instead.
- **Tests stay green**: `test/lessonGoals.test.js` must keep passing in every
  phase. A phase may change a test only where its file says so.

## Definition of done for every phase

- [ ] All work items in the phase file are done.
- [ ] All acceptance criteria in the phase file are met.
- [ ] `npm test` and `npm run build` pass.
- [ ] All browser checks in the phase file were done, with no console errors.
- [ ] AGENTS.md describes every new or changed module and format (the
      architecture tree, and new sections where the phase file asks).
- [ ] README.md "Where the project is" has a line for the phase.
- [ ] `factory/backlog.md` item ticked with `-> feature/lesson-overhaul`.
- [ ] Progress log line added below.
- [ ] Pushed to `origin/feature/lesson-overhaul`. Not merged.

## Progress log

Add one line per finished phase: date, phase, commit hash, test count, what
the final screenshot shows, anything not verified.

- 2026-10-25: plan written.
- 2026-10-25: phase 1 layout shell, last code commit b3930b4, 475 tests. Final screenshot at 1440 x 900 on
  1.2: top bar (Robo Learn, Level 1 Basics / 1.2 Blink, Prev, Next, Course map), guide with the Run
  card and Goal box, the Run bar and Top/3D/Reset buttons over the Uno and breadboard, and the open
  code panel with On time and Off time sliders. No console errors. Not verified: the 450 ms tween
  was not watched frame by frame (the browser pane only ran frames while visible; top, 3D, orbit
  and reset were each checked in screenshots), and reduced motion was not emulated.
- 2026-10-25: phase 2 milestone engine, last code commit c6d048c, 528 tests. Final screenshot at
  1440 x 900 on 1.2 after Start this lesson again: top bar with three step segments (first accent)
  and Step 1 of 3, the guide with the Learn card (two paragraphs, the question and three options,
  To pass with Answer the question, Hint), Predict and Code rows locked, Start this lesson again,
  the Run bar, the Uno and breadboard, and the code panel folded to its rail. All 8 browser checks
  done; no app console errors (three setPointerCapture errors came from synthetic test events).
  Not verified: a real mouse hold on the 3D button (1.4 was passed through the Hold to press
  keyboard path), screen reader announcements (only the role="status" markup was checked), and
  check 8 was done on the passed code step before the reset rather than after check 7.
- 2026-10-25: phase 3 netlist and footprints, last code commit cf7142c, 617 tests. Final screenshot
  (pane width, about 800 px) on 1.2 in Top view: the Uno on the left and the breadboard on the
  right with all four rails, red stripes outside the + rails and blue stripes inside the - rails,
  the red LED, resistor and two wires, and the guide with the Learn step. Browser checks: 1.2,
  1.4, 1.8 and P1 draw their circuits, 1.8 still passes (orange, Goal met), rails in the 3D and
  Top views do not overlap the Uno; no console errors. Not verified in the browser: P1 passing
  (covered by test/lessonGoals.test.js, the 24 s day was not run because the pane throttled
  frames), and the rail check was done at the pane's own size (about 800 x 670) because
  screenshots under 1440 x 900 emulation came back scaled.
