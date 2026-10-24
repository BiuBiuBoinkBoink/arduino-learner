# Code runner runtime

> Feature: Code runner runtime: interpret the AST in a Web Worker against a virtual clock with digitalWrite, digitalRead, pinMode, analogRead, analogWrite, delay, millis, Serial print and read, tone, and Servo, posting pin changes to the sim, fully unit tested

## Requirements

1. **Interpreter** `src/runner/interpreter.js` `createProgram(source, hw)`:
   - It parses the source and needs `setup` and `loop`. It runs globals and
     enums, then setup, then loop forever, using generators so the sketch
     can pause.
   - Time: `advance(untilMs)` runs until the virtual clock reaches untilMs.
     `delay` waits on the clock, and every statement costs 0.005 ms, so busy
     `millis()` loops move time on.
   - Values: C integer rules. Int division truncates, and stored values wrap
     to their type (int 16 bit, long 32, byte 8, unsigned). Floats print with
     2 decimals. Chars print as characters, and Strings concatenate and
     compare.
   - Language: arrays (passed by reference, bounds checked), functions with
     a depth limit, switch with fall through, enums, const.
   - Built-ins:
     - `pinMode`, `digitalWrite`, `digitalRead`, `analogRead` (0 to 5 mean
       A0 to A5), `analogWrite`;
     - `delay`, `delayMicroseconds`, `millis`, `micros`;
     - `tone`, `noTone`;
     - `map`, `constrain`, `min`, `max`, `abs`, `sqrt`, `pow`, `sin`, `cos`,
       `random`, `randomSeed`;
     - `Serial.begin`, `print`, `println` (with digits or HEX), `available`,
       `read`, `readString`, `readStringUntil`, `parseInt`;
     - Servo `attach`, `write`, `read`, `detach`;
     - String `length`, `toInt`, `toFloat`, `trim`, `toUpperCase`,
       `toLowerCase`, `equals`, `startsWith`, `endsWith`, `indexOf`,
       `charAt`, `substring`.
   - Runtime errors are CodeErrors with the line: an index out of range, an
     undeclared name, division by zero, writing a const, an unknown
     function, the wrong number of values, runaway recursion, a pin that
     does not exist. They stop the program for good.
2. **Session** `src/runner/session.js` `createSession(source, { random })`
   holds the hardware state.
   - Input levels (0 to 1 per pin name) come from the circuit. A pin with no
     level reads HIGH with INPUT_PULLUP, else LOW.
   - `advance(untilMs)` returns a batch of changes:
     `{ pins, tones, servos, serial, millis, error }`. `analogWrite` gives
     value / 255.
   - It also has `setInputs(levels)` and `sendSerial(text)`.
3. **Worker** `src/runner/worker.js`: start, stop, inputs and serial
   messages. It advances to real elapsed time every 16 ms and posts `batch`
   messages when something changed, and `error` messages with the line.
4. **Client** `src/runner/codeRunner.js` `createCodeRunner({ onBatch, onError })`
   -> `{ start, stop, setInputs, sendSerial }`.
5. **Tests** cover timing, types, control flow, hardware, errors, and every
   lesson sketch running for 3 s.

## Out of scope

- Wiring the runner to the code panel and circuits (job 020).
