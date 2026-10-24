import { describe, it, expect } from 'vitest'
import { createProgram, pinName, STATEMENT_MS } from '../src/runner/interpreter.js'
import { createSession } from '../src/runner/session.js'
import { CodeError } from '../src/runner/lexer.js'
import { lessons } from '../src/course/lessons.js'
import { defaultValues, slotValues, fillSketch } from '../src/ui/sketch.js'

// A sketch with the given globals and setup body, and an empty loop. The
// globals are line 1 and the setup body starts on line 2.
const sketch = (setupBody, globals = '') => `${globals}\nvoid setup() {${setupBody}\n}\nvoid loop() {}`

// Runs a session to untilMs and gathers its output.
function run(source, untilMs = 10, options) {
  const session = createSession(source, options)
  const batch = session.advance(untilMs)
  return { session, batch }
}

// Serial output of a setup body.
const printed = (setupBody, globals) => {
  const { batch } = run(sketch(setupBody, globals))
  if (batch.error) throw new Error(batch.error.message)
  return batch.serial
}

describe('pinName', () => {
  it('maps 0 to 13 to D pins and 14 to 19 to A pins', () => {
    expect(pinName(13)).toBe('D13')
    expect(pinName(14)).toBe('A0')
    expect(pinName(19)).toBe('A5')
    expect(() => pinName(20, 3)).toThrow('Line 3: pin 20 does not exist')
  })
})

describe('timing', () => {
  const blink = `void setup() { pinMode(13, OUTPUT); }
void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}`

  it('waits on delay against the virtual clock', () => {
    const session = createSession(blink)
    expect(session.advance(10).pins).toEqual({ D13: 1 })
    expect(session.advance(499).pins).toEqual({})
    expect(session.advance(501).pins).toEqual({ D13: 0 })
    expect(session.advance(1001).pins).toEqual({ D13: 1 })
    expect(session.advance(1001).millis).toBeCloseTo(1001, 0)
  })

  it('moves the clock on in a busy loop, so millis timing works', () => {
    const session = createSession(`unsigned long last = 0;
int count = 0;
void setup() {}
void loop() {
  if (millis() - last >= 100) {
    last = millis();
    count++;
    Serial.println(count);
  }
}`)
    expect(session.advance(350).serial).toBe('1\n2\n3\n')
    expect(STATEMENT_MS).toBeGreaterThan(0)
  })

  it('reports millis and micros', () => {
    const { batch } = run(sketch('delay(250); Serial.print(millis()); Serial.print(" "); Serial.print(micros() >= 250000);'), 300)
    expect(batch.serial).toBe('250 1')
  })
})

describe('values and types', () => {
  it('divides ints as whole numbers and floats with decimals', () => {
    expect(printed('Serial.println(7 / 2); Serial.println(7.0 / 2); Serial.println(7 % 3); Serial.println(-7 / 2);')).toBe('3\n3.50\n1\n-3\n')
  })

  it('wraps int at 16 bits, byte at 8, and truncates floats stored in ints', () => {
    expect(printed('int a = 32767; a++; byte b = 250; b += 10; int c = 3.9; Serial.print(a); Serial.print(" "); Serial.print(b); Serial.print(" "); Serial.print(c);')).toBe('-32768 4 3')
  })

  it('prints floats with 2 decimals, or the digits asked for, and chars as characters', () => {
    expect(printed("float v = 2.5; char c = 'A'; Serial.println(v); Serial.println(v, 3); Serial.println(c); Serial.println(c + 1); Serial.println(255, HEX); Serial.println(true);")).toBe('2.50\n2.500\nA\n66\nFF\n1\n')
  })

  it('concatenates and compares Strings and uses String methods', () => {
    expect(printed(`String s = " On ";
s.trim();
s.toLowerCase();
String t = "Count: " + String(5);
Serial.println(s);
Serial.println(t);
Serial.println(s == "on");
Serial.println(t.length());
Serial.println(t.substring(0, 5));
Serial.println(String("42").toInt() + 1);`)).toBe('on\nCount: 5\n1\n8\nCount\n43\n')
  })

  it('casts with both styles', () => {
    expect(printed('Serial.println((float)3 / 2); Serial.println(int(2.9));')).toBe('1.50\n2\n')
  })

  it('evaluates conditionals, logic with short circuit, bit and update operators', () => {
    expect(printed('int x = 0; bool b = false && (x = 5); int y = x++ + ++x; Serial.print(b); Serial.print(y); Serial.print(5 > 3 ? 7 : 8); Serial.print((6 & 3) | (1 << 3));')).toBe('02710')
  })
})

describe('control flow', () => {
  it('runs for, while, do while with break and continue', () => {
    expect(printed(`for (int i = 0; i < 6; i++) {
  if (i == 1) continue;
  if (i == 4) break;
  Serial.print(i);
}
int n = 0;
while (n < 3) n++;
do { n--; } while (n > 5);
Serial.print(n);`)).toBe('0232')
  })

  it('runs switch with fall through and default', () => {
    const source = (value) => sketch(`switch (${value}) { case 1: Serial.print("a"); case 2: Serial.print("b"); break; default: Serial.print("d"); }`)
    expect(run(source(1)).batch.serial).toBe('ab')
    expect(run(source(2)).batch.serial).toBe('b')
    expect(run(source(9)).batch.serial).toBe('d')
  })

  it('uses enums, including scoped names and explicit values', () => {
    expect(printed('State s = GREEN; Serial.print(s); Serial.print(State::BLUE); Serial.print(RED);', 'enum State { RED, GREEN = 5, BLUE };')).toBe('560')
  })

  it('calls functions with values, returns and arrays by reference', () => {
    expect(printed('int a[] = {1, 2, 3}; bump(a); Serial.print(sum(a, 3)); Serial.print(fact(5));', `int sum(int v[], int n) { int t = 0; for (int i = 0; i < n; i++) t += v[i]; return t; }
void bump(int v[]) { v[0] = 10; }
int fact(int n) { if (n <= 1) return 1; return n * fact(n - 1); }`)).toBe('15120')
  })

  it('keeps globals between loops and locals inside their block', () => {
    const session = createSession(`int count = 0;
void setup() {}
void loop() { int local = 0; local++; count++; Serial.print(local); delay(10); }`)
    expect(session.advance(25).serial).toBe('111')
  })
})

