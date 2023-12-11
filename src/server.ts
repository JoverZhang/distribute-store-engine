import * as Koa from 'koa'
import * as Router from '@koa/router'
import * as http from 'http'
import * as WebSocket from 'ws'
import * as bodyParser from 'koa-bodyparser'
import { Context, Datasheet, IRecord, IDatasheet } from './core'
import { applyChangeLog, ChangeLog, Command, ICommand, UpdateCellValueCommand } from './core/command'
import { ServerSocket } from './server_socket'
import { FieldType } from './core/field'
import { StoreManager, StoreProvider } from './core/store'

const app = new Koa()
const router = new Router()

const context: Context = {
  datasheetMap: {
    '1': new Datasheet('1'),
    '2': new Datasheet('2'),
  },
}
const serverSocket = new ServerSocket()

class ChangeLogManager {
  changeLogMap: {
    [datasheet_id: string]: ChangeLog[]
  }
  lookupBroadcastMap: {
    // key: datasheetId-recordId-fieldId
    // value: [datasheetId, recordId, fieldId]
    [key: string]: [string, string, string][]
  }

  constructor() {
    this.changeLogMap = {}
    this.lookupBroadcastMap = {}

    this.runDaemon()
  }

  public push(datasheetId: string, command: ICommand) {
    if (!this.changeLogMap[datasheetId]) {
      this.changeLogMap[datasheetId] = []
    }
    const changeLogs = this.changeLogMap[datasheetId]
    const nextRevision = changeLogs.length + 1
    changeLogs.push({datasheetId, revision: nextRevision, command})
  }

  public getByRevision(datasheetId: string, revision: number) {
    const changeLogs = this.changeLogMap[datasheetId]
    if (!changeLogs) {
      return []
    }
    return changeLogs.slice(revision)
  }

  public createLookup(datasheetId: string, recordId: string, fieldId: string,
                      targetDatasheetId: string, targetRecordId: string, targetFieldId: string) {
    const key = `${targetDatasheetId}-${targetRecordId}-${targetFieldId}`

    if (!this.lookupBroadcastMap[key]) {
      this.lookupBroadcastMap[key] = []
    }
    this.lookupBroadcastMap[key].push([datasheetId, recordId, fieldId])
  }

  private runDaemon() {
    setInterval(() => {
      for (const datasheetId in this.changeLogMap) {
        const datasheet = context.datasheetMap[datasheetId]
        const newChangeLogs = this.changeLogMap[datasheetId].slice(datasheet.revision)
        for (const changeLog of newChangeLogs) {
          this.handleChangeLog(datasheet, changeLog)
        }
      }
    }, 1000)
  }

  private handleChangeLog(datasheet: Datasheet, changeLog: ChangeLog) {
    console.log(changeLog)

    // handle lookup before apply changeLog
    let command = Command.from(changeLog.command)
    if (command instanceof UpdateCellValueCommand) {
      this.handleLookupUpdate(datasheet.id, command.recordId, command.fieldId, command.value)
    }

    applyChangeLog(datasheet, changeLog)

    // broadcast to all watchers
    serverSocket.broadcast(datasheet.id, changeLog)
  }

  private handleLookupUpdate(datasheetId: string, recordId: string, fieldId: string, value: string) {
    const key = `${datasheetId}-${recordId}-${fieldId}`
    let watchers = this.lookupBroadcastMap[key]
    if (!watchers) {
      return
    }
    for (let [datasheetId, recordId, fieldId] of watchers) {
      const changeLog: ChangeLog = {
        datasheetId, revision: 0, command: {
          type: 'UPDATE_CELLVALUE',
          args: [recordId, fieldId, value],
        },
      }
      serverSocket.broadcast(datasheetId, changeLog)
    }
  }
}

const changeLogManager = new ChangeLogManager()

class ServerStoreProvider implements StoreProvider {
  getRecord(datasheetId: string, recordId: string): IRecord {
    let datasheet = context.datasheetMap[datasheetId]
    if (!datasheet) {
      return null
    }
    let record = datasheet.records[recordId]
    if (!record) {
      return null
    }
    return record
  }
}

