import './style.css'
import { createStage } from './scene/stage.js'
import { createPanels } from './ui/panels.js'

const app = document.querySelector('#app')

const stageEl = document.createElement('div')
stageEl.id = 'stage'
app.append(stageEl)

createStage(stageEl)
createPanels(app)
