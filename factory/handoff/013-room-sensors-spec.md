# Room controls, LDR and TMP36, lessons 1.9 and 1.10

> Feature: Room environment controls for light level and temperature, LDR and TMP36 parts, and lessons 1.9 Light sensor and 1.10 Temperature

## Requirements

1. **Room store** `src/sim/room.js` `createRoom()`: `getLight()` (0 to 1,
   default 0.8), `getTempC()` (0 to 40, default 22), `setLight`, `setTempC`
   (clamped), `reset()`, and `subscribe(fn)` firing `(name, value)` with
   `light` or `tempC`, only on a real change. One shared room in `main.js`,
   passed to every sim by the runner as `room`.
2. **Room controls** `src/ui/roomControls.js` `createRoomControls({ container, room })`
   returns `{ setSensors({ light, temp }) }`. It adds "Room light" (0 to 100 %)
   and "Room temperature" (0 to 40 deg C) sliders below the Run row. Each is
   shown only on lessons whose circuit has an `ldr` or a `tmp36`, and follows
   the room both ways. `main.js` resets the room on every circuit build.
3. **Daylight**: `stage.setDaylight(level)` scales the hemisphere and sun
   lights, relative to the default 0.8. `main.js` calls it on light changes.
4. **Parts**: `createLdr({ from, to })`, an upright disc with a wavy track on
   two legs. `createTmp36({ legs })`, a black TO-92 half cylinder with its
   flat face to +z on three legs. Circuit types `ldr` (`from`, `to`) and
   `tmp36` (`at`, the same three holes as a potentiometer: +Vs, Vout, GND).
5. **1.9 circuit**: 5V goes to `4a`, the LDR runs `4c` to `7c`, A0 goes to `7a`,
   a 10 kohm resistor runs `7d` to `11d`, and GND.2 goes to `11a`. The button
   lessons' D13 LED sits in columns 20 to 25.
6. **1.9 sim** `src/sim/light.js`: LDR from 1 Mohm (dark) to 1 kohm (bright),
   log scale. A0 is the divider level, and D13 is on while raw is under
   `darkLevel` (range param 100 to 900 step 50, default 300, live). Readout
   `A0 reads <raw>, LED on|off`. Goal: the LED has changed state twice since
   Run (on, then off again).
7. **1.10 circuit**: TMP36 at `12e`, with 5V to `12a`, A0 to `13a` and GND.2 to `14a`.
8. **1.10 sim** `src/sim/temp.js`: A0 = (0.5 + T / 100) / 5. Readout
   `A0 reads <raw>, <deg C> deg C`, converted back like the sketch. Goal: the
   reading, to the nearest degree, has been 15 deg C or less and 30 deg C or
   more since Run.
9. 1.9 and 1.10 get sketches and a third overview paragraph with the goal.
   Tests, AGENTS.md, README and backlog are updated.

## Assumptions

- Goals need the learner to move the room sliders, so Run alone does not pass.
- The room resets to 80 % light and 22 deg C on every lesson change.
