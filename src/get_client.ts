import { WebSocket } from 'ws'
import axios from 'axios'
import { Context, IRecord, IDatasheet, Datasheet } from './core'
import { applyChangeLog, ChangeLog } from './core/command'

const context: Context = {
  datasheetMap: {},
}

const getDatasheet = async (datasheetId: string) => {
  const res = await axios.get(`http://localhost:8080/datasheet/${datasheetId}`)
  return res.data as IDatasheet
}

const getRecord = async (datasheetId: string, recordId: string) => {
  const res = await axios.get(`http://localhost:8080/datasheet/${datasheetId}/${recordId}`)
  return res.data as IRecord
}

async function main() {
  const args = process.argv.slice(2)

  const datasheetId = args[0]
  let datasheet = await getDatasheet(datasheetId)
  console.log(JSON.stringify(datasheet, null, 2))

  context.datasheetMap[datasheetId] = datasheet

  const ws = new WebSocket('ws://localhost:8080')
  ws.on('open', function open() {
    ws.send(JSON.stringify({datasheetId, revision: datasheet.revision}))
  })

  ws.on('message', (data) => {
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
