# Serial Monitor panel

> Feature: Serial Monitor panel with scrolling output, a text input that sends lines to the running sketch, and a clear button

## Requirements

1. **Serial port** `src/sim/serial.js` `createSerial({ maxLines = 200 })`:
   - Output: `print(value)` and `println(value)` build lines (floats print
     with 2 decimals, like Arduino), `getLines()` returns them with the
     partial last line, and `clear()` empties them.
   - Input: `send(text)` queues a line plus a newline. `available()` gives
     the number of bytes waiting, `read()` returns the next char code or -1,
     `readLine()` returns the next full line or null, and `clearInput()`
     drops what is waiting.
   - `subscribe(fn)` fires `'output'` or `'input'`.
   - `createTicker(periodMs, startedAt).due(now)` counts the loop runs that
     are due, at most 5 after a stall.
2. **Runner** passes `serial` to sims and drops unread input when a run starts.
3. **Sims print like their sketches**: 1.6 prints the volts (2 decimals)
   every 200 ms, and 1.10 prints `<deg C> deg C` every 1000 ms.
4. **Panel** `src/ui/serialMonitor.js` `createSerialMonitor({ container, serial })`
   returns `{ setVisible(on) }`. A `#serial-panel` section titled "Serial
   Monitor" sits above the lesson strip, between the side panels. It has:
   - a Clear button;
   - a scrolling `pre` output (`role="log"`, not live, focusable) that stays
     at the bottom unless the learner has scrolled up;
   - a "Send" form whose text input sends the line on submit and empties.
5. **Shown only** on lessons where `usesSerial(lesson)` is true (the sketch,
   or the example when there is no sketch, contains `Serial.begin`): 1.6 and
   1.10 now. The output is cleared on every lesson change.
6. Tests, AGENTS.md, README and backlog are updated.

## Assumptions

- Sent lines are not echoed, like the Arduino IDE. No current lesson reads
  input; Level 2 sims (2.2 Serial commands) will use `readLine()`.
- The readout line stays as a short status next to Run.