const storeManager = new StoreManager(new ServerStoreProvider())

// init data
;(() => {
  // dashboard 1
  const datasheet1 = context.datasheetMap['1']
  datasheet1.field_map['text1'] = {type: FieldType.Text}
  datasheet1.field_map['lookup1'] = {type: FieldType.Lookup, datasheet_id: '2', field_id: 'text2'}
  datasheet1.records['rcd1'] = {
    data: {
      'text1': 'a1',
      'lookup1': 'rcd3',
    },
  }
  datasheet1.records['rcd2'] = {
    data: {
      'text1': 'a2',
      'lookup1': 'rcd4',
    },
  }
  datasheet1.views.push({rows: ['rcd1', 'rcd2']})

  // link lookup
  changeLogManager.createLookup('1', 'rcd1', 'lookup1',
      '2', 'rcd3', 'text2')
  changeLogManager.createLookup('1', 'rcd2', 'lookup1',
      '2', 'rcd4', 'text2')

  // datasheet 2
  const datasheet2 = context.datasheetMap['2']
  datasheet2.field_map['text1'] = {type: FieldType.Text}
  datasheet2.field_map['text2'] = {type: FieldType.Text}
  datasheet2.records['rcd3'] = {
    data: {
      'text1': 'a3',
      'text2': 'b3',
    },
  }
  datasheet2.records['rcd4'] = {
    data: {
      'text1': 'a4',
      'text2': 'b4',
    },
  }
  datasheet2.views.push({rows: ['rcd3', 'rcd4']})
})()


router.get('/datasheet/:id', (ctx) => {
  const datasheetId = ctx.params.id as string

  const dataSheet = context.datasheetMap[datasheetId]
  const view = Datasheet.getDefaultView(dataSheet)

  const records = {} as {
    [recordId: string]: IRecord
  }
  for (let recordId of view.rows) {
    const recordData = dataSheet.records[recordId].data

    const data = {}
    for (let fieldId of Object.keys(recordData)) {
      let field = dataSheet.field_map[fieldId]
      if (field.type === FieldType.Text) {
        data[fieldId] = recordData[fieldId]
      } else if (field.type === FieldType.Lookup) {
        let recordId = recordData[fieldId]
        let lookupRecord = storeManager.getRecord(field.datasheet_id, recordId)

        data[fieldId] = lookupRecord.data[field.field_id]
      } else {
        console.warn('ignore')
      }
    }

    records[recordId] = {data}
  }

  ctx.body = {
    id: datasheetId,
    revision: dataSheet.revision,
    field_map: dataSheet.field_map,
    views: [view],
    records,
  } as IDatasheet
})

router.get('/datasheet/:datasheetId/:recordId', (ctx) => {
  const datasheetId = ctx.params.datasheetId as string
  const recordId = ctx.params.recordId as string

  ctx.body = storeManager.getRecord(datasheetId, recordId)
})

router.post('/datasheet/update', (ctx) => {
  const body = ctx.request.body as ICommand & {
    datasheetId: string
  }
  const datasheetId = body.datasheetId

  changeLogManager.push(datasheetId, body)

  ctx.body = {success: true}
})

app.use(bodyParser())
app.use(router.routes()).use(router.allowedMethods())

// create HTTP and WebSocket server
const server = http.createServer(app.callback())
const wss = new WebSocket.Server({server})

wss.on('connection', (ws: WebSocket, req) => {

  ws.on('message', (message: string) => {
    const {datasheetId, revision} = JSON.parse(message)
    console.log('datasheetId', datasheetId, 'revision', revision)
    serverSocket.watch(context, datasheetId, ws)

    changeLogManager.getByRevision(datasheetId, revision).forEach(changeLog => {
      ws.send(JSON.stringify(changeLog))
    })
  })
})

const PORT = 8080
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})
