# Servo, lesson 1.12 Servo basics

> Feature: Servo part with an animated horn and lesson 1.12 Servo basics with a 3 target angle goal

## Requirements

1. **Servos store**: a third `createPins()` in `main.js` named `servos`, which
   holds the arm angle in deg per pin. The runner passes it to sims as
   `servos` and leaves it alone on stop, because a real servo holds its angle.
2. **Servo part** `src/parts/servo.js` `createServo({ legs })`: an SG90 style
   blue body with mounting tabs, lying on the breadboard 1.2 cm to the right of
   its three cable ends (brown GND, red 5V, orange signal). Coloured cables run
   from the holes into the body side, and a white horn sits on the output shaft
   (`shaft`, `horn`). `setAngle(deg)` clamps to 0 to 180: 90 points -z, 0 points
   +x, 180 points -x. Circuit `{ id, type: 'servo', at: '12h', pin: 'D9' }`
   uses the same three holes as a potentiometer.
3. **main.js**: on a circuit build with a servo, it sets the pin angle to 90
   and turns the horn there, and turns the horn on every `servos` change.
4. **1.12 circuit**: servo at `12h`. GND.2 goes to `12f`, 5V to `13f`, D9 to `14f`.
5. **1.12 sketch**: `arm.write({{angle}}); delay(15);`, with an Angle range
   param from 0 to 180 step 5, default 0, unit deg.
6. **Sim** `src/sim/sweep.js` `createSweepSim`: the arm moves towards the live
   angle at 0.6 deg per ms (SG90, about 0.1 s per 60 deg). Readout
   `arm.write(<cmd>), arm at <deg> deg. Targets left: ...`. Goal: the arm has
   come to rest at 45, 90 and 135 while commanded there; passing through a
   target does not count.
7. The goal is added to the end of the third 1.12 overview paragraph (it
   already had three). Tests, AGENTS.md, README and backlog are updated.

## Assumptions

- Targets 45, 90 and 135 deg in any order; the default angle 0 starts none.
- The servo body sits on the breadboard, so the circuit needs no extra space.
