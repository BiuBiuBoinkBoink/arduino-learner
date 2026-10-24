# Code checks for goals

> Feature: Code checks for goals: goal checks can inspect the learner's code (for example count delay() calls) and measure timing (for example button response under 50 ms)

No new lessons and no goal changes (owner's request). This job adds the tools
future goals will use and shows them in one readout.

## Requirements

1. **Code inspection** `src/runner/codeChecks.js`:
   - `analyzeCode(source)` returns `{ error, calls, functions, includes }`.
     Calls are named as written (`delay`, `Serial.println`, `arm.write`) with
     their line and the function they are in. Code that does not parse gives
     `error` instead of throwing.
   - Helpers: `findCalls`, `countCalls` and `callLines` (each with an
     optional `{ inFunction }`), and `definesFunction`.
2. **Boards get the code**: the runner passes `getCode()`, the analysis of the
   code now running, refreshed on reload.
3. **Input events**: the session records each real input change as
   `[ms, 'input', pin, level]`, at the time the sketch first sees it. The
   worker posts batches that hold only events, and the runner passes input
   events to the board only (no store changes).
4. **Response timer** `src/sim/responseTimer.js`
   `createResponseTimer({ inputPin, outputPin })` measures from an input change
   to the next output change, both on the sketch clock. It provides
   `output(event)`, `times()`, `last()`, `worst()` and `waiting(at)`.
5. **Shown in 1.4**: the readout adds `reacts in N ms` (or `under 1 ms`). The
   1.4 goal is unchanged.
6. **Tests**: analysis, the timer, session input events, the runner passing
   `getCode` and input events, and 1.4 end to end: under 1 ms with the lesson
   sketch, and over 50 ms when the learner adds `delay(200)` to the loop.

## Assumptions

- Timing is on the sketch clock, so worker messages do not add lag.
- Future lessons (on hold) can now write goals like `countCalls(getCode(),
  'delay') === 0` or `timer.worst() < 50`.
