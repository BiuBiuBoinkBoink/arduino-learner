# Editable code panel

> Feature: Editable code panel: learners edit the sketch, Run sends it through the code runner instead of the per lesson sim, errors show inline on the right line, and a reset button restores the lesson code

## Requirements

1. **Editor**: on lessons with a sketch, the code panel has a "Sketch" textarea
   over the coloured code, using the same font and line height so the caret
   sits on the colours. It also has a Reset code button and an error line.
   - Sliders and choices refill the text until the learner edits it. While
     the text differs from the filled template, the controls switch off with
     a note, except params with `circuit: true` (1.3 ohms, 1.5 pull), and the
     trace stops.
   - Reset restores the filled template and turns the controls back on.
   - Lessons without a sketch stay read only.
2. **Run sends the code**: the runner compiles first (`checkCode`). A compile
   or runtime error shows as `Stopped. Line N: ...` in the run status, marks
   that line in the editor, and is cleared by the next edit, Run or Reset.
3. **Boards**: each lesson sim becomes a board, made of:
   - `levels(now)`, the circuit's input levels for the sketch;
   - `output(event)` for the sketch's pin, tone and servo events, timed on the
     sketch clock;
   - optional `update`, `reload`, `stop`, `checkGoal` and `readout`.
   Goals keep their meaning; button goals also need the LED on while held.
   P1 lets the sketch take 300 ms to react.
4. **Session events**: each batch lists every output change in order with its
   virtual time. `tone(pin, hz, ms)` ends by itself.
5. **Hot reload**: a slider move while running restarts the sketch with the
   refilled code at once, keeping the board and its goal progress. The blink
   and fade boards restart their timing. Edited code waits for the next Run.
6. **Serial**: the Serial Monitor's Send goes to the running sketch, and the
   sketch's prints show in the monitor.
7. **Tests**: `test/lessonGoals.test.js` runs every lesson sketch through the
   runtime, its board and the runner. Each goal fails at the defaults and
   passes after the learner's action. There are also runner and board tests.

## Assumptions

- A slider still feels live while running (hot reload). Typed edits need Run,
  like uploading to a real board.
- Tab moves focus out of the editor, so keyboard users are never trapped;
  indent with spaces.
