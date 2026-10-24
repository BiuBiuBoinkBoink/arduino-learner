// Breadboard hole grid, pure (no three.js): names, rows, rails and strips.
// Columns 1 to 30 run left (-x) to right (+x). Rows a to e sit on the far side
// (-z) of the centre channel, f to j on the near side (+z). Four power rails
// run along the long edges: T+ and T- on the far side, B- and B+ on the near
// side, with a hole in every column. Rail holes are named row then column
// ('T+12'), terminal holes column then row ('12e'). src/parts/breadboard.js
// re-exports all of this and adds the 3D positions.
export const BREADBOARD_COLUMNS = 30
export const BREADBOARD_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
export const RAIL_ROWS = ['T+', 'T-', 'B-', 'B+']

// Rail rows in pitches along z from the centre line.
const RAIL_Z = { 'T+': -9, 'T-': -8, 'B-': 8, 'B+': 9 }

export function parseHole(hole) {
  const text = typeof hole === 'string' ? hole : ''
  const rail = /^(T\+|T-|B-|B\+)(\d+)$/.exec(text)
  const match = rail ? [rail[0], rail[2], rail[1]] : /^(\d+)([a-z])$/.exec(text)
  if (!match) throw new Error(`Bad breadboard hole: '${hole}'`)
  const column = Number(match[1])
  const row = match[2]
  if (column < 1 || column > BREADBOARD_COLUMNS) {
    throw new Error(`Breadboard hole '${hole}' has a column outside 1 to ${BREADBOARD_COLUMNS}`)
  }
  if (!rail && !BREADBOARD_ROWS.includes(row)) throw new Error(`Breadboard hole '${hole}' has a row outside a to j`)
  return { column, row }
}

// True for any terminal or rail hole name; never throws.
export function isHole(name) {
  try {
    parseHole(name)
    return true
  } catch {
    return false
  }
}

// The hole at a column and row, rails included; null when off the board.
export function holeName(column, row) {
  if (!Number.isInteger(column) || column < 1 || column > BREADBOARD_COLUMNS) return null
  if (RAIL_ROWS.includes(row)) return `${row}${column}`
  return BREADBOARD_ROWS.includes(row) ? `${column}${row}` : null
}

// Every row from far (-z) to near (+z).
export const ALL_ROWS = ['T+', 'T-', ...BREADBOARD_ROWS, 'B-', 'B+']

// Every hole, rails included: rows T+, T-, a to j, B-, B+, each by column.
export const ALL_HOLES = ALL_ROWS.flatMap((row) =>
  Array.from({ length: BREADBOARD_COLUMNS }, (_, i) => holeName(i + 1, row)))

// Row position in pitches along z: rows a to e and f to j are one pitch apart,
// e to f is three pitches, and the rails sit outside them.
export function rowPitchZ(row) {
  if (Object.hasOwn(RAIL_Z, row)) return RAIL_Z[row]
  const i = BREADBOARD_ROWS.indexOf(row)
  if (i === -1) throw new Error(`Unknown breadboard row '${row}'`)
  return i < 5 ? i - 5.5 : i - 3.5
}

// The row exactly `pitches` towards +z (negative towards -z), or null.
export function rowAt(row, pitches) {
  const z = rowPitchZ(row) + pitches
  return ALL_ROWS.find((other) => rowPitchZ(other) === z) || null
}

// The joined set a hole belongs to: '12-top' (12a to 12e), '12-bottom' (12f to
// 12j), or a whole rail ('rail-T+').
export function holeStrip(hole) {
  const { column, row } = parseHole(hole)
  if (RAIL_ROWS.includes(row)) return `rail-${row}`
  return `${column}-${BREADBOARD_ROWS.indexOf(row) < 5 ? 'top' : 'bottom'}`
}
