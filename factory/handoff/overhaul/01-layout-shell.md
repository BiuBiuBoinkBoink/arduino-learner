# Phase 1: Layout shell

## Goal

Replace the floating panels (info left, code right, lesson strip bottom) with
a grid layout: a top bar, a step guide on the left, the 3D workbench in the
middle and a collapsible code panel on the right. The run controls and part
controls move onto the workbench. A course map replaces the lesson strip.

**Nothing about how a lesson passes changes in this phase.** Every lesson
shows a single step made from its existing goal text, and the runner still
marks the lesson done exactly as today.

## Read first

- `src/main.js`, `src/ui/panels.js`, `src/ui/lessonStrip.js`,
  `src/ui/infoPanel.js`, `src/ui/codePanel.js`, `src/ui/runControls.js`,
  `src/ui/boardTour.js`, `src/scene/stage.js`, `src/style.css`,
  `src/course/state.js`, `src/course/lessons.js` (first two lessons).

## Out of scope

Steps, checks, quizzes (phase 2). Part placement (phase 4). Phone layout
(phase 7; just keep it from breaking worse than today).

## Target layout

```
+--------------------------------------------------------------------------+
| #top-bar: brand | Level 1 Basics / 1.2 Blink | progress | Prev Next | Map |
+-----------------+--------------------------------------+-----------------+
| #guide-panel    | #workbench                           | #code-panel     |
|  lesson header  |  #run-bar (top left)  #view-controls |  (open: sketch, |
|  step card      |                       (top right)    |   params, run   |
|  Reference      |        #stage (fills workbench)      |   errors,       |
|   (details)     |                                      |   serial)       |
|                 |  #controls-dock (bottom left)        |  (closed: rail) |
+-----------------+--------------------------------------+-----------------+
```

- `#app` is a CSS grid: rows `var(--topbar-h) minmax(0, 1fr)`, columns
  `var(--guide-w) minmax(0, 1fr) auto`, height 100%.
- `#top-bar` spans all columns. `#guide-panel` is row 2 column 1,
  `#workbench` row 2 column 2, `#code-panel` row 2 column 3.
- `#workbench` is `position: relative; overflow: hidden`. `#stage` is
  `position: absolute; inset: 0` inside it (no longer `position: fixed`).
  Overlays inside the workbench are `position: absolute` with `z-index: 2`.
- `#code-panel` is `width: var(--code-w)` when open and `var(--rail-w)` when
  closed, with `transition: width 0.25s ease` (none under reduced motion).
- Panels are solid (`background: var(--panel)`), separated by 1px borders
  in `var(--line)`. No rounded floating panels except the overlays on the
  workbench.

### CSS tokens

Put these at the top of `src/style.css` in `:root` and use them everywhere you
touch. Keep the existing `font-family` and stage background colour.

```css
:root {
  --ink: #1d2330;
  --muted: #5d6676;
  --line: #d5d9e0;
  --panel: #ffffff;
  --soft: #f3f4f7;
  --accent: #2f6fd6;
  --accent-soft: #e4ecfb;
  --good: #1d7f53;
  --good-soft: #e2f3ea;
  --bad: #c0392b;
  --bad-soft: #fbe8e5;
  --overlay-shadow: 0 2px 10px rgba(29, 35, 48, 0.14);
  --topbar-h: 52px;
  --guide-w: clamp(280px, 24vw, 360px);
  --code-w: clamp(320px, 28vw, 440px);
  --rail-w: 44px;
  --gap: 12px;
}
```

Remove `--strip-height` and `--side-width` and every rule for
`#lesson-strip`, `.strip-nav`, `.lesson-cards`, `.lesson-card*` and
`.lesson-progress`.

## Work items

### 1.1 Level titles and goal text helper

- `src/course/lessons.js`: add and export
  ```js
  export const levels = [
    { id: 1, title: 'Basics' },
    { id: 2, title: 'Programming properly' },
    { id: 3, title: 'Communication' },
    { id: 4, title: 'Robot hardware' },
    { id: 5, title: 'Beyond the Uno' }
  ]
  ```
- New pure module `src/course/goalText.js`:
  ```js
  // splitGoal(paragraphs) -> { intro: string[], goal: string | null }
  ```
  Finds the first paragraph containing `'Goal: '`. Text before `'Goal: '` in
  that paragraph (trimmed, if not empty) stays in `intro`; the text after it is
  `goal`. Paragraphs before it go to `intro`, paragraphs after it are appended
  to `intro` too. No match: `{ intro: paragraphs.slice(), goal: null }`.
  Lesson 1.12 has text before `Goal:` in the same paragraph; that is the case
  the trim handles.
