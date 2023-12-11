import { WebSocket } from 'ws'
import axios from 'axios'
import { Context, ShareDataSheet } from './core'
import { applyChangeLog, ChangeLog } from './core/command'

const context: Context = {
  datasheetMap: {},
}


async function main() {
  const datasheetId = '1'
  const res = await axios.get(`http://localhost:8080/datasheet/records/${datasheetId}`)
  const datasheet = res.data as ShareDataSheet
  console.log(JSON.stringify(datasheet, null, 2))

  context.datasheetMap[datasheetId] = {dependent_on: [], ...datasheet}

  const ws = new WebSocket('ws://localhost:8080')
  ws.on('open', function open() {
    ws.send(JSON.stringify({datasheetId, revision: datasheet.revision}))
  })

  ws.on('message', function incoming(data) {
    const changeLog = JSON.parse(data.toString()) as ChangeLog
    if (changeLog.datasheetId !== datasheetId) {
      console.error('ignore')
      return
    }
    console.log('changeLog', changeLog)

    let datasheet = context.datasheetMap[datasheetId]
    applyChangeLog(datasheet, changeLog)

    console.log(JSON.stringify(datasheet, null, 2))
  })
}

main().catch(console.error)
