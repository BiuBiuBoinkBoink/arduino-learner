// Level 1 lesson data. Each lesson holds the text for the info panel tabs:
// overview paragraphs, pinout rows, an example snippet and key specs.
// Later jobs add levels.
export const lessons = [
  {
    id: '1.1',
    level: 1,
    title: 'Meet the Uno',
    summary: 'Tour the board and find the pins, power jacks and the reset button.',
    overview: [
      'The Uno is a small board built around the ATmega328P chip. It runs one program, called a sketch, again and again.',
      'Digital pins sit along the top edge. Power and analog pins sit along the bottom edge. The USB port powers the board and loads new sketches.'
    ],
    pinout: [
      { pin: 'D0 to D13', use: 'Digital input and output. D0 and D1 also carry serial data.' },
      { pin: '3, 5, 6, 9, 10, 11', use: 'Digital pins that can also output PWM, marked with a ~.' },
      { pin: 'A0 to A5', use: 'Analog inputs that read a voltage from 0 to 5 V.' },
      { pin: '5V and 3.3V', use: 'Regulated power out for parts on the breadboard.' },
      { pin: 'GND', use: 'Ground, the 0 V return for every circuit.' },
      { pin: 'VIN', use: 'Raw supply from the barrel jack, or power in from a battery.' },
      { pin: 'RESET', use: 'Pull low to restart the sketch, same as the reset button.' }
    ],
    example: {
      code: `void setup() {
  // Runs once when the board powers up or resets.
}

void loop() {
  // Runs again and again after setup.
}`,
      note: 'Every sketch has a setup function that runs once and a loop function that repeats forever.'
    },
    specs: [
      { label: 'Chip', value: 'ATmega328P' },
      { label: 'Operating voltage', value: '5 V' },
      { label: 'Recommended input (jack)', value: '7 to 12 V' },
      { label: 'Clock speed', value: '16 MHz' },
      { label: 'Flash memory', value: '32 KB' },
      { label: 'SRAM', value: '2 KB' },
      { label: 'Digital pins', value: '14, 6 with PWM' },
      { label: 'Analog inputs', value: '6' }
    ],
    tour: [
      { zone: 'digital', label: 'Digital pins', text: 'Pins D0 to D13 read or send on and off signals. Pins marked ~ can also output PWM.' },
      { zone: 'analog', label: 'Analog pins', text: 'Pins A0 to A5 measure a voltage from 0 to 5 V. Sensors like a potentiometer connect here.' },
      { zone: 'power', label: 'Power pins', text: 'These pins give 5V, 3.3V and GND to your circuit. VIN carries the raw supply from the jack.' },
      { zone: 'usb-power', label: 'USB and power jack', text: 'The USB port powers the board and loads your sketch. The barrel jack takes 7 to 12 V when no computer is attached.' },
      { zone: 'chip', label: 'ATmega328P chip', text: 'This chip is the brain of the board. It stores your sketch and runs it at 16 MHz.' },
      { zone: 'reset', label: 'Reset button', text: 'Press it to restart your sketch from the top. The board runs setup again, then loop.' }
    ]
  },
  {
    id: '1.2',
    level: 1,
    title: 'Blink',
    summary: 'Turn an LED on and off on a timer with your first sketch.',
    overview: [
      'An LED lights when current flows from its long leg, the anode, to its short leg, the cathode.',
      'The sketch sets pin 13 as an output, then switches it HIGH and LOW with a pause in between. The Uno also has a small LED wired to pin 13 on the board.'
    ],
    pinout: [
      { pin: 'D13', use: 'Output to the LED anode through a 220 ohm resistor.' },
      { pin: 'GND', use: 'LED cathode, the short leg.' }
    ],
    example: {
      code: `const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}`,
      note: 'The LED stays on for half a second, then off for half a second, so it blinks once per second.'
    },
    specs: [
      { label: 'HIGH output', value: 'about 5 V' },
      { label: 'LOW output', value: '0 V' },
      { label: 'Red LED forward voltage', value: 'about 2 V' },
      { label: 'Series resistor', value: '220 ohm' },
      { label: 'Max current per pin', value: '20 mA recommended' }
    ]
  },
  {
    id: '1.3',
    level: 1,
    title: "Resistors and Ohm's law",
    summary: 'Pick a resistor that keeps the LED current in a safe range.',
    overview: [
      "Ohm's law says current equals voltage divided by resistance, I = V / R.",
      'The resistor drops whatever voltage the LED does not use. With a 5 V pin and a 2 V LED, the resistor sees 3 V. A 220 ohm resistor then lets about 14 mA flow.',
      'A bigger resistor means less current and a dimmer LED. Too small a resistor can damage the LED or the pin.'
    ],
    pinout: [
      { pin: 'D9', use: 'Output to the resistor, then to the LED anode.' },
      { pin: 'GND', use: 'LED cathode.' }
    ],
    example: {
      code: `// R = (supply - LED voltage) / current
float supply = 5.0;   // volts
float ledV = 2.0;     // volts
float current = 0.014; // amps, 14 mA
float r = (supply - ledV) / current; // about 214 ohm`,
      note: 'The math picks the resistor; round up to the next common value, which is 220 ohm.'
    },
    specs: [
      { label: 'Supply', value: '5 V' },
      { label: 'Red LED forward voltage', value: 'about 2 V' },
      { label: 'Resistor', value: '220 ohm, colour bands red red brown' },
      { label: 'LED current with 220 ohm', value: 'about 14 mA' },
      { label: 'LED current with 1 kohm', value: 'about 3 mA' },
      { label: 'LED max current', value: '20 mA' }
    ]
  },
  {
    id: '1.4',
    level: 1,
    title: 'Button input',
    summary: 'Read a push button and light an LED while it is pressed.',
    overview: [
      'A push button joins two wires while you hold it down. The Uno reads the pin as HIGH or LOW.',
      'This sketch uses the internal pull up resistor, so the pin reads HIGH when the button is up and LOW when it is pressed.'
    ],
    pinout: [
      { pin: 'D2', use: 'Button input, other side of the button goes to GND.' },
      { pin: 'D13', use: 'Output to the LED through a 220 ohm resistor.' },
      { pin: 'GND', use: 'Button and LED cathode.' }
    ],
    example: {
      code: `const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(buttonPin) == LOW;
  digitalWrite(ledPin, pressed ? HIGH : LOW);
}`,
      note: 'With the pull up on, a pressed button reads LOW, so the sketch turns the LED on when it sees LOW.'
    },
    specs: [
      { label: 'Button type', value: '4 leg tactile switch' },
      { label: 'Internal pull up', value: '20 to 50 kohm' },
      { label: 'Reads HIGH above', value: 'about 3 V' },
      { label: 'Reads LOW below', value: 'about 1.5 V' },
      { label: 'LED resistor', value: '220 ohm' }
    ]
  },
  {
    id: '1.5',
    level: 1,
    title: 'Pull up vs pull down',
    summary: 'Stop a floating input by tying it high or low with a resistor.',
    overview: [
      'An input pin with nothing connected floats. It picks up noise and reads random values.',
      'A pull down resistor ties the pin to GND, so it reads LOW until the button connects it to 5 V. A pull up ties it to 5 V, so it reads HIGH until the button connects it to GND.'
    ],
    pinout: [
      { pin: 'D2', use: 'Input with a 10 kohm pull down resistor to GND.' },
      { pin: '5V', use: 'Other side of the button.' },
      { pin: 'D13', use: 'Output to the LED through a 220 ohm resistor.' },
      { pin: 'GND', use: 'Pull down resistor and LED cathode.' }
    ],
    example: {
      code: `const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(buttonPin, INPUT); // external 10 kohm pull down
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, digitalRead(buttonPin));
}`,
      note: 'With a pull down the pin reads HIGH only while the button is pressed, so the LED copies the button.'
    },
    specs: [
      { label: 'External pull down', value: '10 kohm' },
      { label: 'Internal pull up', value: '20 to 50 kohm' },
      { label: 'Current through 10 kohm at 5 V', value: '0.5 mA' },
      { label: 'Internal pull down', value: 'none on the Uno' }
    ]
  },
  {
    id: '1.6',
    level: 1,
    title: 'Potentiometer',
    summary: 'Turn a knob and read the changing voltage on an analog pin.',
    overview: [
      'A potentiometer is a resistor with a sliding middle contact, called the wiper. Its outer legs go to 5 V and GND.',
      'Turning the knob moves the wiper voltage between 0 and 5 V. analogRead turns that voltage into a number from 0 to 1023.'
    ],
    pinout: [
      { pin: 'A0', use: 'Potentiometer wiper, the middle leg.' },
      { pin: '5V', use: 'One outer leg.' },
      { pin: 'GND', use: 'The other outer leg.' }
    ],
    example: {
      code: `void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  float volts = raw * 5.0 / 1023.0;
  Serial.println(volts);
  delay(200);
}`,
      note: 'The sketch reads the wiper and prints the voltage five times a second.'
    },
    specs: [
      { label: 'Potentiometer', value: '10 kohm linear' },
      { label: 'ADC resolution', value: '10 bit, 0 to 1023' },
      { label: 'Reference voltage', value: '5 V' },
      { label: 'Step size', value: 'about 4.9 mV' }
    ]
  },
  {
    id: '1.7',
    level: 1,
    title: 'PWM fade',
    summary: 'Fade an LED up and down by changing the duty cycle.',
    overview: [
      'PWM switches a pin on and off very fast. The share of time it is on is the duty cycle.',
      'Your eye sees the average, so a higher duty cycle looks brighter. analogWrite takes a value from 0, always off, to 255, always on.'
    ],
    pinout: [
      { pin: 'D9', use: 'PWM output to the LED through a 220 ohm resistor.' },
      { pin: 'GND', use: 'LED cathode.' }
    ],
    example: {
      code: `const int ledPin = 9;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  for (int level = 0; level <= 255; level++) {
    analogWrite(ledPin, level);
    delay(4);
  }
  for (int level = 255; level >= 0; level--) {
    analogWrite(ledPin, level);
    delay(4);
  }
}`,
      note: 'The first loop raises the duty cycle step by step and the second lowers it, so the LED fades up then down.'
    },
    specs: [
      { label: 'PWM pins', value: '3, 5, 6, 9, 10, 11' },
      { label: 'analogWrite range', value: '0 to 255' },
      { label: 'PWM frequency, pin 9', value: 'about 490 Hz' },
      { label: 'PWM frequency, pins 5 and 6', value: 'about 980 Hz' },
      { label: 'LED resistor', value: '220 ohm' }
    ]
  },
  {
    id: '1.8',
    level: 1,
    title: 'Colour mixing',
    summary: 'Blend red, green and blue on an RGB LED to make new colours.',
    overview: [
      'An RGB LED holds a red, a green and a blue LED in one case. A common cathode type shares one GND leg, the longest one.',
      'Each colour gets its own PWM pin and resistor. Mixing the three at different levels makes other colours, such as red plus green for yellow.'
    ],
    pinout: [
      { pin: 'D9', use: 'Red leg through a 220 ohm resistor.' },
      { pin: 'D10', use: 'Green leg through a 220 ohm resistor.' },
      { pin: 'D11', use: 'Blue leg through a 220 ohm resistor.' },
      { pin: 'GND', use: 'Common cathode, the longest leg.' }
    ],
    example: {
      code: `const int redPin = 9;
const int greenPin = 10;
const int bluePin = 11;

void setColour(int r, int g, int b) {
  analogWrite(redPin, r);
  analogWrite(greenPin, g);
  analogWrite(bluePin, b);
}

void setup() {}

void loop() {
  setColour(255, 160, 0); // orange
  delay(1000);
  setColour(0, 120, 255); // sky blue
  delay(1000);
}`,
      note: 'The helper sets all three channels at once, and the loop switches between two mixed colours every second.'
    },
    specs: [
      { label: 'LED type', value: 'RGB, common cathode' },
      { label: 'Red forward voltage', value: 'about 2 V' },
      { label: 'Green and blue forward voltage', value: 'about 3 V' },
      { label: 'Resistor per colour', value: '220 ohm' },
      { label: 'Levels per channel', value: '256' }
    ]
  },
  {
    id: '1.9',
    level: 1,
    title: 'Light sensor',
    summary: 'Measure room light with a photoresistor and react when it gets dark.',
    overview: [
      'A photoresistor drops its resistance as light gets brighter. Paired with a fixed resistor it forms a voltage divider.',
      'The middle point goes to an analog pin. In this wiring more light gives a higher reading, so a low reading means the room is dark.'
    ],
    pinout: [
      { pin: 'A0', use: 'Middle of the divider, between the photoresistor and the 10 kohm resistor.' },
      { pin: '5V', use: 'Free leg of the photoresistor.' },
      { pin: 'GND', use: 'Free leg of the 10 kohm resistor and LED cathode.' },
      { pin: 'D13', use: 'Output to the LED through a 220 ohm resistor.' }
    ],
    example: {
      code: `const int ledPin = 13;
const int darkLevel = 300;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int light = analogRead(A0);
  digitalWrite(ledPin, light < darkLevel ? HIGH : LOW);
  delay(100);
}`,
      note: 'When the reading falls below the dark level the LED turns on, like a simple night light.'
    },
    specs: [
      { label: 'Photoresistor, bright room', value: 'about 1 to 10 kohm' },
      { label: 'Photoresistor, dark', value: 'about 1 Mohm' },
      { label: 'Fixed resistor', value: '10 kohm' },
      { label: 'Reading range', value: '0 to 1023' }
    ]
  },
  {
    id: '1.10',
    level: 1,
    title: 'Temperature',
    summary: 'Read a temperature sensor and convert the value to deg C.',
    overview: [
      'The TMP36 is a small three leg sensor whose output voltage rises with temperature.',
      'It outputs 0.5 V at 0 deg C and adds 10 mV for every degree. Subtract 0.5 V and multiply by 100 to get deg C.'
    ],
    pinout: [
      { pin: 'A0', use: 'Sensor output, the middle leg.' },
      { pin: '5V', use: 'Sensor supply, the left leg with the flat side facing you.' },
      { pin: 'GND', use: 'Sensor ground, the right leg.' }
    ],
    example: {
      code: `void setup() {
  Serial.begin(9600);
}

void loop() {
  float volts = analogRead(A0) * 5.0 / 1023.0;
  float tempC = (volts - 0.5) * 100.0;
  Serial.print(tempC);
  Serial.println(" deg C");
  delay(1000);
}`,
      note: 'The sketch turns the reading into volts, then into deg C, and prints it once a second.'
    },
    specs: [
      { label: 'Sensor', value: 'TMP36' },
      { label: 'Supply', value: '2.7 to 5.5 V' },
      { label: 'Output at 0 deg C', value: '0.5 V' },
      { label: 'Scale', value: '10 mV per deg C' },
      { label: 'Range', value: '-40 to 125 deg C' },
      { label: 'Accuracy', value: 'about 2 deg C' }
    ]
  },
  {
    id: '1.11',
    level: 1,
    title: 'Sound',
    summary: 'Play tones on a piezo buzzer at different pitches.',
    overview: [
      'A passive piezo buzzer clicks each time its voltage changes. Fast clicks make a tone.',
      'The tone function makes a square wave at the frequency you ask for. A higher frequency gives a higher pitch.'
    ],
    pinout: [
      { pin: 'D8', use: 'Buzzer positive leg.' },
      { pin: 'GND', use: 'Buzzer negative leg.' }
    ],
    example: {
      code: `const int buzzerPin = 8;
int notes[] = {262, 294, 330, 349, 392}; // C D E F G

void setup() {}

void loop() {
  for (int i = 0; i < 5; i++) {
    tone(buzzerPin, notes[i], 300);
    delay(350);
  }
  delay(1000);
}`,
      note: 'The loop plays five notes going up the scale, each for 300 ms, then pauses.'
    },
    specs: [
      { label: 'Buzzer type', value: 'passive piezo' },
      { label: 'Middle C', value: '262 Hz' },
      { label: 'A above middle C', value: '440 Hz' },
      { label: 'Lowest tone frequency', value: '31 Hz' },
      { label: 'Tones at once', value: 'one pin at a time' }
    ]
  },
  {
    id: '1.12',
    level: 1,
    title: 'Servo basics',
    summary: 'Sweep a servo arm to set angles from your code.',
    overview: [
      'A hobby servo turns its arm to an angle from 0 to 180 deg and holds it there.',
      'The angle is set by the width of a pulse sent about 50 times a second. The Servo library makes the pulses for you.',
      'Using the Servo library turns off PWM on pins 9 and 10, so keep LEDs that fade on other pins.'
    ],
    pinout: [
      { pin: 'D9', use: 'Servo signal wire, orange or yellow.' },
      { pin: '5V', use: 'Servo power wire, red.' },
      { pin: 'GND', use: 'Servo ground wire, brown or black.' }
    ],
    example: {
      code: `#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 5) {
    arm.write(angle);
    delay(30);
  }
  for (int angle = 180; angle >= 0; angle -= 5) {
    arm.write(angle);
    delay(30);
  }
}`,
      note: 'The arm sweeps from 0 to 180 deg and back in steps of 5 deg.'
    },
    specs: [
      { label: 'Servo', value: 'SG90 micro servo' },
      { label: 'Supply', value: '4.8 to 6 V' },
      { label: 'Range', value: '0 to 180 deg' },
      { label: 'Pulse width', value: 'about 1 to 2 ms' },
      { label: 'Pulse rate', value: '50 Hz, every 20 ms' },
      { label: 'Stall current', value: 'up to about 650 mA' }
    ]
  }
]
