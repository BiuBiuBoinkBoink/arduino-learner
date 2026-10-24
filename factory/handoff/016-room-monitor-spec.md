# Level 1 project, Room monitor

> Feature: Level 1 project lesson Room monitor combining LDR, TMP36, buzzer and LED, checked across a sim day and night cycle

## Requirements

1. **Lesson P1** `Project: Room monitor`, level 1, after 1.12, so the course
   has 13 entries. It has three overview paragraphs (the last is the goal),
   pinout, an example (the sketch with dark level 150 and alarm 30 deg C) and
   specs.
2. **Jumper wires**: a circuit wire `from` may be a hole as well as an Uno pin.
   `buildCircuit` starts it at that hole.
3. **P1 circuit**: an LDR and 10 kohm divider on A0 (5V `2a`, A0 `5a`, GND.2
   `9a`). A TMP36 at `12e` on 3.3V, A1 and GND.3. The D13 night light runs
   through 220 ohm (`18c` to `22c`) to a yellow LED at `22e` / `23e`, with GND
   to `23a`. The D8 buzzer sits at `20h`, and a jumper from `23d` to `23g`
   grounds its negative leg (the Uno has only three GND pins). The circuit
   carries `roomDriven: true`, so `main.js` hides the room sliders.
4. **Sketch**: reads A0 and A1, turns the LED on while light is under
   `{{darkLevel}}` (range 50 to 500 step 25, default 300), and plays
   `tone(8, 880)` while tempC is at or above `{{alarmC}}` (range 20 to 40,
   default 35, deg C), else `noTone`.
5. **Sim** `src/sim/monitor.js` `createMonitorSim`: a 24 s sim day (1 s per
   hour, from midnight) sets the room light (5 % at night to 95 % at noon)
   and temperature (18 deg C at 3 am to 34 deg C at 3 pm), which also dims the
   scene. A0, A1, D13 and the D8 tone follow the sketch. Readout shows the day,
   the hour, light, temperature, LED, alarm and whether the day is still ok.
   Goal: one whole day where every sample with light at or below 20 % had the
   LED on, light at or above 50 % had it off, 32 deg C or more had the alarm
   on, and 28 deg C or less had it off. A mistake fails that day only.
   `stop()` clears D13, D8 and resets the room.
6. Tests, AGENTS.md, README and backlog are updated.

## Assumptions

- The project is lesson `P1` after the 12 Level 1 lessons. The curriculum
  counts 12 Level 1 lessons, and the backlog lists the project on its own.
- The defaults (300, 35) fail by day, so pressing Run alone never passes.
  Dark levels from about 50 to 225 with alarms from 29 to 32 pass.
