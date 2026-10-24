import './style.css'
import { createStage } from './scene/stage.js'
import { createPanels } from './ui/panels.js'
import { lessons } from './course/lessons.js'
import { createCourse } from './course/state.js'
import { idFromHash, hashForId } from './course/hash.js'
import { createLessonStrip } from './ui/lessonStrip.js'
import { createInfoPanel } from './ui/infoPanel.js'
import { createCodePanel } from './ui/codePanel.js'

const app = document.querySelector('#app')

const stageEl = document.createElement('div')
stageEl.id = 'stage'
app.append(stageEl)

createStage(stageEl)
const panels = createPanels(app)

function getStorage() {
  try {
    const storage = window.localStorage
    if (storage) return storage
  } catch {
    // Storage blocked, fall through to memory.
  }
  const memory = new Map()
  return {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) }
  }
}

const course = createCourse({ lessons, storage: getStorage() })

// URL hash sync: lesson changes push the hash, hashchange calls goTo.
// Unknown or missing hashes are replaced with the current lesson, no history entry.
function currentHash() {
  return hashForId(course.getState().lesson.id)
}
function resetHash() {
  if (location.hash !== currentHash()) history.replaceState(null, '', currentHash())
}

course.goTo(idFromHash(location.hash))
resetHash()
course.subscribe(() => {
  if (location.hash !== currentHash()) location.hash = currentHash()
})
window.addEventListener('hashchange', () => {
  course.goTo(idFromHash(location.hash))
  resetHash()
})

createInfoPanel(panels.info, course)
createCodePanel(panels.code, course)
createLessonStrip(panels.strip, course)
