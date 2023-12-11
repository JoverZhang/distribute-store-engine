import * as Koa from 'koa'
import * as Router from '@koa/router'
import * as http from 'http'
import * as WebSocket from 'ws'
import * as bodyParser from 'koa-bodyparser'
import { Context, DataSheet, IRecord, ShareDataSheet } from './core'
import { applyChangeLog, ChangeLog, Command, ICommand, UpdateCellValueCommand } from './core/command'
import { ServerSocket } from './server_socket'
import { FieldType } from './core/field'

const app = new Koa()
const router = new Router()

const context: Context = {
      datasheetMap: {
        '1': new DataSheet('1'),
        '2': new DataSheet('2'),
      },
    }

// init data
;(() => {
  const datasheet1 = context.datasheetMap['1']
  datasheet1.field_map['text1'] = {type: FieldType.Text}
  datasheet1.field_map['text2'] = {type: FieldType.Text}
  datasheet1.records['rcd1'] = {
    data: {
      'text1': 'a1',
      'text2': 'b1',
    },
  }
  datasheet1.records['rcd2'] = {
    data: {
      'text1': 'a2',
      'text2': 'b2',
    },
  }
  datasheet1.views.push({rows: ['rcd1', 'rcd2']})

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

const serverSocket = new ServerSocket()

class ChangeLogManager {
  changeLogMap: { [datasheet_id: string]: ChangeLog[] }
  lookupBroadcastMap: {
    [datasheet_id: string]: {
      [field_id: string]: [string, string][]
    }
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

  // example:
  // createLookup(A, B, b) // A.a lookup B.b
  public createLookup(datasheetId: string, fieldId: string, targetDatasheetId: string, targetFieldId: string) {
    if (!this.lookupBroadcastMap[targetDatasheetId]) {
      this.lookupBroadcastMap[targetDatasheetId] = {}
    }
    const lookupFieldMap = this.lookupBroadcastMap[targetDatasheetId]
    if (!lookupFieldMap[targetFieldId]) {
      lookupFieldMap[targetFieldId] = []
    }
    lookupFieldMap[targetFieldId].push([datasheetId, fieldId])
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

  private handleChangeLog(datasheet: DataSheet, changeLog: ChangeLog) {
    console.log(changeLog)

    // handle lookup before apply changeLog
    let command = Command.from(changeLog.command)
    if (command instanceof UpdateCellValueCommand) {
      this.handleLookupUpdate(datasheet.id, command.fieldId, command.value)
    }

    applyChangeLog(datasheet, changeLog)

    // broadcast to all watchers
    serverSocket.broadcast(context, datasheet.id, changeLog)
  }

  private handleLookupUpdate(datasheetId: string, fieldId: string, value: string) {
    let map = this.lookupBroadcastMap[datasheetId]
    if (!map) {
      return
    }
    let fieldInfo = map[fieldId]
    if (!fieldInfo) {
      return
    }
    console.log('lookup todo')
  }
}

const changeLogManager = new ChangeLogManager()


router.get('/datasheet/records/:id', (ctx) => {
  const datasheetId = ctx.params.id as string

  const dataSheet = context.datasheetMap[datasheetId]
  const view = DataSheet.getDefaultView(dataSheet)

  const records = {} as { [recordId: string]: IRecord }
  for (let recordId of view.rows) {
    records[recordId] = dataSheet.records[recordId]
  }

  ctx.body = {
    id: datasheetId,
    revision: dataSheet.revision,
    field_map: dataSheet.field_map,
    views: [view],
    records,
  } as ShareDataSheet
})

router.post('/datasheet/update', (ctx) => {
  const body = ctx.request.body as ICommand & { datasheetId: string }
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