- Test `test/goalText.test.js`: no goal; goal as its own last paragraph
  (lesson 1.2); goal in the middle of a paragraph (lesson 1.12, check the
  intro keeps "Using the Servo library turns off PWM on pins 9 and 10, so keep
  LEDs that fade on other pins."); every lesson in `lessons` except 1.1 has a
  goal.

### 1.2 Generated steps

New pure module `src/course/steps.js` (phase 2 extends it):

```js
// stepsFor(lesson) -> step[]
// Lessons with lesson.steps return them. Others get one generated step:
// { id: 'goal', kind: 'run', title: 'Goal', body: [goal], check: { type: 'legacy' } }
// For lesson 1.1 (it has lesson.tour): kind 'explore', title 'Tour the board',
// body: ['Click each part of the Uno to see what it does.'].
```

Test in `test/steps.test.js`: 1.1 gets the explore step, 1.2 gets a run step
whose body is the 1.2 goal text, a lesson object with `steps` returns them.

### 1.3 Camera views

New pure module `src/scene/cameraMath.js`:

```js
// easeInOut(t) -> number, cubic, t clamped to 0..1
// lerpVec(a, b, t) -> { x, y, z } (plain objects, no three.js)
// viewFor(kind, box, { fov, aspect }) -> { position: {x,y,z}, target: {x,y,z} }
//   box is { min: {x,y,z}, max: {x,y,z} } around what to frame.
//   kind '3d': target = box centre; camera on the +z side at 45 deg elevation,
//     far enough that the box width and depth fit with 10% margin.
//   kind 'top': target = box centre; camera straight above the centre at
//     position { x: cx, y: cy + d, z: cz + 0.001 } (the tiny z offset keeps
//     OrbitControls stable), d chosen so the box fits with 10% margin.
//   Fit distance: d = max(halfWidth / tan(hfov / 2), halfDepth / tan(vfov / 2)) * 1.1,
//     where vfov = fov in radians and hfov = 2 * atan(tan(vfov / 2) * aspect).
```

`src/scene/stage.js` gains:

```js
// setView(kind, box, { animate = true } = {}) -> Promise<void>
//   Tweens camera.position and controls.target over 450 ms with easeInOut,
//   calling controls.update() and invalidate() every frame. Jumps when animate
//   is false or the user prefers reduced motion. A new call cancels a running one.
// getView() -> 'top' | '3d' | 'custom'  (custom once the user orbits after a setView)
```

Track "custom": listen to the controls `start` event (user started orbiting)
and set the view to `'custom'` unless a tween is running.

Test `test/cameraMath.test.js`: easeInOut ends; top view is straight above the
centre; distance grows when the box grows; a wide aspect needs less distance
than a tall one for a wide box.

### 1.4 Layout module

Replace `src/ui/panels.js` with `src/ui/layout.js`:

```js
// createLayout(app) -> {
//   topBar, guide, workbench, stageEl, runBar, viewControls, dock, codePanel,
//   setCodeOpen(on), isCodeOpen(), subscribeCode(fn)
// }
```

- Builds the elements with ids `top-bar` (a `header`), `guide-panel` (an
  `aside`, `aria-label="Lesson guide"`), `workbench` (a `main`,
  `aria-label="Workbench"`), `stage` (a `div` inside the workbench),
  `run-bar`, `view-controls`, `controls-dock` (each a `div` inside the
  workbench), `code-panel` (an `aside`, `aria-label="Code"`).
- `setCodeOpen(on)` toggles class `is-closed` on `#code-panel`, notifies
  subscribers, and dispatches a `resize` on the next frame is not needed
  (the stage ResizeObserver handles it).
- Delete `src/ui/panels.js` and `src/ui/lessonStrip.js`.

### 1.5 Top bar

New `src/ui/topBar.js`:

```js
// createTopBar(container, course, { levels, onOpenMap }) -> { mapButton }
```

Content, left to right:
1. Brand text `Robo Learn` (a `span`, bold).
2. Breadcrumb `Level 1 Basics / 1.2 Blink` (level title from `levels`;
   lesson id and title in bold).
3. Lesson status pill: `Done` (good colours) when the lesson is completed,
   otherwise hidden. Phase 2 replaces it with step progress.
4. `Prev` and `Next` buttons (`course.prev()` / `course.next()`), disabled at
   the ends, `aria-label="Previous lesson"` / `"Next lesson"`.
5. `Course map` button, `aria-haspopup="dialog"`, `aria-expanded` kept in
   sync by the course map.

Re-render on every course notification.

### 1.6 Course map

New `src/ui/courseMap.js`:

```js
// createCourseMap({ container, course, levels, button }) -> { open(), close(), isOpen() }
```

- A popover (`div`, `role="dialog"`, `aria-label="Course map"`,
  `id="course-map"`) anchored under the top bar at the right, width 360px,
  max height `calc(100% - var(--topbar-h) - 24px)`, scrolls inside.
- Header: `Course map`, then a progress line `N of 13 lessons done` with a
  `progress` element (this replaces the strip's progress bar).
- One section per level that has lessons: heading `Level 1 Basics`, then one
  button per lesson: id, title, status text on the right (`Done`, `Up next`
  for the first not done lesson in course order, else nothing). The current
  lesson has `aria-current="true"` and the accent soft background.
- Under the last level: `More levels arrive as they are built.` in muted text.
- Clicking a lesson calls `course.goTo(id)` and closes the map.
- Opening focuses the current lesson's button. `Escape` closes and returns
  focus to the Course map button. A click outside the map and the button
  closes it. Arrow Up and Down move focus between lesson buttons.
- Pure helper in `src/course/progress.js`:
  `lessonStatus(lessons, completed, id) -> 'done' | 'next' | ''`. Test it.

### 1.7 Guide panel

New `src/ui/guidePanel.js`:

```js
// createGuidePanel(container, course) -> { referenceBody }
```

Structure:
1. Header: small uppercase label `Lesson 1.2`, title `Blink` (an `h2`), and
   the lesson summary as a muted paragraph.
2. The step list (`ol.guide-steps`). In this phase there is only one step from
   `stepsFor(lesson)`; render it open as a card: a kind label (uppercase,
   muted: `Explore`, `Run` ...), the title in bold, the intro paragraphs from
   `splitGoal(lesson.overview).intro`, then the goal as a highlighted box
   titled `Goal` with the goal text. When the lesson is completed, add a
   success box: `Lesson done.` plus, unless it is the last lesson, a button
   `Next lesson: <id> <title>` that calls `course.next()`.
3. A `details` element `.guide-reference` with `summary` text `Reference`,
   closed by default, at the bottom. Its body hosts the info tabs.

`src/ui/infoPanel.js`: add an options argument
`createInfoPanel(panel, course, { heading = true } = {})`; with
`heading: false` it does not render its `h2`. The guide passes
`{ heading: false }` and the details body as `panel`. Keep the tab behaviour
and ids exactly as they are. The Overview tab keeps showing the full overview
(including the goal) so nothing is lost.

### 1.8 Code panel open and closed

`src/ui/codePanel.js`:
- Remove the `Code` heading and lesson line from the top (the top bar shows
  the lesson). Put a header row instead: `h2.panel-heading` with text `Code`
  and a button `.code-collapse` with an icon (chevron pointing right) and
  `aria-label="Hide code"`.
- Add a rail button `.code-rail` (shown only when the panel is closed): a
  full height button with vertical text `Code` (`writing-mode: vertical-rl`)
  and `aria-label="Show code"`, `aria-expanded="false"`.
- The panel does not own open state; it takes `layout.setCodeOpen` through a
  new option: `createCodePanel(panel, course, { setOpen })`. Collapse calls
  `setOpen(false)`, the rail calls `setOpen(true)`.
- Default per lesson, applied on every lesson change in `main.js`: open when
  the lesson has a `sketch`, closed otherwise (lesson 1.1).
- When closed, everything except the rail is hidden (`display: none`), so the
  full screen editor cannot be opened from a closed panel.

### 1.9 Run bar, view controls and controls dock

- `main.js` creates the run controls with `container: layout.runBar`
  instead of the code panel toolbar. Restyle `.run-controls` as a floating bar:
  white, border, `border-radius: 10px`, `box-shadow: var(--overlay-shadow)`,
  `padding: 6px 10px`, row layout: buttons, then a column with status and
  readout. Max width `calc(100% - 260px)`. Keep every class name and string.
- Hold to press, Knob slider, room sliders, Sound toggle and Meter select are
  created with `container: layout.dock` instead of the toolbar. `#controls-dock`
  is a floating panel at bottom left (`left: 12px; bottom: 12px`), white,
  border, radius 10px, shadow, padding 10px, column layout with 8px gap, a
  heading `Controls` (small uppercase muted). Hide the whole dock when every
  child control is hidden:
  `#controls-dock:not(:has(> :not([hidden]):not(.dock-heading))) { display: none; }`
- New `src/ui/viewControls.js`:
  ```js
  // createViewControls({ container, stage, getFrameBox }) -> { setView(kind, opts) }
  ```
  Three buttons in a segmented group (`role="group"`,
  `aria-label="Camera view"`): `Top view`, `3D view`, `Reset view`. Top and 3D
  have `aria-pressed` matching `stage.getView()` (neither pressed when
  custom). Reset view calls `stage.setView('3d', box)`. `getFrameBox()` in
  main.js returns the `Box3` around the Uno and breadboard groups (as plain
  min/max objects).
- On first load the camera stays where it is today (do not call setView).

### 1.10 Split main.js

`main.js` is getting too big for the coming phases. Split it without changing
behaviour:

- `src/app/scene.js`: `createScene(stageEl)` builds the stage, the Uno and
  the breadboard (same positions as today) and returns
  `{ stage, board, breadboard, frameBox() }`.
- `src/app/circuitView.js`: `createCircuitView({ stage, board, breadboard, pins, servos, tones, getValues })`
  owns the current circuit group: `show(circuitTable | null)`, `items()`,
  `table()`, `relight(name?)`, plus the LED lighting, servo and buzzer
  subscriptions from main.js. Its `show` does what `showCircuit` does today
  for geometry (remove, dispose, build, light, showWhen) and returns the new
  items. The per lesson control targets (hold button, knob, meter, room,
  sound, servo centring) stay in main.js and run after `show`.
- `main.js` composes everything. Keep the order of creation where it matters
  (the code panel before the first circuit build, as the comment says today).

### 1.11 Board tour placement

`createBoardTour({ ..., container })` gets `layout.workbench` as its
container. Move `.tour-card` to `position: absolute; right: 12px; top: 64px;`
inside the workbench (below the view controls), width 300px. The tour label
stays as it is (it follows the pointer).

### 1.12 Styles

- Top bar: height `var(--topbar-h)`, flex row, 16px side padding, 16px gap,
  bottom border. Prev/Next and Course map are 32px high buttons with a 1px
  border and 8px radius.
- Guide: 16px padding, scrolls on its own (`overflow-y: auto`).
- Step card: `background: var(--soft)`, 1px border, 10px radius, 12px
  padding. Kind label 11px bold uppercase muted with 0.06em letter spacing.
- Goal box: `background: var(--accent-soft)`, `border-left: 3px solid var(--accent)`,
  8px radius on the right corners, 8px 10px padding, heading `Goal` bold.
- Success box: `background: var(--good-soft)`, 1px border `var(--good)`.
- All buttons keep a visible `:focus-visible` outline `2px solid var(--accent)`.

## Tests

- New: `test/goalText.test.js`, `test/steps.test.js`,
  `test/cameraMath.test.js`, `test/progress.test.js`.
- Existing tests must pass unchanged.

## Browser checks

1. Open `#1.2`. Top bar shows `Robo Learn`, `Level 1 Basics / 1.2 Blink`,
   Prev, Next and Course map. Guide shows the 1.2 header, one `Run` card with
   the intro paragraphs and a Goal box. Code panel is open with the sketch.
2. Run bar is at the top left of the workbench. Press Run: it uploads, runs,
   the LED blinks and the readout shows under the status. Stop works.
3. Set On time and Off time to 200 ms, Run: the status says
   `Goal met. Lesson done.`, the top bar pill says Done, the guide shows the
   success box with `Next lesson: 1.3 Resistors and Ohm's law`. Click it: 1.3
   opens.
4. Course map: opens under the top bar, focus is on 1.3, `1 of 13 lessons done`
   (or more if your storage has progress), 1.2 says Done. Arrow keys move,
   Escape closes and focus returns to the button. Clicking 1.4 opens 1.4.
5. 1.4: the Controls dock at bottom left shows `Hold to press`. Run and hold:
   the LED lights. 1.6 shows the Knob slider, 1.9 the Room light slider, 1.11
   the Sound toggle, 1.3 the Meter select. 1.2 shows no dock at all.
6. Hide code (chevron): the panel collapses to a rail and the 3D view grows.
   Show code (rail): it opens again. Full screen editor still works.
7. View buttons: Top view moves the camera above the boards smoothly; 3D view
   back; orbit with the mouse and both buttons show unpressed; Reset view goes
   back to 3D.
8. 1.1: code panel closed, tour card inside the workbench, clicking all six
   zones still completes the lesson (Done pill).
9. Reference: open the details, all four tabs work with arrow keys.
10. Resize the window to 1024 x 700: nothing overlaps, the workbench shrinks.

## Acceptance criteria

- [ ] No `#lesson-strip`, `#info-panel` element or their CSS remains.
- [ ] Every lesson passes exactly as before (lessonGoals test unchanged and passing).
- [ ] Every control from before is reachable, in its new place.
- [ ] Camera view buttons work and respect reduced motion.
- [ ] The code panel opens and closes, and defaults by lesson.
- [ ] main.js is split as described and is under 200 lines.

## AGENTS.md updates

Update the architecture tree for: `src/app/`, `src/ui/layout.js`,
`src/ui/topBar.js`, `src/ui/courseMap.js`, `src/ui/guidePanel.js`,
`src/ui/viewControls.js`, `src/course/goalText.js`, `src/course/steps.js`,
`src/course/progress.js`, `src/scene/cameraMath.js`, the stage `setView`, the
removed panels and strip. Replace the line about `style.css` ("full viewport
layout: stage behind, panels on the edges") with the grid description.

## Decisions made while building

(Write any choice you had to make here.)
