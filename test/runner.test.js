import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createSimRunner, UPLOAD_MS } from '../src/sim/runner.js'

// Fake sim factory that records its calls; goal is a function so tests can flip it.
function fakeFactory({ goal } = {}) {
  const log = { created: [], updates: [], stops: 0, checks: 0 }
  function create(args) {
    log.created.push(args)
    const sim = {
      update: (now) => {
        log.updates.push(now)
        args.pins.set('D13', 1)
      },
      stop: () => { log.stops += 1 }
    }
    if (goal) {
      sim.checkGoal = () => {
        log.checks += 1
        return goal()
      }
    }
    return sim
  }
  return { create, log }
}

function setup(options) {
  const fake = fakeFactory(options)
  const pins = createPins()
  const goals = []
  const runner = createSimRunner({
    sims: { '1.2': fake.create },
    pins,
    onGoal: (id) => goals.push(id),
    uploadMs: 1000
  })
  const getValues = () => ({ onMs: 500, offMs: 500 })
  return { runner, pins, goals, log: fake.log, getValues }
}

describe('createSimRunner', () => {
  it('passes the shared inputs and room to the sim factory', () => {
    const fake = fakeFactory()
    const inputs = { isPressed: () => false }
    const room = { getLight: () => 0.8 }
    const runner = createSimRunner({ sims: { '1.4': fake.create }, pins: createPins(), inputs, room, onGoal: () => {}, uploadMs: 100 })
    runner.run({ lessonId: '1.4', getValues: () => ({}), now: 0 })
    runner.tick(100)
    expect(fake.log.created).toHaveLength(1)
    expect(fake.log.created[0].inputs).toBe(inputs)
    expect(fake.log.created[0].room).toBe(room)
  })

  it('passes tones to the sim and silences them on stop', () => {
    const tones = createPins()
    const create = (args) => ({ update: () => args.tones.set('D8', 262), stop: () => {} })
    const runner = createSimRunner({ sims: { '1.11': create }, pins: createPins(), tones, onGoal: () => {}, uploadMs: 100 })
    runner.run({ lessonId: '1.11', getValues: () => ({}), now: 0 })
    runner.tick(100)
    expect(tones.get('D8')).toBe(262)
    runner.stop()
    expect(tones.get('D8')).toBe(0)
  })

  it('passes servos to the sim and keeps their angle on stop', () => {
    const servos = createPins()
    const create = (args) => ({ update: () => args.servos.set('D9', 45), stop: () => {} })
    const runner = createSimRunner({ sims: { '1.12': create }, pins: createPins(), servos, onGoal: () => {}, uploadMs: 100 })
    runner.run({ lessonId: '1.12', getValues: () => ({}), now: 0 })
    runner.tick(100)
    runner.stop()
    expect(servos.get('D9')).toBe(45)
  })

  it('exports a 1500 ms upload time', () => {
    expect(UPLOAD_MS).toBe(1500)
  })

  it('starts idle and knows which lessons have a sim', () => {
    const { runner } = setup()
    expect(runner.getPhase()).toBe('idle')
    expect(runner.hasSim('1.2')).toBe(true)
    expect(runner.hasSim('1.3')).toBe(false)
    expect(runner.hasSim('toString')).toBe(false)
  })

  it('run returns false for a lesson with no sim', () => {
    const { runner, getValues } = setup()
    expect(runner.run({ lessonId: '1.3', getValues, now: 0 })).toBe(false)
    expect(runner.getPhase()).toBe('idle')
  })

  it('run returns false while not idle', () => {
    const { runner, getValues } = setup()
    expect(runner.run({ lessonId: '1.2', getValues, now: 0 })).toBe(true)
    expect(runner.run({ lessonId: '1.2', getValues, now: 10 })).toBe(false)
    runner.tick(1000)
    expect(runner.getPhase()).toBe('running')
    expect(runner.run({ lessonId: '1.2', getValues, now: 1010 })).toBe(false)
  })

  it('uploads until uploadMs, then runs with startedAt at that tick', () => {
    const { runner, log, getValues, pins } = setup()
    runner.run({ lessonId: '1.2', getValues, now: 100 })
    expect(runner.getPhase()).toBe('uploading')
    runner.tick(500)
    runner.tick(1099)
    expect(runner.getPhase()).toBe('uploading')
    expect(log.created).toHaveLength(0)
    runner.tick(1150)
    expect(runner.getPhase()).toBe('running')
    expect(log.created).toHaveLength(1)
    expect(log.created[0].startedAt).toBe(1150)
    expect(log.created[0].pins).toBe(pins)
    expect(log.created[0].getValues).toBe(getValues)
  })

  it('starts running on the tick exactly at uploadMs', () => {
    const { runner, log, getValues } = setup()
    runner.run({ lessonId: '1.2', getValues, now: 100 })
    runner.tick(1100)
    expect(runner.getPhase()).toBe('running')
    expect(log.created[0].startedAt).toBe(1100)
  })

  it('passes each tick now to update, including the starting tick', () => {
    const { runner, log, getValues } = setup()
    runner.run({ lessonId: '1.2', getValues, now: 0 })
    runner.tick(400)
    runner.tick(1000)
    runner.tick(1016)
    runner.tick(1033)
    expect(log.updates).toEqual([1000, 1016, 1033])
  })

  it('stop during upload never creates the sim', () => {
    const { runner, log, getValues } = setup()
    runner.run({ lessonId: '1.2', getValues, now: 0 })
    runner.tick(500)
    runner.stop()
    expect(runner.getPhase()).toBe('idle')
    runner.tick(2000)
    expect(log.created).toHaveLength(0)
    expect(log.updates).toHaveLength(0)
  })

  it('stop while running stops the sim and resets pins', () => {
    const { runner, log, getValues, pins } = setup()
    runner.run({ lessonId: '1.2', getValues, now: 0 })
    runner.tick(1000)
    expect(pins.get('D13')).toBe(1)
    runner.stop()
    expect(log.stops).toBe(1)
    expect(pins.get('D13')).toBe(0)
    expect(runner.getPhase()).toBe('idle')
    runner.tick(1100)
    expect(log.updates).toEqual([1000])
  })

  it('stop when idle has no effect', () => {
    const { runner, log } = setup()
    runner.stop()
    expect(runner.getPhase()).toBe('idle')
    expect(log.stops).toBe(0)
  })

  it('calls onGoal once with the lesson id on the first passing check', () => {
    let passed = false
    const { runner, goals, log, getValues } = setup({ goal: () => passed })
    runner.run({ lessonId: '1.2', getValues, now: 0 })
    runner.tick(1000)
    runner.tick(1016)
    expect(goals).toEqual([])
    expect(runner.isGoalMet()).toBe(false)
    passed = true
    runner.tick(1033)
    expect(goals).toEqual(['1.2'])
    expect(runner.isGoalMet()).toBe(true)
    const checks = log.checks
    runner.tick(1050)
    runner.tick(1066)
    expect(goals).toEqual(['1.2'])
    expect(log.checks).toBe(checks)
    expect(runner.getPhase()).toBe('running')
  })

  it('never calls onGoal for a sim without checkGoal', () => {
    const { runner, goals, getValues } = setup()
    runner.run({ lessonId: '1.2', getValues, now: 0 })
    for (let now = 1000; now < 10000; now += 16) runner.tick(now)
    expect(goals).toEqual([])
    expect(runner.isGoalMet()).toBe(false)
  })

  it('isGoalMet stays after stop and clears on the next run', () => {
    const { runner, goals, getValues } = setup({ goal: () => true })
    runner.run({ lessonId: '1.2', getValues, now: 0 })
    runner.tick(1000)
    runner.stop()
    expect(runner.isGoalMet()).toBe(true)
    runner.run({ lessonId: '1.2', getValues, now: 2000 })
    expect(runner.isGoalMet()).toBe(false)
    runner.tick(3000)
    expect(goals).toEqual(['1.2', '1.2'])
  })

  it('getReadout is the sim readout while running, else empty', () => {
    const pins = createPins()
    let text = 'A0 reads 512, 2.50 V'
    const withReadout = () => ({ update: () => {}, stop: () => {}, readout: () => text })
    const plain = () => ({ update: () => {}, stop: () => {} })
    const runner = createSimRunner({ sims: { '1.6': withReadout, '1.2': plain }, pins, onGoal: () => {}, uploadMs: 100 })
    expect(runner.getReadout()).toBe('')
    runner.run({ lessonId: '1.6', getValues: () => ({}), now: 0 })
    runner.tick(50)
    expect(runner.getReadout()).toBe('')
    runner.tick(100)
    expect(runner.getReadout()).toBe('A0 reads 512, 2.50 V')
    text = 'A0 reads 0, 0.00 V'
    expect(runner.getReadout()).toBe('A0 reads 0, 0.00 V')
    runner.stop()
    expect(runner.getReadout()).toBe('')
    runner.run({ lessonId: '1.2', getValues: () => ({}), now: 200 })
    runner.tick(300)
    expect(runner.getReadout()).toBe('')
  })
})