describe('hardware', () => {
  it('reads inputs: levels from the circuit, pull ups, and analog values', () => {
    const { session } = run(`void setup() { pinMode(2, INPUT_PULLUP); pinMode(3, INPUT); }
void loop() {
  Serial.print(digitalRead(2));
  Serial.print(digitalRead(3));
  Serial.print(" ");
  Serial.println(analogRead(A0));
  delay(100);
}`, 0)
    expect(session.advance(10).serial).toBe('10 0\n')
    session.setInputs({ D2: 0, D3: 1, A0: 0.5 })
    expect(session.advance(110).serial).toBe('01 512\n')
  })

  it('reports analogWrite as a duty level, tone and noTone, and servo angles', () => {
    const { batch } = run(sketch('analogWrite(9, 51); tone(8, 440, 200); Serial.print(0); noTone(7); arm.attach(10); arm.write(200); Serial.print(arm.read());', '#include <Servo.h>\nServo arm;'))
    expect(batch.pins).toEqual({ D9: 0.2 })
    expect(batch.tones).toEqual({ D8: 440, D7: 0 })
    expect(batch.servos).toEqual({ D10: 180 })
    expect(batch.serial).toBe('0180')
  })

  it('reads serial input by line, byte and number', () => {
    const session = createSession(`void setup() {}
void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    Serial.println("got " + cmd);
    Serial.println(Serial.parseInt() * 2);
  }
  delay(10);
}`)
    expect(session.advance(20).serial).toBe('')
    session.sendSerial('on')
    session.sendSerial('21')
    expect(session.advance(40).serial).toBe('got on\n42\n')
  })

  it('maps, constrains and draws random numbers from the injected source', () => {
    const { batch } = run(sketch('Serial.print(map(512, 0, 1023, 0, 255)); Serial.print(" "); Serial.print(constrain(300, 0, 255)); Serial.print(" "); Serial.print(random(10, 20));'), 10, { random: () => 0.5 })
    expect(batch.serial).toBe('127 255 15')
  })
})

describe('errors', () => {
  const errorOf = (source) => run(source).batch.error

  it('throws a CodeError for code that does not parse or lacks setup or loop', () => {
    expect(() => createSession('void setup() {')).toThrow(CodeError)
    expect(() => createSession('void loop() {}')).toThrow('needs a void setup()')
  })

  it('stops with a line for runtime mistakes', () => {
    const cases = [
      [sketch('int a[3];\na[3] = 1;'), 3, 'index 3 is outside a, which has 3 items'],
      [sketch('Serial.print(nope);'), 2, 'nope is not declared'],
      [sketch('int x = 0;\nint y = 5 / x;'), 3, 'division by zero'],
      [sketch('const int k = 1;\nk = 2;'), 3, 'k is const'],
      [sketch('flash(13);'), 2, 'flash() is not a known function'],
      [sketch('digitalWrite(13);'), 2, 'digitalWrite() takes 2 values, not 1'],
      [sketch('down(1);', 'int down(int n) { return down(n + 1); }'), 1, 'too many nested calls'],
      [sketch('pinMode(25, OUTPUT);'), 2, 'pin 25 does not exist']
    ]
    for (const [source, line, text] of cases) {
      const error = errorOf(source)
      expect(error, text).not.toBe(null)
      expect(error.line).toBe(line)
      expect(error.message).toContain(text)
    }
  })

  it('stays stopped after an error', () => {
    const session = createSession(sketch('int x = 0;\nx = 1 / x;'))
    expect(session.advance(10).error).not.toBe(null)
    expect(session.advance(20).error.line).toBe(3)
  })
})

describe('lesson sketches', () => {
  for (const lesson of lessons.filter((item) => item.sketch)) {
    it(`runs ${lesson.id} for 3 s without an error`, () => {
      const { code, params } = lesson.sketch
      const session = createSession(fillSketch(code, slotValues(params, defaultValues(params))), { random: () => 0.5 })
      let error = null
      for (let t = 0; t <= 3000 && !error; t += 50) error = session.advance(t).error
      expect(error).toBe(null)
    })
  }

  it('the 1.2 blink sketch toggles D13 at its on and off times', () => {
    const lesson = lessons.find((item) => item.id === '1.2')
    const source = fillSketch(lesson.sketch.code, slotValues(lesson.sketch.params, { onMs: 200, offMs: 300 }))
    const session = createSession(source)
    expect(session.advance(1).pins.D13).toBe(1)
    expect(session.advance(201).pins.D13).toBe(0)
    expect(session.advance(501).pins.D13).toBe(1)
  })

  it('direct program API returns the same error object it stopped on', () => {
    const program = createProgram(sketch('int z = 0;\nz = 2 % z;'), new Proxy({}, { get: () => () => 0 }))
    const error = program.advance(5)
    expect(error).toBeInstanceOf(CodeError)
    expect(program.error).toBe(error)
  })
})
