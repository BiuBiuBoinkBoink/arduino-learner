# Phase 7: Narrow screens

## Goal

The app works on tablets and phones: the guide becomes a bottom sheet, code
becomes a tab in it, the workbench overlays shrink, and placing parts works
by touch. This closes the "phone layout" known issue in README.md.

## Read first

- `src/ui/layout.js`, `src/style.css`, `src/ui/guidePanel.js`,
  `src/ui/codePanel.js` (how full screen moves the workspace),
  `src/ui/placement.js`, `src/ui/partsTray.js`, `src/ui/viewControls.js`,
  `src/ui/courseMap.js`.

## 7.1 Three layouts

New pure helper in `src/ui/layoutMode.js`:

```js
// layoutFor(width) -> 'wide' (>= 1200) | 'medium' (900 to 1199) | 'compact' (< 900)
```

`createLayout` watches the app width (ResizeObserver on `#app`) and sets
`data-layout="wide|medium|compact"` on `#app`, notifying subscribers when it
changes. All CSS for the modes keys off that attribute (not media queries), so
tests and the preview can force a mode.

### Wide

Unchanged from phases 1 to 6.

### Medium

- Grid columns: `var(--guide-w-medium) minmax(0, 1fr)` with
  `--guide-w-medium: 280px`.
- The code panel is no longer a grid column. When open it is a drawer over
  the right side of the workbench: `position: absolute; top: 0; right: 0;
  bottom: 0; width: min(420px, 60%)`, white, left border, shadow, `z-index: 5`.
  When closed, the rail is a 36px tab fixed to the right edge of the
  workbench, vertically centred, labelled `Code`.
- Run bar max width `calc(100% - 200px)`.

### Compact

- Grid: one column. Rows: top bar, workbench. The guide becomes a bottom
  sheet over the workbench.
- Top bar: hide the brand; the breadcrumb shows only `1.2 Blink`; Prev and
  Next become 32px icon buttons (chevrons) with the same `aria-label`s; the
  step progress shows only the text `Step 2 of 6`; Course map stays.
- Course map: full screen panel under the top bar.
- Workbench overlays:
  - Run bar spans the top with 8px margins; status and readout on one line
    each, ellipsis when long (full text in `title`).
  - View controls collapse into one `View` button that opens a small menu
    with the same buttons (`role="menu"` not needed: a simple popover with
    buttons, Escape closes).
  - The controls dock collapses to a `Controls` button at the bottom left
    that toggles it open (`aria-expanded`).
  - The tray sits just above the bottom sheet's peek height and scrolls
    sideways.
- Fonts stay at least 14px for body text and 12px for labels.

## 7.2 Bottom sheet

New module `src/ui/bottomSheet.js`:

```js
// createBottomSheet({ container, tabs: [{ id, label, element }] }) -> {
//   setState('peek' | 'half' | 'full'), getState(), selectTab(id), subscribe(fn)
// }
```

Pure state helper `src/ui/sheetState.js`:
`nextSheetState(state, action)` with actions `expand`, `collapse`,
`drag(dy, height)` (snap to the nearest state on release). Test it.

- Fixed to the bottom of the workbench area, full width, white, top border,
  12px top corners, shadow.
- Heights: peek 132px, half 50% of the workbench height, full
  `100% - 8px`.
- Header: a drag handle (a 36 x 4 px bar, the handle element is a button
  `aria-label="Resize the lesson panel"` that toggles peek and half on click
  and Enter), tabs `Steps` and `Code` (WAI-ARIA tabs, reuse `nextTabIndex`), and
  a button `Expand` / `Collapse` (`aria-expanded`).
- Peek shows, under the header: the current step kind and title on one line
  and a summary `2 of 3 done` of its checklist, plus the success line and
  Continue button when the step has passed (so a learner can move on without
  opening the sheet).
- The `Steps` tab holds the guide panel element; `Code` holds the code panel
  element. Move the existing elements (like full screen does with the
  workspace) when the layout changes to or from compact; never rebuild them, so
  the editor keeps its text, caret and listeners.
- Step kinds that open the code panel in wide mode select the `Code` tab in
  compact mode only when the sheet is not in peek; otherwise they leave the tab
  alone.
- Dragging: pointer events on the handle area; move the sheet with the finger;
  on release snap with `nextSheetState`. Under reduced motion, no animated
  snap.

## 7.3 Touch placement

`src/ui/placement.js`:

- For pointer events with `pointerType === 'touch'` there is no hover. A tap
  on a hole moves the candidate anchor (or the next end for bend and wire) to
  that hole and shows the ghost, but does not place.
- While a candidate exists on touch, show a floating action row above the
  tray: `Place`, `Turn` (only for parts with more than one orientation) and
  `Cancel`. `Place` confirms, `Turn` rotates, `Cancel` is Escape.
- A tap on a placed part picks it up as before.
- Two finger gestures belong to the camera; a one finger drag still orbits.
  A tap is a pointer up within 8px (touch) or 5px (mouse) of its pointer down.
- The hole tooltip shows for the tapped hole for 2 seconds.

## 7.4 Other fixes

- The board tour card: in compact mode it becomes a strip above the tray with
  the checklist in a horizontal scroll.
- Labels pinned to 3D positions shrink to 11px text and max width 160px in
  compact mode.
- Check that no element is wider than the screen at 360px (no horizontal page
  scroll).

## Tests

- `test/layoutMode.test.js`, `test/sheetState.test.js`.

## Browser checks

Use `resize_window` with 1440 x 900, 1024 x 768, 768 x 1024 and 390 x 844
(the mobile preset). Check each:

1. 1024 x 768 (medium): guide on the left, code as a drawer over the
   workbench, the Code tab on the right edge when closed. Lesson 1.2 can be
   finished.
2. 768 x 1024 and 390 x 844 (compact): bottom sheet in peek shows the step
   and checklist summary; Expand opens it; Steps and Code tabs work; the editor
   keeps its text after switching tabs and after rotating to landscape and back.
3. 390 x 844: build 1.2 by touch: tap the LED in the tray, tap a hole, the
   ghost shows, Turn, Place. Wire with taps. Continue from the peek.
4. Course map is full screen and closes with its button and Escape.
5. No horizontal scroll at 360 x 740.
6. Back to 1440 x 900: the wide layout returns with the guide and code panel
   in their columns and nothing lost.
7. Reset the viewport to desktop when done.

## Acceptance criteria

- [ ] Every lesson can be finished at 390 x 844 by touch.
- [ ] Nothing overlaps or scrolls sideways from 360px up.
- [ ] Moving between layouts keeps the editor, the step and the build.
- [ ] README "Known issues" no longer lists the phone layout.

## AGENTS.md updates

Describe the three layouts, `data-layout`, the bottom sheet, moving the panels
between layouts, and touch placement.

## Decisions made while building

(Write any choice you had to make here.)
