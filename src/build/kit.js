// Lesson kit: the parts and wires a lesson puts in the parts tray, and which
// reference items start placed. Pure module.
//
// kitFor(lesson, reference, { prebuiltLists }) -> {
//   parts: [{ id, type, meta }],   // meta: every reference field except id, type and positions
//   wires: number,                 // how many wires the tray holds
//   prebuilt: { parts: [ids], wires: [ids] }
// }
// Parts come from lesson.kit.parts when given, else every reference part in
// order; wires from lesson.kit.wires, else the reference wire count plus 2.
// Prebuilt is lesson.prebuilt (reference part and wire ids) when given and
// prebuiltLists is true, else every reference part and wire.

const POSITION_FIELDS = ['id', 'type', 'legs', 'anode', 'cathode', 'from', 'to', 'at']

function metaOf(part) {
  const meta = {}
  for (const [key, value] of Object.entries(part)) {
    if (!POSITION_FIELDS.includes(key)) meta[key] = value
  }
  return meta
}

export function kitFor(lesson, reference, { prebuiltLists = true } = {}) {
  const ref = reference || { parts: [], wires: [] }
  const refParts = ref.parts || []
  const refWires = ref.wires || []
  const kit = lesson && lesson.kit ? lesson.kit : {}
  const source = Array.isArray(kit.parts) ? kit.parts : refParts
  const parts = source.map((part) => ({ id: part.id, type: part.type, meta: metaOf(part) }))
  const wires = Number.isInteger(kit.wires) && kit.wires >= 0 ? kit.wires : refWires.length + 2

  const partIds = parts.map((part) => part.id)
  let prebuilt
  if (prebuiltLists && lesson && Array.isArray(lesson.prebuilt)) {
    const ids = lesson.prebuilt
    prebuilt = {
      parts: refParts.filter((part) => ids.includes(part.id) && partIds.includes(part.id)).map((part) => part.id),
      wires: refWires.filter((wire) => ids.includes(wire.id)).map((wire) => wire.id)
    }
  } else {
    prebuilt = {
      parts: refParts.filter((part) => partIds.includes(part.id)).map((part) => part.id),
      wires: refWires.map((wire) => wire.id)
    }
  }
  return { parts, wires, prebuilt }
}
